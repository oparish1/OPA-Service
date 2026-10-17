import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { completeLogin, createHarness, sessionCookie, sessionCsrf, sessionIdOf } from './helpers/harness';
import type { Harness } from './helpers/harness';
import { TestIdp } from './helpers/idp';

let idp: TestIdp;
let harness: Harness;

beforeEach(async () => {
  idp = new TestIdp({ tenantId: 'tenant-1', clientId: 'client-1' });
  await idp.start();
  harness = await createHarness({ idp });
});

afterEach(async () => {
  await harness.app.close();
  harness.store.close();
  idp.stop();
});

async function signIn(): Promise<{ name: string; value: string; csrf: string }> {
  const { response } = await completeLogin(harness.app, idp);
  const cookie = sessionCookie(response);
  const csrf = await sessionCsrf(harness.app, cookie);
  return { ...cookie, csrf };
}

describe('GET /api/session', () => {
  it('matches the frontend session contract on a real response', async () => {
    const cookie = await signIn();
    const response = await harness.app.inject({
      method: 'GET',
      url: '/api/session',
      cookies: { [cookie.name]: cookie.value },
    });
    expect(response.statusCode).toBe(200);
    const body = response.json() as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual(
      [
        'accessToken',
        'account',
        'csrfToken',
        'issuedAt',
        'issuer',
        'provider',
        'refreshToken',
        'snapshot',
      ].sort()
    );
    const account = body.account as Record<string, unknown>;
    expect(Object.keys(account).sort()).toEqual(
      ['accountId', 'createdAt', 'displayName', 'email', 'organisation', 'role'].sort()
    );
    expect(Object.keys(body.accessToken as object).sort()).toEqual(
      ['expiresAt', 'masked', 'scopes'].sort()
    );
    expect(Object.keys(body.refreshToken as object).sort()).toEqual(
      ['expiresAt', 'grant', 'masked'].sort()
    );
  });

  it('renders account metadata with the approved timestamp shape', async () => {
    const cookie = await signIn();
    const response = await harness.app.inject({
      method: 'GET',
      url: '/api/session',
      cookies: { [cookie.name]: cookie.value },
    });
    const body = response.json() as { account: { createdAt: string }; issuedAt: string };
    expect(body.account.createdAt).toMatch(/^\d{2} [A-Z][a-z]{2} \d{4} · \d{2}:\d{2}:\d{2} UTC$/);
    expect(body.issuedAt).toMatch(/^\d{2} [A-Z][a-z]{2} \d{4} · \d{2}:\d{2}:\d{2} UTC$/);
  });

  it('allows account to be null while preserving the other contract keys', async () => {
    harness.store.createSession({
      id: 'null-account',
      userId: 'no-such-user',
      csrfToken: 'csrf',
      createdAt: Date.now(),
      lastSeenAt: Date.now(),
    });
    const response = await harness.app.inject({
      method: 'GET',
      url: '/api/session',
      cookies: { aa_session: harness.app.signCookie('null-account') },
    });
    expect(response.statusCode).toBe(200);
    expect((response.json() as { account: unknown }).account).toBeNull();
  });

  it('returns metadata without token values', async () => {
    const cookie = await signIn();
    const response = await harness.app.inject({
      method: 'GET',
      url: '/api/session',
      cookies: { [cookie.name]: cookie.value },
    });
    expect(response.statusCode).toBe(200);
    const body = response.json() as Record<string, unknown>;
    expect(body.provider).toBe('Microsoft Entra ID');
    expect((body.account as { displayName: string }).displayName).toBe('Orlando Parish');
    expect(body.csrfToken).toBe(cookie.csrf);
    expect(body.account).toMatchObject({
      displayName: 'Orlando Parish',
      email: 'orlando.parish@agentic-advantage.example',
      organisation: 'Agentic Advantage',
      role: 'User',
      accountId: 'acct_oid-default',
    });
    const serialised = JSON.stringify(body);
    expect(serialised).not.toContain('access-token');
    expect(serialised).not.toContain('refresh-token-1');
    expect((body.accessToken as { masked: string }).masked).toContain('…');
  });
});

describe('token reveal (A12)', () => {
  it('returns the real value only over POST, with no-store', async () => {
    const cookie = await signIn();
    const response = await harness.app.inject({
      method: 'POST',
      url: '/api/session/tokens/reveal',
      cookies: { [cookie.name]: cookie.value },
      headers: { 'x-csrf-token': cookie.csrf, origin: harness.config.allowedOrigin },
      payload: { kind: 'access' },
    });
    expect(response.statusCode).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');
    const body = response.json() as { value: string };
    expect(body.value.length).toBeGreaterThan(20);
    expect(harness.store.listAuditEvents().some(event => event.event === 'token.reveal')).toBe(true);
  });

  it('requires a session', async () => {
    const response = await harness.app.inject({
      method: 'POST',
      url: '/api/session/tokens/reveal',
      payload: { kind: 'access' },
    });
    expect(response.statusCode).toBe(401);
  });

  it('returns an empty value when the session has no refresh token', async () => {
    const cookie = await signIn();
    const sessionId = sessionIdOf(harness.app, cookie);
    const tokens = harness.store.getTokens(sessionId);
    if (!tokens) throw new Error('expected stored tokens');
    harness.store.saveTokens({ ...tokens, refreshTokenEnc: '' });
    const response = await harness.app.inject({
      method: 'POST',
      url: '/api/session/tokens/reveal',
      cookies: { [cookie.name]: cookie.value },
      headers: { 'x-csrf-token': cookie.csrf, origin: harness.config.allowedOrigin },
      payload: { kind: 'refresh' },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ kind: 'refresh', value: '' });
  });

  it('never writes a revealed token to the logs', async () => {
    const logs: string[] = [];
    const loggedIdp = new TestIdp({ tenantId: 'tenant-1', clientId: 'client-1' });
    await loggedIdp.start();
    const loggedHarness = await createHarness({
      idp: loggedIdp,
      env: { LOG_LEVEL: 'info' },
      loggerStream: { write: message => logs.push(message) },
    });
    try {
      const { response } = await completeLogin(loggedHarness.app, loggedIdp);
      const cookie = sessionCookie(response);
      const csrf = await sessionCsrf(loggedHarness.app, cookie);
      const reveal = await loggedHarness.app.inject({
        method: 'POST',
        url: '/api/session/tokens/reveal',
        cookies: { [cookie.name]: cookie.value },
        headers: { 'x-csrf-token': csrf, origin: loggedHarness.config.allowedOrigin },
        payload: { kind: 'access' },
      });
      const revealed = (reveal.json() as { value: string }).value;
      expect(logs.length).toBeGreaterThan(0);
      expect(logs.join('\n')).not.toContain(revealed);
    } finally {
      await loggedHarness.app.close();
      loggedHarness.store.close();
      loggedIdp.stop();
    }
  });
});

describe('token storage and refresh (A13)', () => {
  it('stores tokens encrypted and replaces the refresh token on refresh', async () => {
    const cookie = await signIn();
    const before = harness.store.getTokens(sessionIdOf(harness.app, cookie));
    expect(before).not.toBeNull();
    expect(before?.refreshTokenEnc).not.toContain('refresh-token-1');
    expect(harness.services.cipher.open(before?.refreshTokenEnc ?? '')).toBe('refresh-token-1');

    const refresh = await harness.app.inject({
      method: 'POST',
      url: '/api/session/refresh',
      cookies: { [cookie.name]: cookie.value },
      headers: { 'x-csrf-token': cookie.csrf, origin: harness.config.allowedOrigin },
    });
    expect(refresh.statusCode).toBe(200);

    const after = harness.store.getTokens(sessionIdOf(harness.app, cookie));
    expect(after?.refreshTokenEnc).not.toBe(before?.refreshTokenEnc);
    expect(harness.services.cipher.open(after?.refreshTokenEnc ?? '')).toBe('refresh-token-2');
    expect(
      harness.store.listAuditEvents().some(event => event.event === 'session.refresh')
    ).toBe(true);
  });

  it('refuses refresh when the session has no stored tokens', async () => {
    const user = harness.store.upsertUser({
      tid: 'tenant-1',
      oid: 'o1',
      email: 'a@x',
      displayName: 'A',
      organisation: 'AA',
    });
    harness.store.createSession({
      id: 'no-tokens',
      userId: user.id,
      csrfToken: 'csrf',
      createdAt: Date.now(),
      lastSeenAt: Date.now(),
    });
    const response = await harness.app.inject({
      method: 'POST',
      url: '/api/session/refresh',
      cookies: { aa_session: harness.app.signCookie('no-tokens') },
      headers: { 'x-csrf-token': 'csrf', origin: harness.config.allowedOrigin },
    });
    expect(response.statusCode).toBe(401);
  });

  it('reports a stored token that cannot be decrypted as a failed refresh', async () => {
    const cookie = await signIn();
    const sessionId = sessionIdOf(harness.app, cookie);
    const tokens = harness.store.getTokens(sessionId);
    if (!tokens) throw new Error('expected stored tokens');
    harness.store.saveTokens({ ...tokens, refreshTokenEnc: 'v1.deadbeef.aaaa.bbbb.cccc' });
    const response = await harness.app.inject({
      method: 'POST',
      url: '/api/session/refresh',
      cookies: { [cookie.name]: cookie.value },
      headers: { 'x-csrf-token': cookie.csrf, origin: harness.config.allowedOrigin },
    });
    expect(response.statusCode).toBe(401);
    expect((response.json() as { error: string }).error).toBe('refresh_failed');
    expect(
      harness.store.listAuditEvents().some(event => event.event === 'session.refresh.failed')
    ).toBe(true);
  });

  it('surfaces a stored token that cannot be decrypted instead of an empty session card', async () => {
    const cookie = await signIn();
    const sessionId = sessionIdOf(harness.app, cookie);
    const tokens = harness.store.getTokens(sessionId);
    if (!tokens) throw new Error('expected stored tokens');
    harness.store.saveTokens({ ...tokens, accessTokenEnc: 'v1.deadbeef.aaaa.bbbb.cccc' });
    const response = await harness.app.inject({
      method: 'GET',
      url: '/api/session',
      cookies: { [cookie.name]: cookie.value },
    });
    expect(response.statusCode).toBe(500);
  });
});

describe('provider-shaped sessions never log token material (B16)', () => {
  for (const kind of ['okta', 'google'] as const) {
    it(`never writes a revealed ${kind} token to the logs`, async () => {
      const logs: string[] = [];
      const providerIdp = new TestIdp({
        tenantId: 'tenant-1',
        clientId: `${kind}-client`,
        kind,
        apiAudience: 'api://default',
        hostedDomain: 'agentic-advantage.com',
      });
      await providerIdp.start();
      const multi = await createHarness({
        idp,
        ...(kind === 'okta' ? { oktaIdp: providerIdp } : { googleIdp: providerIdp }),
        env: { LOG_LEVEL: 'info' },
        loggerStream: { write: message => logs.push(message) },
      });
      try {
        const { response } = await completeLogin(multi.app, providerIdp, {
          loginPath: `/auth/login/${kind}`,
          callbackPath: `/auth/callback/${kind}`,
        });
        const cookie = sessionCookie(response);
        const csrf = await sessionCsrf(multi.app, cookie);
        const reveal = await multi.app.inject({
          method: 'POST',
          url: '/api/session/tokens/reveal',
          cookies: { [cookie.name]: cookie.value },
          headers: { 'x-csrf-token': csrf, origin: multi.config.allowedOrigin },
          payload: { kind: 'refresh' },
        });
        const revealed = (reveal.json() as { value: string }).value;
        expect(revealed.length).toBeGreaterThan(10);
        expect(logs.join('\n')).not.toContain(revealed);
      } finally {
        await multi.app.close();
        multi.store.close();
        providerIdp.stop();
      }
    });
  }
});
