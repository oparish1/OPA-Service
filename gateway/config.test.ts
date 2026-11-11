import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'bun:test';
import { parse } from 'yaml';
import { findProviderIsolationViolations } from '../shared/provider-isolation';
import { PROVIDER_IDS } from '../shared/providers';

/**
 * Docker-free gateway gate. Parses the declarative APISIX route file and
 * asserts the security invariants the acceptance criteria depend on. The
 * Compose integration script is the second gate (gateway/test-issuers/acceptance.ts).
 */

const GATEWAY_DIR = import.meta.dir;
const PROVIDERS = PROVIDER_IDS;
type Provider = (typeof PROVIDERS)[number];

interface Route {
  id: string;
  uri?: string;
  priority?: number;
  labels?: Record<string, string>;
  plugins?: Record<string, unknown>;
  upstream?: unknown;
}

const routeFile = readFileSync(join(GATEWAY_DIR, 'apisix', 'apisix.yaml'), 'utf8');
const config: { routes: Route[] } = parse(routeFile);

function routeFor(provider: Provider): Route {
  const route = config.routes.find(candidate => candidate.id === `${provider}-v1`);
  if (!route) throw new Error(`missing ${provider} route`);
  return route;
}

function capabilitiesRouteFor(provider: Provider): Route {
  const route = config.routes.find(candidate => candidate.id === `${provider}-authz-capabilities`);
  if (!route) throw new Error(`missing ${provider} capabilities route`);
  return route;
}

function serverlessSource(provider: Provider): string {
  const serverless = routeFor(provider).plugins?.['serverless-post-function'] as {
    functions: string[];
  };
  return serverless.functions.join('\n');
}

function capabilitiesServerlessSource(provider: Provider): string {
  const serverless = capabilitiesRouteFor(provider).plugins?.['serverless-post-function'] as {
    functions: string[];
  };
  return serverless.functions.join('\n');
}

const credentials = [
  ['ENTRA_API_RESOURCE', 'api://test-entra-client'],
  ['OKTA_API_AUDIENCE', 'api://default'],
  ['GOOGLE_CLIENT_ID', 'test-google-client'],
] as const;

describe('APISIX surface', () => {
  test('the health route is the only tokenless route', () => {
    const health = config.routes.find(route => route.id === 'health');
    expect(health).toBeDefined();
    expect(health?.uri).toBe('/health');
    expect(health?.plugins?.['openid-connect']).toBeUndefined();
  });

  test('the health route is rate limited like every other route (A16, GW-7)', () => {
    const health = config.routes.find(route => route.id === 'health');
    const limit = health?.plugins?.['limit-count'] as Record<string, unknown> | undefined;
    expect(limit?.count).toBe(20);
    expect(limit?.time_window).toBe(60);
    expect(limit?.rejected_code).toBe(429);
  });

  test('every configured provider has exactly one prefixed route', () => {
    for (const provider of PROVIDERS) {
      const matches = config.routes.filter(route => route.id === `${provider}-v1`);
      expect(matches).toHaveLength(1);
      expect(matches[0]?.uri).toBe(`/${provider}/*`);
    }
  });

  test('a provider with no route is disabled and would 404', () => {
    expect(config.routes.some(route => route.id === 'unknown-v1')).toBe(false);
  });
});

describe('token validation (GW-3, A9, A10)', () => {
  for (const provider of PROVIDERS) {
    const route = routeFor(provider);
    const oidc = route.plugins?.['openid-connect'] as Record<string, unknown> | undefined;

    test(`${provider}: openid-connect is bearer-only with local JWKS verification`, () => {
      expect(oidc).toBeDefined();
      expect(oidc?.bearer_only).toBe(true);
      expect(oidc?.use_jwks).toBe(true);
      expect(oidc?.discovery).toBe(`\${{${provider.toUpperCase()}_DISCOVERY}}`);
      expect(oidc?.client_secret).toBe(`\${{${provider.toUpperCase()}_CLIENT_SECRET}}`);
    });

    test(`${provider}: the issuer is pinned; OPA owns the audience check`, () => {
      const validator = oidc?.claim_validator as Record<string, unknown>;
      const issuers = validator.issuer as { valid_issuers: string[] };
      expect(issuers.valid_issuers).toHaveLength(1);
      // `claim_validator.audience` applies only on the introspection path, which
      // SD-11 excludes, so the OPA policy is the audience owner (R6).
      expect(validator.audience).toBeUndefined();
    });

    test(`${provider}: the route labels carry the expected audience`, () => {
      expect(route.labels?.audience).toMatch(/^\$\{\{.*\}\}$|^[\w:./-]+$/);
    });

    test(`${provider}: opa decodes the verified token with route config`, () => {
      const opa = route.plugins?.opa as Record<string, unknown> | undefined;
      // The package path returns the full document — `allow`, `headers` and
      // `reason` — which the plugin copies into the request/response. A
      // `pkg/allow` path would return a bare boolean and discard them.
      expect(opa?.policy).toBe(`authz/v1/gateway/${provider}`);
      expect(opa?.with_route).toBe(true);
      const headers = opa?.send_headers_upstream as string[];
      expect(headers).toContain('X-User-Issuer');
      expect(headers).toContain('X-User-Subject');
      expect(headers).toContain('X-User-Provider');
    });

    test(`${provider}: mocking does not short-circuit authorization`, () => {
      expect(route.plugins?.mocking).toBeUndefined();
    });
  }

  test('the entra route pins the configured tenant', () => {
    expect(routeFor('entra').labels?.tenant).toBe('${{ENTRA_TENANT_ID}}');
  });

  test('the google route pins the hosted domain', () => {
    expect(routeFor('google').labels?.hosted_domain).toBe('${{GOOGLE_HOSTED_DOMAIN}}');
  });
});

describe('authorization and transport (A12, A13, A15, GW-7)', () => {
  for (const provider of PROVIDERS) {
    const route = routeFor(provider);

    test(`${provider}: cors rejects wildcards and credentials`, () => {
      const cors = route.plugins?.cors as Record<string, unknown> | undefined;
      expect(cors).toBeDefined();
      expect(cors?.allow_origins).toBe('${{APP_ORIGIN}}');
      expect(cors?.allow_origins).not.toContain('*');
      expect(cors?.allow_credential).toBe(false);
      expect(String(cors?.allow_headers)).toContain('Authorization');
    });

    test(`${provider}: rate limiting is on with the documented window`, () => {
      const limit = route.plugins?.['limit-count'] as Record<string, unknown> | undefined;
      expect(limit?.count).toBe(20);
      expect(limit?.time_window).toBe(60);
      expect(limit?.rejected_code).toBe(429);
    });

    test(`${provider}: security headers and the tokenless response builder are present`, () => {
      const rewrite = route.plugins?.['response-rewrite'] as Record<string, unknown> | undefined;
      const set = (rewrite?.headers as { set: Record<string, string> }).set;
      expect(set['X-Content-Type-Options']).toBe('nosniff');
      expect(set['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
      expect(set['Strict-Transport-Security']).toContain('max-age=');

      const serverless = route.plugins?.['serverless-post-function'] as Record<string, unknown>;
      expect(serverless.phase).toBe('access');
    });
  }
});

describe('structured audit log (GW-8)', () => {
  const configYaml = readFileSync(join(GATEWAY_DIR, 'apisix', 'config.yaml'), 'utf8');

  test('the access log format carries route, provider, subject, decision and reason', () => {
    for (const field of ['route', 'provider', 'subject', 'decision', 'reason']) {
      expect(configYaml).toContain(`"${field}"`);
    }
    expect(configYaml).toContain('$sent_http_x_auth_provider');
    expect(configYaml).toContain('$sent_http_x_auth_subject');
    expect(configYaml).toContain('$sent_http_x_auth_decision');
    expect(configYaml).toContain('$sent_http_x_auth_reason');
  });

  test('each authenticated route sets the audit response headers on allow', () => {
    for (const provider of PROVIDERS) {
      const source = serverlessSource(provider);
      expect(source).toContain('set_header("X-Auth-Provider"');
      expect(source).toContain('set_header("X-Auth-Subject"');
      expect(source).toContain('set_header("X-Auth-Decision", "allow")');
      expect(source).toContain('set_header("X-Auth-Reason", "")');
    }
  });
});

describe('golden fixtures (A17)', () => {
  const me = JSON.parse(readFileSync(join(GATEWAY_DIR, 'fixtures', 'v1-me.json'), 'utf8'));
  const projects = JSON.parse(readFileSync(join(GATEWAY_DIR, 'fixtures', 'v1-projects.json'), 'utf8'));

  for (const provider of PROVIDERS) {
    test(`${provider}: the route serves every fixture project field`, () => {
      const source = serverlessSource(provider);
      for (const project of projects.projects) {
        expect(source).toContain(`id = "${project.id}"`);
        expect(source).toContain(`name = "${project.name}"`);
        expect(source).toContain(`status = "${project.status}"`);
      }
    });

    test(`${provider}: the me fixture matches the served constants and bindings`, () => {
      const source = serverlessSource(provider);
      expect(me.id).toMatch(/^usr_/);
      expect(source).toContain('id = "usr_" .. subject');
      expect(source).toContain('display_name = name');
      expect(source).toContain('email = email');
      expect(source).toContain(`organisation = "${me.organisation}"`);
      expect(source).toContain(`role = "${me.role}"`);
      for (const permission of me.permissions) expect(source).toContain(`"${permission}"`);
    });
  }
});

describe('fixture body routing (R1)', () => {
  test('the admin-only projects body is served only for a path ending with the policy route suffix', () => {
    const routes = JSON.parse(
      readFileSync(join(GATEWAY_DIR, '..', 'authz-service', 'authz', 'routes.json'), 'utf8')
    ) as { routes: { suffixes: Array<{ suffix: string; capability: string }> } };
    const projects = routes.routes.suffixes.find(route => route.capability === 'nav.api.projects');
    if (!projects) throw new Error('the policy route table has no nav.api.projects suffix');
    for (const provider of PROVIDERS) {
      const source = serverlessSource(provider);
      expect(source, provider).toContain(`string.find(path, "${projects.suffix}$")`);
      // An unanchored substring match would serve the body for a path the policy
      // classifies as the read fallback.
      expect(source, provider).not.toContain(`string.find(path, "${projects.suffix}", 1, true)`);
    }
  });
});

describe('capability retrieval routes (issue #3)', () => {
  for (const provider of PROVIDERS) {
    const route = capabilitiesRouteFor(provider);

    test(`${provider}: one exact capabilities route wins over the wildcard route`, () => {
      const matches = config.routes.filter(
        candidate => candidate.id === `${provider}-authz-capabilities`
      );
      expect(matches).toHaveLength(1);
      expect(route.uri).toBe(`/${provider}/authz/capabilities`);
      expect(route.priority).toBeGreaterThan(0);
    });

    test(`${provider}: the capabilities route authenticates the bearer`, () => {
      const oidc = route.plugins?.['openid-connect'] as Record<string, unknown> | undefined;
      expect(oidc?.bearer_only).toBe(true);
      expect(oidc?.use_jwks).toBe(true);
      const validator = oidc?.claim_validator as Record<string, unknown>;
      const issuers = validator.issuer as { valid_issuers: string[] };
      expect(issuers.valid_issuers).toHaveLength(1);
    });

    test(`${provider}: capability retrieval is not a resource authorization`, () => {
      expect(route.plugins?.opa).toBeUndefined();
    });

    test(`${provider}: transport plugins match the provider's v1 route`, () => {
      const v1 = routeFor(provider);
      for (const plugin of ['cors', 'limit-count', 'response-rewrite']) {
        expect(route.plugins?.[plugin], plugin).toEqual(v1.plugins?.[plugin]);
      }
    });

    test(`${provider}: the serverless function queries the provider's OPA wrapper`, () => {
      const source = capabilitiesServerlessSource(provider);
      expect(source).toContain(`/v1/data/authz/v1/gateway/${provider}`);
      expect(source).toContain('http://opa:8181');
      expect(source).toContain('result.capabilities');
    });

    test(`${provider}: the capabilities route rejects a wrong-audience token`, () => {
      const source = capabilitiesServerlessSource(provider);
      expect(source).toContain('result.reasons');
      expect(source).toContain('wrong_audience');
      expect(source).toContain('core.response.exit(401');
    });

    test(`${provider}: the route labels carry the same environment values`, () => {
      const v1 = routeFor(provider);
      expect(route.labels?.provider).toBe(provider);
      expect(route.labels?.audience).toBe(v1.labels?.audience);
      expect(route.labels?.tenant).toBe(v1.labels?.tenant);
      expect(route.labels?.hosted_domain).toBe(v1.labels?.hosted_domain);
    });
  }
});

interface ComposeService {
  image?: string;
  command?: string[];
  volumes?: string[];
  environment?: Record<string, string>;
  depends_on?: Record<string, { condition?: string }>;
  healthcheck?: { test?: string[] };
}

describe('OPA deployment', () => {
  const compose = parse(readFileSync(join(GATEWAY_DIR, 'docker-compose.yml'), 'utf8')) as {
    services: Record<string, ComposeService>;
  };
  const version = readFileSync(join(GATEWAY_DIR, '..', 'authz-service', 'VERSION'), 'utf8').trim();

  test('the opa container mounts no repository Rego', () => {
    const { command, volumes = [] } = compose.services.opa;
    expect(volumes.some(entry => entry.startsWith('./opa:'))).toBe(false);
    expect(volumes.some(entry => entry.startsWith('../authz-service/authz'))).toBe(false);
    expect(command ?? []).not.toContain('/policies');
    expect(command?.some(arg => arg === '/shared' || arg.startsWith('/shared'))).toBe(false);
  });

  test('the opa service runs in signed bundle mode', () => {
    const service = compose.services.opa;
    expect(service.image).toBe('openpolicyagent/opa:1.4.2-debug');
    const command = service.command ?? [];
    expect(command).toContain('--config-file=/config/config.yaml');
    expect(command).toContain('--bundle');
    expect(command).toContain('/bundles/combined.tar.gz');
    expect(command).toContain('--verification-key=/ephemeral/ephemeral.pub');
    expect(command).toContain('--signing-alg=ES256');
    expect(service.volumes).toContain('bundle-data:/bundles:ro');
    expect(service.volumes).toContain('bundle-key-data:/ephemeral:ro');
    expect(service.volumes).toContain('./opa/config.yaml:/config/config.yaml:ro');
    expect(service.depends_on?.['bundle-merge']?.condition).toBe('service_completed_successfully');
  });

  test('the bundle merge verifies the published bundle and adds the decision-log mask', () => {
    const service = compose.services['bundle-merge'];
    expect(service).toBeDefined();
    expect(service.image).toBe('openpolicyagent/opa:1.4.2-debug');
    const command = service.command ?? [];
    expect(command).toContain('/bundles/authz-service/dist/authz-bundle.tar.gz');
    expect(command).toContain('/keys/bundle-signing.pub');
    expect(command).toContain('/mask/mask.rego');
    expect(service.volumes).toContain(
      '../authz-service/keys/bundle-signing.pub:/keys/bundle-signing.pub:ro'
    );
    expect(service.volumes).toContain('./opa/mask.rego:/mask/mask.rego:ro');
    expect(service.depends_on?.['bundle-fetch']?.condition).toBe('service_completed_successfully');
    expect(service.depends_on?.['bundle-key']?.condition).toBe('service_completed_successfully');
  });

  test('the re-signing key is generated, never committed', () => {
    const service = compose.services['bundle-key'];
    expect(service).toBeDefined();
    expect(service.image).toBe('oven/bun:1');
    expect(service.volumes).toContain('bundle-key-data:/ephemeral');
    expect(service.volumes?.some(volume => volume.includes('ephemeral.pem'))).toBe(false);
  });

  test('the bundle fetch pulls the version the repository publishes', () => {
    const service = compose.services['bundle-fetch'];
    expect(service).toBeDefined();
    expect(service.image).toBe('ghcr.io/oras-project/oras:v1.2.0');
    const ref = (service.command ?? []).find(argument => argument.startsWith('ghcr.io/'));
    expect(ref).toBe(`ghcr.io/oparish1/opa-service/authz-bundle:${version}`);
  });

  test('the opa healthcheck gates the stack on bundle activation', () => {
    const test = compose.services.opa.healthcheck?.test ?? [];
    expect(test.some(argument => argument.includes('/health?bundles=true'))).toBe(true);
    expect(compose.services.apisix.depends_on?.opa?.condition).toBe('service_healthy');
  });

  test('decision logs are enabled to the console and masked', () => {
    const deployed = parse(readFileSync(join(GATEWAY_DIR, 'opa', 'config.yaml'), 'utf8')) as {
      decision_logs?: { console?: boolean; mask_decision?: string };
    };
    expect(deployed.decision_logs?.console).toBe(true);
    expect(deployed.decision_logs?.mask_decision).toBe('/system/log/mask');
  });

  test('the decision-log mask erases the token and the matched route config', () => {
    const mask = readFileSync(join(GATEWAY_DIR, 'opa', 'mask.rego'), 'utf8');
    expect(mask).toContain('/input/request/headers/authorization');
    expect(mask).toContain('/input/route/plugins');
  });

  test('the opa plugin scheme matches the transport the opa service serves (A15, GW-7)', () => {
    const command = compose.services.opa.command ?? [];
    const tlsEnabled = command.some(arg => arg.startsWith('--tls'));
    const expected = tlsEnabled ? 'https://opa:8181' : 'http://opa:8181';
    for (const provider of PROVIDERS) {
      const opa = routeFor(provider).plugins?.opa as Record<string, unknown> | undefined;
      expect(opa?.host, provider).toBe(expected);
    }
  });

  test('container-to-container discovery and issuer URLs match the plaintext test issuers', () => {
    const apisixEnv = compose.services.apisix.environment ?? {};
    const issuerServices = PROVIDERS.map(provider => `${provider}-issuer`);
    const issuerHosts = new Set(issuerServices);
    for (const [name, value] of Object.entries(apisixEnv)) {
      if (!/_DISCOVERY$|_ISSUER$/.test(name)) continue;
      if (!issuerHosts.has(new URL(value).hostname)) continue;
      expect(value.startsWith('http://'), name).toBe(true);
    }
    // The test issuers publish discovery through a plain Bun.serve with no tls
    // option, so their advertised origin must be plaintext too.
    for (const service of issuerServices) {
      const origin = compose.services[service].environment?.ISSUER_ORIGIN;
      expect(origin, service).toBeDefined();
      expect(origin?.startsWith('http://'), service).toBe(true);
    }
  });
});

describe('provider isolation (A21)', () => {
  test('only the exempt registries name more than one provider', () => {
    expect(findProviderIsolationViolations(join(GATEWAY_DIR, '..'))).toEqual([]);
  });
});

describe('secrets stay out of the route file (A18, GW-1, SD-11)', () => {
  test('every credential-shaped value is an environment reference', () => {
    expect(routeFile).not.toMatch(/-----BEGIN/);
    expect(routeFile).not.toMatch(/client_secret:\s*["']?[A-Za-z0-9+/]{16,}/);
    for (const [name, value] of credentials) {
      expect(routeFile).not.toContain(value);
      expect(routeFile).toContain(`\${{${name}}}`);
    }
  });

  test('the README records the placeholder-secret rule', () => {
    const readme = readFileSync(join(GATEWAY_DIR, 'README.md'), 'utf8');
    expect(readme).toContain('no secret');
  });
});
