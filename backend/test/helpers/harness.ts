import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/core/app';
import type { BuiltApp } from '../../src/core/app';
import { createConfig } from '../../src/core/config';
import { Store } from '../../src/core/db';
import type { ProviderModule } from '../../src/core/provider';
import { testProviderEnv, testProviderModule } from '../../src/core/testing';
import type { TestIdp } from '../../src/core/testing';

export const TEST_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64');

export function testEnv(
  overrides: Record<string, string | undefined> = {}
): Record<string, string | undefined> {
  return {
    NODE_ENV: 'test',
    DATABASE_URL: ':memory:',
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

export async function createHarness(options: {
  modules: readonly ProviderModule[];
  env?: Record<string, string | undefined>;
  loggerStream?: { write(message: string): void };
}): Promise<Harness> {
  const config = createConfig(testEnv(options.env), options.modules);
  const store = new Store(':memory:');
  store.migrate();
  const built = await buildApp({
    config,
    store,
    modules: options.modules,
    loggerStream: options.loggerStream,
  });
  return { ...built, store, config };
}

/**
 * Core harness: composes the neutral test provider plus any extra modules and
 * derives the test provider env from its local issuer. Provider tests add
 * their own module and env on top so no core test names a real provider.
 */
export async function createTestHarness(options: {
  idp: TestIdp;
  extraModules?: readonly ProviderModule[];
  env?: Record<string, string | undefined>;
  loggerStream?: { write(message: string): void };
}): Promise<Harness> {
  return createHarness({
    modules: [testProviderModule, ...(options.extraModules ?? [])],
    env: { ...testProviderEnv(options.idp), ...options.env },
    loggerStream: options.loggerStream,
  });
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
