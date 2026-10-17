import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/app';
import type { BuiltApp } from '../../src/app';
import { loadConfig } from '../../src/config';
import { Store } from '../../src/db';
import type { TestIdp } from './idp';

export const TEST_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64');

export function testEnv(
  overrides: Record<string, string | undefined> = {}
): Record<string, string | undefined> {
  return {
    NODE_ENV: 'test',
    DATABASE_URL: ':memory:',
    ENTRA_TENANT_ID: 'tenant-1',
    ENTRA_CLIENT_ID: 'client-1',
    ENTRA_CLIENT_SECRET: 'secret-1',
    SESSION_SECRET: 'session-secret-value',
    TOKEN_ENCRYPTION_KEY: TEST_ENCRYPTION_KEY,
    ALLOW_INSECURE_ISSUER: 'true',
    LOG_LEVEL: 'warn',
    ...overrides,
  };
}

export interface Harness extends BuiltApp {
  store: Store;
  config: BuiltApp['services']['config'];
}

export interface HarnessIdps {
  idp: TestIdp;
  oktaIdp?: TestIdp;
  googleIdp?: TestIdp;
}

function providerEnv(options: HarnessIdps): Record<string, string | undefined> {
  const env: Record<string, string | undefined> = { ENTRA_ISSUER: options.idp.origin };
  if (options.oktaIdp) {
    Object.assign(env, {
      OKTA_ENABLED: 'true',
      OKTA_ISSUER: options.oktaIdp.origin,
      OKTA_CLIENT_ID: 'okta-client',
      OKTA_CLIENT_SECRET: 'okta-secret',
      OKTA_REQUIRED_GROUP: 'Workspace User',
      OKTA_API_AUDIENCE: 'api://default',
    });
  }
  if (options.googleIdp) {
    Object.assign(env, {
      GOOGLE_ENABLED: 'true',
      GOOGLE_ISSUER: options.googleIdp.origin,
      GOOGLE_CLIENT_ID: 'google-client',
      GOOGLE_CLIENT_SECRET: 'google-secret',
      GOOGLE_HOSTED_DOMAIN: 'agentic-advantage.com',
    });
  }
  return env;
}

export async function createHarness(options: {
  idp: TestIdp;
  oktaIdp?: TestIdp;
  googleIdp?: TestIdp;
  env?: Record<string, string | undefined>;
  loggerStream?: { write(message: string): void };
}): Promise<Harness> {
  const config = loadConfig(testEnv({ ...providerEnv(options), ...options.env }));
  const store = new Store(':memory:');
  store.migrate();
  const built = await buildApp({ config, store, loggerStream: options.loggerStream });
  return { ...built, store, config };
}

export interface LoginStart {
  state: string;
  nonce: string;
  location: URL;
  ltxName: string;
  ltxValue: string;
}

export async function beginLogin(app: FastifyInstance, loginPath = '/auth/login'): Promise<LoginStart> {
  const response = await app.inject({ method: 'GET', url: loginPath });
  if (response.statusCode !== 302) throw new Error(`login did not redirect: ${response.statusCode}`);
  const location = new URL(response.headers.location as string);
  const ltx = response.cookies.find(cookie => cookie.name.includes('aa_ltx'));
  if (!ltx) throw new Error('login transaction cookie missing');
  return {
    state: location.searchParams.get('state') as string,
    nonce: location.searchParams.get('nonce') as string,
    location,
    ltxName: ltx.name,
    ltxValue: ltx.value,
  };
}

export async function completeLogin(
  app: FastifyInstance,
  idp: TestIdp,
  paths: { loginPath?: string; callbackPath?: string } = {}
): Promise<{ response: Awaited<ReturnType<FastifyInstance['inject']>>; start: LoginStart }> {
  const start = await beginLogin(app, paths.loginPath ?? '/auth/login');
  const code = idp.makeCode(start.nonce);
  const callbackPath = paths.callbackPath ?? '/auth/callback';
  const response = await app.inject({
    method: 'GET',
    url: `${callbackPath}?code=${code}&state=${encodeURIComponent(start.state)}`,
    cookies: { [start.ltxName]: start.ltxValue },
  });
  return { response, start };
}

export function sessionCookie(
  response: Awaited<ReturnType<FastifyInstance['inject']>>
): { name: string; value: string } {
  const cookie = response.cookies.find(entry => entry.name.includes('aa_session'));
  if (!cookie) throw new Error('session cookie missing');
  return { name: cookie.name, value: cookie.value };
}

/** The server-side session id behind a signed `aa_session` cookie value. */
export function sessionIdOf(
  app: FastifyInstance,
  cookie: { value: string }
): string {
  const unsigned = app.unsignCookie(cookie.value);
  if (!unsigned.valid) throw new Error('session cookie is not validly signed');
  return unsigned.value;
}

export async function sessionCsrf(
  app: FastifyInstance,
  cookie: { name: string; value: string }
): Promise<string> {
  const response = await app.inject({
    method: 'GET',
    url: '/api/session',
    cookies: { [cookie.name]: cookie.value },
  });
  if (response.statusCode !== 200) throw new Error(`session fetch failed: ${response.statusCode}`);
  return (response.json() as { csrfToken: string }).csrfToken;
}
