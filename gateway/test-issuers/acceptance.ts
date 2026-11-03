/**
 * End-to-end gateway acceptance (A9–A17) against the Docker Compose stack and
 * the local test issuers. Run with:
 *
 *   docker compose -f gateway/docker-compose.yml up -d
 *   bun run gateway/test-issuers/acceptance.ts
 *
 * It never calls a real identity provider, and it is the second gateway gate
 * after the Docker-free `bun test gateway` / `opa test gateway/opa`.
 */

const GATEWAY = process.env.GATEWAY_URL ?? 'https://localhost:9080';
const APP_ORIGIN = process.env.APP_ORIGIN ?? 'https://localhost:5173';
const ISSUERS = {
  entra: process.env.ENTRA_ISSUER_URL ?? 'https://localhost:8090',
  okta: process.env.OKTA_ISSUER_URL ?? 'https://localhost:8091',
  google: process.env.GOOGLE_ISSUER_URL ?? 'https://localhost:8092',
} as const;

type Provider = keyof typeof ISSUERS;
type Claims = Record<string, unknown>;

let failures = 0;

function check(name: string, condition: boolean): void {
  if (condition) {
    console.log(`  ok   ${name}`);
  } else {
    failures += 1;
    console.error(`  FAIL ${name}`);
  }
}

async function mint(provider: Provider, options: Record<string, unknown> = {}): Promise<string> {
  const response = await fetch(`${ISSUERS[provider]}/mint`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(options),
  });
  const payload = (await response.json()) as { token: string };
  return payload.token;
}

async function call(
  provider: Provider,
  path: string,
  token: string | null,
  init: RequestInit = {}
): Promise<Response> {
  return fetch(`${GATEWAY}/${provider}${path}`, {
    ...init,
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(init.headers ?? {}),
    },
  });
}

const neutralMe = {
  sub: 'subject-default',
  name: 'Orlando Parish',
  email: 'orlando.parish@agentic-advantage.example',
};

async function main(): Promise<void> {
  for (const provider of Object.keys(ISSUERS) as Provider[]) {
    const valid = await mint(provider, { claims: neutralMe });

    console.log(`A9 ${provider}: valid and invalid tokens`);
    check(`${provider} valid token`, (await call(provider, '/v1/me', valid)).status === 200);
    check(`${provider} no token`, (await call(provider, '/v1/me', null)).status === 401);
    check(
      `${provider} bad signature`,
      (await call(provider, '/v1/me', await mint(provider, { tamper: true }))).status === 401
    );
    check(
      `${provider} unknown key`,
      (await call(provider, '/v1/me', await mint(provider, { key: 'unknown' }))).status === 401
    );
    check(
      `${provider} wrong algorithm`,
      (await call(provider, '/v1/me', await mint(provider, { alg: 'none' }))).status === 401
    );
    check(
      `${provider} wrong issuer`,
      (await call(provider, '/v1/me', await mint(provider, { claims: { iss: 'https://evil.example' } }))).status === 401
    );
    check(
      `${provider} expired`,
      (await call(provider, '/v1/me', await mint(provider, { claims: { exp: 1 } }))).status === 401
    );
    check(
      `${provider} not yet valid`,
      (await call(provider, '/v1/me', await mint(provider, { claims: { nbf: 9999999999 } }))).status === 401
    );

    console.log(`A17 ${provider}: golden bodies`);
    const me = await call(provider, '/v1/me', valid);
    const meBody = (await me.json()) as { id: string; permissions: string[] };
    check(
      `${provider} /v1/me body`,
      meBody.id === 'usr_subject-default' && meBody.permissions.includes('workspace:read')
    );
    const projects = await call(provider, '/v1/projects', valid);
    const body = (await projects.json()) as { projects: unknown[] };
    check(`${provider} /v1/projects body`, body.projects.length === 3);
  }

  console.log('A10 issuer confusion');
  const entra = await mint('entra', { claims: neutralMe });
  const okta = await mint('okta', { claims: neutralMe });
  const google = await mint('google', { claims: neutralMe });
  check('entra token on okta route', (await call('okta', '/v1/me', entra)).status === 401);
  check('okta token on entra route', (await call('entra', '/v1/me', okta)).status === 401);
  check('google token on entra route', (await call('entra', '/v1/me', google)).status === 401);
  check('entra token on google route', (await call('google', '/v1/me', entra)).status === 401);

  console.log('A11 claim gates');
  check(
    'entra without Workspace.User',
    (await call('entra', '/v1/me', await mint('entra', { claims: { ...neutralMe, roles: [] } }))).status === 403
  );
  check(
    'okta without Workspace User',
    (await call('okta', '/v1/me', await mint('okta', { claims: { ...neutralMe, groups: [] } }))).status === 403
  );
  check(
    'google with wrong hd',
    (await call('google', '/v1/me', await mint('google', { claims: { ...neutralMe, hd: 'other.example' } }))).status === 403
  );
  check(
    'google with email_verified false',
    (await call('google', '/v1/me', await mint('google', { claims: { ...neutralMe, email_verified: false } }))).status === 403
  );

  console.log('A12 scopes');
  check('entra read can GET', (await call('entra', '/v1/me', entra)).status === 200);
  check(
    'entra read cannot POST',
    (await call('entra', '/v1/test', await mint('entra', { claims: { ...neutralMe, scp: 'workspace:read' } }), { method: 'POST' })).status === 403
  );
  check(
    'entra write can POST',
    (await call('entra', '/v1/test', await mint('entra', { claims: { ...neutralMe, scp: 'workspace:write' } }), { method: 'POST' })).status === 200
  );
  check(
    'entra no scope is rejected',
    (await call('entra', '/v1/me', await mint('entra', { claims: { ...neutralMe, scp: '' } }))).status === 403
  );
  check(
    'okta array scopes can GET',
    (await call('okta', '/v1/me', await mint('okta', { claims: { ...neutralMe, scp: ['workspace:read'] } }))).status === 200
  );

  console.log('A13 google read-only');
  check('google POST is forbidden', (await call('google', '/v1/test', google, { method: 'POST' })).status === 403);

  console.log('A14 client headers are overwritten');
  const spoof = await call('entra', '/v1/me', entra, { headers: { 'X-User-Subject': 'attacker' } });
  const spoofBody = (await spoof.json()) as { id: string };
  check('client X-User-* is ignored', spoofBody.id !== 'usr_attacker');

  console.log('A15 CORS');
  const preflight = await fetch(`${GATEWAY}/entra/v1/me`, {
    method: 'OPTIONS',
    headers: { origin: APP_ORIGIN, 'access-control-request-method': 'GET' },
  });
  check('allowed origin preflight', preflight.headers.get('access-control-allow-origin') === APP_ORIGIN);
  const denied = await fetch(`${GATEWAY}/entra/v1/me`, {
    method: 'OPTIONS',
    headers: { origin: 'https://evil.example', 'access-control-request-method': 'GET' },
  });
  check('other origin preflight', denied.headers.get('access-control-allow-origin') === null);

  console.log('A16 rate limit and disabled route');
  let limited = false;
  for (let i = 0; i < 25; i += 1) {
    if ((await call('entra', '/v1/me', entra)).status === 429) limited = true;
  }
  check('rate limit triggers (429)', limited);
  check('disabled provider route 404', (await fetch(`${GATEWAY}/disabled/v1/me`)).status === 404);
}

await main();
if (failures > 0) {
  console.error(`\n${failures} acceptance check(s) failed`);
  process.exit(1);
}
console.log('\nAll gateway acceptance checks passed');
