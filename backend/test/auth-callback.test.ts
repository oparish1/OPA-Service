import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { hashCookieValue } from '../src/core/auth/session';
import { completeLogin, createTestHarness, beginLogin, sessionCookie } from './helpers/harness';
import type { Harness } from './helpers/harness';
import { createTestIdp, testProviderModule } from '../src/core/testing';
import type { TestIdp } from '../src/core/testing';

let idp: TestIdp;
let harness: Harness;

beforeEach(async () => {
  idp = createTestIdp();
  await idp.start();
  harness = await createTestHarness({ idp });
});

afterEach(async () => {
  await harness.app.close();
  harness.store.close();
  idp.stop();
});

function refuseCount(): number {
  return harness.store.listAuditEvents().filter(event => event.event === 'login.refused').length;
}

function lastRefusalReason(): string | null | undefined {
  const refused = harness.store
    .listAuditEvents()
    .filter(event => event.event === 'login.refused');
  return refused[refused.length - 1]?.reason;
}

function insertTransaction(
  state: string,
  ltxValue: string,
  overrides: Partial<{ codeVerifierEnc: string; expiresAt: number; nonce: string; provider: string }> = {}
): void {
  harness.store.createLoginTransaction({
    state,
    cookieHash: hashCookieValue(ltxValue),
    nonce: overrides.nonce ?? 'custom-nonce',
    codeVerifierEnc: harness.services.cipher.seal('custom-verifier'),
    returnTo: '/',
    provider: testProviderModule.id,
    createdAt: Date.now(),
    expiresAt: Date.now() + 60_000,
    ...overrides,
  });
}

describe('callback happy path (A5, A6)', () => {
  it('creates the user on first sign-in and issues a fresh session cookie', async () => {
    const { response } = await completeLogin(harness.app, idp);
    expect(response.statusCode).toBe(302);
    expect(response.headers.location).toBe('/');
    expect(harness.store.countUsers()).toBe(1);
    const cookie = sessionCookie(response);
    expect(cookie.value).toBeTruthy();
  });

  it('regenerates the session id rather than reusing a pre-login id', async () => {
    const start = await beginLogin(harness.app);
    const code = idp.makeCode(start.nonce);
    const response = await harness.app.inject({
      method: 'GET',
      url: `/auth/callback?code=${code}&state=${encodeURIComponent(start.state)}`,
      cookies: { [start.ltxName]: start.ltxValue, aa_session: 'attacker-fixed-session-id' },
    });
    const cookie = sessionCookie(response);
    expect(cookie.value).not.toBe('attacker-fixed-session-id');
    expect(harness.store.getSession('attacker-fixed-session-id')).toBeNull();
  });

  it('reuses the user row on a second sign-in and separates subjects that share an email', async () => {
    await completeLogin(harness.app, idp);
    const first = harness.store.countUsers();
    await completeLogin(harness.app, idp);
    expect(harness.store.countUsers()).toBe(first);

    idp.behavior.claims = {
      sub: 'subject-second',
      email: 'orlando.parish@agentic-advantage.example',
    };
    await completeLogin(harness.app, idp);
    expect(harness.store.countUsers()).toBe(2);
  });

  it('marks the session cookie Host-only, HttpOnly, Secure and Path=/ in production', async () => {
    const secureIdp = createTestIdp();
    await secureIdp.start();
    const secureHarness = await createTestHarness({
      idp: secureIdp,
      env: { COOKIE_SECURE: 'true', NODE_ENV: 'production', DATABASE_URL: '/tmp/archon-identity-test.db' },
    });
    try {
      const { response } = await completeLogin(secureHarness.app, secureIdp);
      const raw = ([] as string[]).concat(response.headers['set-cookie'] ?? []);
      const sessionHeader = raw.find(header => header.startsWith('__Host-aa_session'));
      expect(sessionHeader).toContain('HttpOnly');
      expect(sessionHeader).toContain('Secure');
      expect(sessionHeader).toContain('Path=/');
      expect(sessionHeader).toContain('SameSite=Lax');
      expect(sessionHeader).not.toContain('Domain=');
      expect(sessionHeader).toContain('Max-Age=');
    } finally {
      await secureHarness.app.close();
      secureHarness.store.close();
      secureIdp.stop();
    }
  });
});

describe('callback rejects bad login transactions (A2)', () => {
  it('rejects a missing state', async () => {
    const response = await harness.app.inject({ method: 'GET', url: '/auth/callback?code=abc' });
    expect(response.headers.location).toBe(`${harness.config.publicBaseUrl}/?error=signin`);
    expect(refuseCount()).toBe(1);
  });

  it('rejects a mismatched state', async () => {
    const response = await harness.app.inject({
      method: 'GET',
      url: '/auth/callback?code=abc&state=unknown',
    });
    expect(sessionCookieOptional(response)).toBeUndefined();
    expect(refuseCount()).toBe(1);
  });

  it('rejects a reused state', async () => {
    const { response, start } = await completeLogin(harness.app, idp);
    expect(response.statusCode).toBe(302);
    const replay = await harness.app.inject({
      method: 'GET',
      url: `/auth/callback?code=${idp.makeCode(start.nonce)}&state=${encodeURIComponent(start.state)}`,
      cookies: { [start.ltxName]: start.ltxValue },
    });
    expect(replay.headers.location).toBe(`${harness.config.publicBaseUrl}/?error=signin`);
    expect(refuseCount()).toBe(1);
  });

  it('rejects a transaction without a PKCE verifier', async () => {
    const state = 'no-pkce-state';
    const ltx = 'no-pkce-ltx';
    harness.store.createLoginTransaction({
      state,
      cookieHash: hashCookieValue(ltx),
      nonce: 'nonce',
      codeVerifierEnc: '',
      returnTo: '/',
      provider: testProviderModule.id,
      createdAt: Date.now(),
      expiresAt: Date.now() + 60_000,
    });
    const response = await harness.app.inject({
      method: 'GET',
      url: `/auth/callback?code=${idp.makeCode('nonce')}&state=${state}`,
      cookies: { [harness.services.session.loginTransactionCookieName()]: ltx },
    });
    expect(response.headers.location).toBe(`${harness.config.publicBaseUrl}/?error=signin`);
    expect(refuseCount()).toBe(1);
    expect(lastRefusalReason()).toBe('missing_pkce');
  });

  it('rejects an expired transaction', async () => {
    const state = 'expired-state';
    const ltx = 'expired-ltx';
    insertTransaction(state, ltx, { expiresAt: Date.now() - 1 });
    const response = await harness.app.inject({
      method: 'GET',
      url: `/auth/callback?code=${idp.makeCode('custom-nonce')}&state=${state}`,
      cookies: { [harness.services.session.loginTransactionCookieName()]: ltx },
    });
    expect(response.headers.location).toBe(`${harness.config.publicBaseUrl}/?error=signin`);
    expect(refuseCount()).toBe(1);
    expect(lastRefusalReason()).toBe('expired_transaction');
  });

  it('rejects a mismatched login-transaction cookie', async () => {
    const start = await beginLogin(harness.app);
    const response = await harness.app.inject({
      method: 'GET',
      url: `/auth/callback?code=${idp.makeCode(start.nonce)}&state=${encodeURIComponent(start.state)}`,
      cookies: { [start.ltxName]: 'a-different-cookie-value' },
    });
    expect(response.headers.location).toBe(`${harness.config.publicBaseUrl}/?error=signin`);
    expect(refuseCount()).toBe(1);
  });
});

describe('callback rejects bad ID tokens (A3)', () => {
  const cases: Array<[string, () => void]> = [
    ['bad signature', () => (idp.behavior.signWithUnknownKey = true)],
    ['wrong issuer', () => (idp.behavior.claims = { iss: 'https://evil.example' })],
    ['wrong audience', () => (idp.behavior.claims = { aud: 'other-client' })],
    [
      'expired token',
      () => (idp.behavior.claims = { exp: Math.floor(Date.now() / 1000) - 30 }),
    ],
    ['wrong nonce', () => (idp.behavior.claims = { nonce: 'not-the-nonce' })],
  ];

  for (const [label, arrange] of cases) {
    it(`rejects a ${label}`, async () => {
      arrange();
      const { response } = await completeLogin(harness.app, idp);
      expect(response.headers.location).toBe(`${harness.config.publicBaseUrl}/?error=signin`);
      expect(sessionCookieOptional(response)).toBeUndefined();
      expect(refuseCount()).toBe(1);
    });
  }
});

function sessionCookieOptional(response: { cookies: Array<{ name: string; value: string }> }) {
  return response.cookies.find(entry => entry.name.includes('aa_session'));
}
