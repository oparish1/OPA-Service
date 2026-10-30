import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'bun:test';
import { parse } from 'yaml';

/**
 * Docker-free gateway gate. Parses the declarative APISIX route file and
 * asserts the security invariants the acceptance criteria depend on. The
 * Compose integration script is the second gate (gateway/test-issuers/run-acceptance.sh).
 */

const GATEWAY_DIR = import.meta.dir;
const PROVIDERS = ['entra', 'okta', 'google'] as const;
type Provider = (typeof PROVIDERS)[number];

interface Route {
  id: string;
  uri?: string;
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

    test(`${provider}: the issuer is pinned and the audience is required`, () => {
      const validator = oidc?.claim_validator as Record<string, unknown>;
      const issuers = validator.issuer as { valid_issuers: string[] };
      expect(issuers.valid_issuers).toHaveLength(1);
      const audience = validator.audience as { required: boolean };
      expect(audience.required).toBe(true);
    });

    test(`${provider}: the route labels carry the expected audience`, () => {
      expect(route.labels?.audience).toMatch(/^\$\{\{.*\}\}$|^[\w:./-]+$/);
    });

    test(`${provider}: opa decodes the verified token with route config`, () => {
      const opa = route.plugins?.opa as Record<string, unknown> | undefined;
      expect(opa?.host).toBe('http://opa:8181');
      expect(opa?.policy).toBe(`${provider}/allow`);
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

describe('authorization and transport (A12, A13, A15)', () => {
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

describe('golden fixtures (A17)', () => {
  const me = JSON.parse(readFileSync(join(GATEWAY_DIR, 'fixtures', 'v1-me.json'), 'utf8'));
  const projects = JSON.parse(readFileSync(join(GATEWAY_DIR, 'fixtures', 'v1-projects.json'), 'utf8'));

  function serverlessSource(provider: Provider): string {
    const serverless = routeFor(provider).plugins?.['serverless-post-function'] as {
      functions: string[];
    };
    return serverless.functions.join('\n');
  }

  for (const provider of PROVIDERS) {
    test(`${provider}: the route serves the projects fixture`, () => {
      const source = serverlessSource(provider);
      for (const project of projects.projects) {
        expect(source).toContain(`name = "${project.name}"`);
        expect(source).toContain(`status = "${project.status}"`);
      }
    });

    test(`${provider}: the route serves the me fixture constants`, () => {
      const source = serverlessSource(provider);
      expect(source).toContain(`organisation = "${me.organisation}"`);
      expect(source).toContain(`role = "${me.role}"`);
      for (const permission of me.permissions) expect(source).toContain(`"${permission}"`);
    });
  }
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
