import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import {
  beginLogin,
  completeLogin,
  createHarness,
  sessionCookie,
  sessionCsrf,
  sessionIdOf,
} from './helpers/harness';
import type { Harness } from './helpers/harness';
import { TestIdp } from './helpers/idp';

let entra: TestIdp;
let okta: TestIdp;
let harness: Harness;

const OKTA_PATHS = { loginPath: '/auth/login/okta', callbackPath: '/auth/callback/okta' };

beforeEach(async () => {
  entra = new TestIdp({ tenantId: 'tenant-1', clientId: 'client-1' });
  okta = new TestIdp({
    tenantId: 'tenant-1',
    clientId: 'okta-client',
    kind: 'okta',
    apiAudience: 'api://default',
    requiredGroup: 'Workspace User',
  });
  await entra.start();
  await okta.start();
  harness = await createHarness({ idp: entra, oktaIdp: okta });
});

afterEach(async () => {
  await harness.app.close();
  harness.store.close();
  entra.stop();
  okta.stop();
});

function refusedReasons(): string[] {
  return harness.store
    .listAuditEvents()
    .filter(event => event.event === 'login.refused')
    .map(event => event.reason ?? '');
}

describe('Okta login and callback (B1, B2, B4, B8)', () => {
  it('redirects to the discovered Okta authorize endpoint with the Okta callback path', async () => {
    const start = await beginLogin(harness.app, '/auth/login/okta');
    expect(start.location.origin).toBe(okta.origin);
    expect(start.location.searchParams.get('response_type')).toBe('code');
    expect(start.location.searchParams.get('code_challenge_method')).toBe('S256');
    expect(start.location.searchParams.get('state')).toBeTruthy();
    expect(start.location.searchParams.get('nonce')).toBeTruthy();
    expect(start.location.searchParams.get('redirect_uri')).toBe(
      `${harness.config.publicBaseUrl}/auth/callback/okta`
    );
    const event = harness.store.listAuditEvents().find(row => row.event === 'login.start');
    expect(event?.actorProvider).toBe('okta');
  });

  it('creates an Okta user on first sign-in and reuses it on the next', async () => {
    const first = await completeLogin(harness.app, okta, OKTA_PATHS);
    expect(first.response.statusCode).toBe(302);
    expect(harness.store.countUsers()).toBe(1);
    const user = harness.store.getUserByIdentity('okta', okta.origin, 'okta-user-1');
    expect(user?.provider).toBe('okta');
    expect(user?.subject).toBe('okta-user-1');

    await completeLogin(harness.app, okta, OKTA_PATHS);
    expect(harness.store.countUsers()).toBe(1);
  });

  it('keys accounts by provider so the same email across Entra and Okta is two users', async () => {
    await completeLogin(harness.app, entra);
    await completeLogin(harness.app, okta, OKTA_PATHS);
    expect(harness.store.countUsers()).toBe(2);
  });

  it('separates two Okta users that share an email', async () => {
    await completeLogin(harness.app, okta, OKTA_PATHS);
    okta.behavior.claims = { sub: 'okta-user-2' };
    await completeLogin(harness.app, okta, OKTA_PATHS);
    expect(harness.store.countUsers()).toBe(2);
  });

  it('refuses a callback whose transaction belongs to Entra', async () => {
    const start = await beginLogin(harness.app);
    const response = await harness.app.inject({
      method: 'GET',
      url: `/auth/callback/okta?code=${okta.makeCode(start.nonce)}&state=${encodeURIComponent(start.state)}`,
      cookies: { [start.ltxName]: start.ltxValue },
    });
    expect(response.headers.location).toBe(`${harness.config.publicBaseUrl}/?error=signin`);
    expect(refusedReasons()).toContain('provider_mismatch');
  });

  const badTokens: Array<[string, () => void]> = [
    ['a bad signature', () => (okta.behavior.signWithUnknownKey = true)],
    ['a wrong issuer', () => (okta.behavior.claims = { iss: 'https://evil.example' })],
    ['the org issuer', () => (okta.behavior.claims = { iss: `${okta.origin}/` })],
    ['a wrong audience', () => (okta.behavior.claims = { aud: 'other-client' })],
    ['an expired token', () => (okta.behavior.claims = { exp: Math.floor(Date.now() / 1000) - 3600 })],
    ['a mismatched nonce', () => (okta.behavior.claims = { nonce: 'wrong-nonce' })],
  ];
  for (const [label, mutate] of badTokens) {
    it(`rejects ${label}`, async () => {
      mutate();
      const { response } = await completeLogin(harness.app, okta, OKTA_PATHS);
      expect(response.headers.location).toBe(`${harness.config.publicBaseUrl}/?error=signin`);
      expect(harness.store.countUsers()).toBe(0);
    });
  }
});

describe('Okta group gating (B5)', () => {
  it('refuses a valid token without the required group and creates no user', async () => {
    okta.behavior.claims = { groups: ['Some Other Group'] };
    const { response } = await completeLogin(harness.app, okta, OKTA_PATHS);
    expect(response.headers.location).toBe(`${harness.config.publicBaseUrl}/?error=signin`);
    expect(refusedReasons()).toContain('no_group');
    expect(harness.store.countUsers()).toBe(0);
  });

  it('refuses a token with no groups claim at all', async () => {
    okta.behavior.claims = { groups: undefined };
    const { response } = await completeLogin(harness.app, okta, OKTA_PATHS);
    expect(response.headers.location).toBe(`${harness.config.publicBaseUrl}/?error=signin`);
    expect(refusedReasons()).toContain('no_group');
  });
});

describe('Okta session lifecycle (B14, B15, B16, B17, B18)', () => {
  async function signInOkta() {
    const { response } = await completeLogin(harness.app, okta, OKTA_PATHS);
    const cookie = sessionCookie(response);
    const csrf = await sessionCsrf(harness.app, cookie);
    return { cookie, csrf };
  }

  it('reports the session provider, issuer and Okta refresh policy', async () => {
    const { cookie } = await signInOkta();
    const response = await harness.app.inject({
      method: 'GET',
      url: '/api/session',
      cookies: { [cookie.name]: cookie.value },
    });
    const body = response.json() as {
      provider: string;
      issuer: string;
      refreshToken: { grant: string; expiresAt: string };
    };
    expect(body.provider).toBe('Okta');
    expect(body.issuer).toBe(okta.origin);
    expect(body.refreshToken.grant).toBe('Rotating refresh token · up to 8 hours');
    expect(body.refreshToken.expiresAt).toBe('Per provider policy');
  });

  it('rotates the stored refresh token on refresh', async () => {
    const { cookie, csrf } = await signInOkta();
    const sessionId = sessionIdOf(harness.app, cookie);
    const before = harness.store.getTokens(sessionId);
    const refresh = await harness.app.inject({
      method: 'POST',
      url: '/api/session/refresh',
      cookies: { [cookie.name]: cookie.value },
      headers: { 'x-csrf-token': csrf, origin: harness.config.allowedOrigin },
    });
    expect(refresh.statusCode).toBe(200);
    const after = harness.store.getTokens(sessionId);
    expect(harness.services.cipher.open(after?.refreshTokenEnc ?? '')).toBe('refresh-token-2');
    expect(after?.refreshTokenEnc).not.toBe(before?.refreshTokenEnc);
  });

  it('serialises concurrent refreshes so Okta reuse detection is never triggered', async () => {
    const { cookie, csrf } = await signInOkta();
    const headers = { 'x-csrf-token': csrf, origin: harness.config.allowedOrigin };
    const [first, second] = await Promise.all([
      harness.app.inject({
        method: 'POST',
        url: '/api/session/refresh',
        cookies: { [cookie.name]: cookie.value },
        headers,
      }),
      harness.app.inject({
        method: 'POST',
        url: '/api/session/refresh',
        cookies: { [cookie.name]: cookie.value },
        headers,
      }),
    ]);
    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(200);
    expect(okta.revokeCount).toBe(0);
    const sessionId = sessionIdOf(harness.app, cookie);
    expect(harness.services.cipher.open(harness.store.getTokens(sessionId)?.refreshTokenEnc ?? '')).toBe(
      'refresh-token-3'
    );
  });

  it('ends the session on invalid_grant', async () => {
    const { cookie, csrf } = await signInOkta();
    const sessionId = sessionIdOf(harness.app, cookie);
    okta.behavior.invalidGrant = true;
    const refresh = await harness.app.inject({
      method: 'POST',
      url: '/api/session/refresh',
      cookies: { [cookie.name]: cookie.value },
      headers: { 'x-csrf-token': csrf, origin: harness.config.allowedOrigin },
    });
    expect(refresh.statusCode).toBe(401);
    expect(harness.store.getSession(sessionId)).toBeNull();
  });

  it('reveals the Okta access token with an audit event naming the provider', async () => {
    const { cookie, csrf } = await signInOkta();
    const response = await harness.app.inject({
      method: 'POST',
      url: '/api/session/tokens/reveal',
      cookies: { [cookie.name]: cookie.value },
      headers: { 'x-csrf-token': csrf, origin: harness.config.allowedOrigin },
      payload: { kind: 'access' },
    });
    expect(response.statusCode).toBe(200);
    expect((response.json() as { value: string }).value.split('.')).toHaveLength(3);
    const event = harness.store.listAuditEvents().find(row => row.event === 'token.reveal');
    expect(event?.actorProvider).toBe('okta');
    expect(event?.actorSubject).toBe('okta-user-1');
  });

  it('logs out the app session only and redirects nowhere', async () => {
    const { cookie, csrf } = await signInOkta();
    const sessionId = sessionIdOf(harness.app, cookie);
    const response = await harness.app.inject({
      method: 'POST',
      url: '/auth/logout',
      cookies: { [cookie.name]: cookie.value },
      headers: { 'x-csrf-token': csrf, origin: harness.config.allowedOrigin },
    });
    expect(response.statusCode).toBe(204);
    expect(response.headers.location).toBeUndefined();
    expect(harness.store.getSession(sessionId)).toBeNull();
    const event = harness.store.listAuditEvents().find(row => row.event === 'logout');
    expect(event?.actorProvider).toBe('okta');
  });
});