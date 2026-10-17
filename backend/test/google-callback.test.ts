import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { googleIssuerIsExact } from '../src/auth/providers';
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
let google: TestIdp;
let harness: Harness;

const GOOGLE_PATHS = { loginPath: '/auth/login/google', callbackPath: '/auth/callback/google' };

beforeEach(async () => {
  entra = new TestIdp({ tenantId: 'tenant-1', clientId: 'client-1' });
  google = new TestIdp({
    tenantId: 'tenant-1',
    clientId: 'google-client',
    kind: 'google',
    hostedDomain: 'agentic-advantage.com',
  });
  await entra.start();
  await google.start();
  harness = await createHarness({ idp: entra, googleIdp: google });
});

afterEach(async () => {
  await harness.app.close();
  harness.store.close();
  entra.stop();
  google.stop();
});

function refusedReasons(): string[] {
  return harness.store
    .listAuditEvents()
    .filter(event => event.event === 'login.refused')
    .map(event => event.reason ?? '');
}

describe('Google login and callback (B1, B2, B6, B8)', () => {
  it('redirects to the discovered Google endpoint with the Google callback and offline access', async () => {
    const start = await beginLogin(harness.app, '/auth/login/google');
    expect(start.location.origin).toBe(google.origin);
    expect(start.location.searchParams.get('response_type')).toBe('code');
    expect(start.location.searchParams.get('code_challenge_method')).toBe('S256');
    expect(start.location.searchParams.get('redirect_uri')).toBe(
      `${harness.config.publicBaseUrl}/auth/callback/google`
    );
    expect(start.location.searchParams.get('access_type')).toBe('offline');
    expect(start.location.searchParams.get('scope')).toContain('openid');
    expect(start.location.searchParams.get('scope')).not.toContain('offline_access');
  });

  it('creates a Google user keyed by provider, issuer and subject and reuses it', async () => {
    const first = await completeLogin(harness.app, google, GOOGLE_PATHS);
    expect(first.response.statusCode).toBe(302);
    const user = harness.store.getUserByIdentity('google', google.origin, 'google-user-1');
    expect(user?.provider).toBe('google');
    await completeLogin(harness.app, google, GOOGLE_PATHS);
    expect(harness.store.countUsers()).toBe(1);
  });

  it('rejects a token signed with an unknown key and a wrong audience', async () => {
    google.behavior.signWithUnknownKey = true;
    const unknown = await completeLogin(harness.app, google, GOOGLE_PATHS);
    expect(unknown.response.headers.location).toBe(`${harness.config.publicBaseUrl}/?error=signin`);
    google.behavior.signWithUnknownKey = false;
    google.behavior.claims = { aud: 'other-client' };
    const wrongAud = await completeLogin(harness.app, google, GOOGLE_PATHS);
    expect(wrongAud.response.headers.location).toBe(`${harness.config.publicBaseUrl}/?error=signin`);
  });

  it('rejects an expired token and a mismatched nonce', async () => {
    google.behavior.claims = { exp: Math.floor(Date.now() / 1000) - 3600 };
    expect((await completeLogin(harness.app, google, GOOGLE_PATHS)).response.headers.location).toBe(
      `${harness.config.publicBaseUrl}/?error=signin`
    );
    google.behavior.claims = { nonce: 'wrong-nonce' };
    expect((await completeLogin(harness.app, google, GOOGLE_PATHS)).response.headers.location).toBe(
      `${harness.config.publicBaseUrl}/?error=signin`
    );
  });

  it('refuses a callback whose transaction belongs to Entra', async () => {
    const start = await beginLogin(harness.app);
    const response = await harness.app.inject({
      method: 'GET',
      url: `/auth/callback/google?code=${google.makeCode(start.nonce)}&state=${encodeURIComponent(start.state)}`,
      cookies: { [start.ltxName]: start.ltxValue },
    });
    expect(response.headers.location).toBe(`${harness.config.publicBaseUrl}/?error=signin`);
    expect(refusedReasons()).toContain('provider_mismatch');
  });
});

describe('Google hosted-domain gating (B7, O-18)', () => {
  it('exact issuer helper accepts only the configured issuer string', () => {
    const configured = 'https://accounts.google.com';
    expect(googleIssuerIsExact('https://accounts.google.com', configured)).toBe(true);
    expect(googleIssuerIsExact('accounts.google.com', configured)).toBe(false);
    expect(googleIssuerIsExact('https://evil.example', configured)).toBe(false);
  });

  const refusedClaims: Array<[string, string, Record<string, unknown>]> = [
    ['a missing hd', 'wrong_hd', { hd: undefined }],
    ['a foreign hd', 'wrong_hd', { hd: 'other.example' }],
    ['an unverified email', 'email_unverified', { email_verified: false }],
  ];
  for (const [label, reason, claims] of refusedClaims) {
    it(`refuses ${label} with no user row`, async () => {
      google.behavior.claims = claims;
      const { response } = await completeLogin(harness.app, google, GOOGLE_PATHS);
      expect(response.headers.location).toBe(`${harness.config.publicBaseUrl}/?error=signin`);
      expect(refusedReasons()).toContain(reason);
      expect(harness.store.countUsers()).toBe(0);
    });
  }

  it('does not trust an hd request parameter: a foreign-domain token is still refused', async () => {
    google.behavior.claims = { hd: 'evil.example' };
    const start = await beginLogin(harness.app, '/auth/login/google');
    const response = await harness.app.inject({
      method: 'GET',
      url: `/auth/callback/google?code=${google.makeCode(start.nonce)}&state=${encodeURIComponent(
        start.state
      )}&hd=agentic-advantage.com`,
      cookies: { [start.ltxName]: start.ltxValue },
    });
    expect(response.headers.location).toBe(`${harness.config.publicBaseUrl}/?error=signin`);
    expect(refusedReasons()).toContain('wrong_hd');
    expect(harness.store.countUsers()).toBe(0);
  });
});

describe('Google session lifecycle (B14, B15, B17)', () => {
  async function signInGoogle() {
    const { response } = await completeLogin(harness.app, google, GOOGLE_PATHS);
    const cookie = sessionCookie(response);
    const csrf = await sessionCsrf(harness.app, cookie);
    return { cookie, csrf };
  }

  it('reports Google as the provider with no fixed expiry', async () => {
    const { cookie } = await signInGoogle();
    const response = await harness.app.inject({
      method: 'GET',
      url: '/api/session',
      cookies: { [cookie.name]: cookie.value },
    });
    const body = response.json() as {
      provider: string;
      issuer: string;
      refreshToken: { expiresAt: string; grant: string };
    };
    expect(body.provider).toBe('Google Workspace / Cloud Identity');
    expect(body.issuer).toBe(google.origin);
    expect(body.refreshToken.expiresAt).toBe('No fixed expiry');
    expect(body.refreshToken.grant).toBe('Refresh token · up to 8 hours (app limit)');
  });

  it('keeps the existing refresh token when Google returns no new one', async () => {
    google.behavior.omitRefreshedRefreshToken = true;
    const { cookie, csrf } = await signInGoogle();
    const sessionId = sessionIdOf(harness.app, cookie);
    const refresh = await harness.app.inject({
      method: 'POST',
      url: '/api/session/refresh',
      cookies: { [cookie.name]: cookie.value },
      headers: { 'x-csrf-token': csrf, origin: harness.config.allowedOrigin },
    });
    expect(refresh.statusCode).toBe(200);
    expect(harness.services.cipher.open(harness.store.getTokens(sessionId)?.refreshTokenEnc ?? '')).toBe(
      'refresh-token-1'
    );
  });

  it('returns no_refresh_token when the session has no refresh token', async () => {
    const { cookie, csrf } = await signInGoogle();
    const sessionId = sessionIdOf(harness.app, cookie);
    const tokens = harness.store.getTokens(sessionId);
    harness.store.saveTokens({
      sessionId,
      accessTokenEnc: tokens?.accessTokenEnc ?? '',
      refreshTokenEnc: harness.services.cipher.seal(''),
      accessExpiresAt: tokens?.accessExpiresAt ?? Date.now(),
      refreshExpiresAt: 0,
      scopes: '',
    });
    const response = await harness.app.inject({
      method: 'POST',
      url: '/api/session/refresh',
      cookies: { [cookie.name]: cookie.value },
      headers: { 'x-csrf-token': csrf, origin: harness.config.allowedOrigin },
    });
    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ error: 'no_refresh_token' });
  });

  it('best-effort revokes the Google refresh token on logout', async () => {
    const { cookie, csrf } = await signInGoogle();
    const before = google.revokeCount;
    const response = await harness.app.inject({
      method: 'POST',
      url: '/auth/logout',
      cookies: { [cookie.name]: cookie.value },
      headers: { 'x-csrf-token': csrf, origin: harness.config.allowedOrigin },
    });
    expect(response.statusCode).toBe(204);
    expect(google.revokeCount).toBe(before + 1);
    const event = harness.store.listAuditEvents().find(row => row.event === 'token.revoke');
    expect(event?.actorProvider).toBe('google');
    expect(event?.outcome).toBe('success');
  });

  it('revokes when an idle session is reaped', async () => {
    const { cookie } = await signInGoogle();
    const sessionId = sessionIdOf(harness.app, cookie);
    const before = google.revokeCount;
    harness.store.touchSession(sessionId, Date.now() - 40 * 60 * 1000);
    const response = await harness.app.inject({
      method: 'GET',
      url: '/api/session',
      cookies: { [cookie.name]: cookie.value },
    });
    expect(response.statusCode).toBe(401);
    expect(google.revokeCount).toBe(before + 1);
    expect(harness.store.getSession(sessionId)).toBeNull();
  });
});