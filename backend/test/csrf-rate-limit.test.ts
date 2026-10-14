import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { completeLogin, createHarness, sessionCookie, sessionCsrf } from './helpers/harness';
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

const STATE_CHANGING_ROUTES: ReadonlyArray<{
  url: string;
  payload?: Record<string, string>;
}> = [
  { url: '/auth/logout' },
  { url: '/api/session/refresh' },
  { url: '/api/session/tokens/reveal', payload: { kind: 'access' } },
];

describe('CSRF and Origin checks (A9)', () => {
  for (const route of STATE_CHANGING_ROUTES) {
    it(`rejects ${route.url} without a CSRF token`, async () => {
      const cookie = await signIn();
      const response = await harness.app.inject({
        method: 'POST',
        url: route.url,
        cookies: { [cookie.name]: cookie.value },
        payload: route.payload,
      });
      expect(response.statusCode).toBe(403);
      const event = harness.store
        .listAuditEvents()
        .find(candidate => candidate.event === 'csrf.refused');
      expect(event?.reason).toBe('csrf_token');
      expect(event?.actorOid).toBe('oid-default');
      expect(event?.actorTid).toBe('tenant-1');
    });

    it(`rejects ${route.url} with a foreign Origin`, async () => {
      const cookie = await signIn();
      const response = await harness.app.inject({
        method: 'POST',
        url: route.url,
        cookies: { [cookie.name]: cookie.value },
        headers: { 'x-csrf-token': cookie.csrf, origin: 'https://attacker.example' },
        payload: route.payload,
      });
      expect(response.statusCode).toBe(403);
      const event = harness.store
        .listAuditEvents()
        .find(candidate => candidate.event === 'csrf.refused');
      expect(event?.reason).toBe('csrf_origin');
    });
  }

  it('accepts a request with the matching CSRF token and Origin', async () => {
    const cookie = await signIn();
    const response = await harness.app.inject({
      method: 'POST',
      url: '/api/session/refresh',
      cookies: { [cookie.name]: cookie.value },
      headers: { 'x-csrf-token': cookie.csrf, origin: harness.config.allowedOrigin },
    });
    expect(response.statusCode).toBe(200);
  });
});

describe('rate limiting (A14)', () => {
  it('returns 429 and audits once the refresh limit is exceeded', async () => {
    const limitedIdp = new TestIdp({ tenantId: 'tenant-1', clientId: 'client-1' });
    await limitedIdp.start();
    const limited = await createHarness({ idp: limitedIdp, env: { RATE_LIMIT_REFRESH: '2' } });
    try {
      const { response } = await completeLogin(limited.app, limitedIdp);
      const cookie = sessionCookie(response);
      const csrf = await sessionCsrf(limited.app, cookie);
      const headers = { 'x-csrf-token': csrf, origin: limited.config.allowedOrigin };
      const first = await limited.app.inject({
        method: 'POST',
        url: '/api/session/refresh',
        cookies: { [cookie.name]: cookie.value },
        headers,
      });
      const second = await limited.app.inject({
        method: 'POST',
        url: '/api/session/refresh',
        cookies: { [cookie.name]: cookie.value },
        headers,
      });
      const third = await limited.app.inject({
        method: 'POST',
        url: '/api/session/refresh',
        cookies: { [cookie.name]: cookie.value },
        headers,
      });
      expect(first.statusCode).toBe(200);
      expect(second.statusCode).toBe(200);
      expect(third.statusCode).toBe(429);
      const limitedEvent = limited.store
        .listAuditEvents()
        .find(event => event.event === 'rate_limited');
      expect(limitedEvent?.actorOid).toBe('oid-default');
      expect(limitedEvent?.actorTid).toBe('tenant-1');
    } finally {
      await limited.app.close();
      limited.store.close();
      limitedIdp.stop();
    }
  });

  it('returns 429 and audits once the token-reveal limit is exceeded', async () => {
    const limitedIdp = new TestIdp({ tenantId: 'tenant-1', clientId: 'client-1' });
    await limitedIdp.start();
    const limited = await createHarness({ idp: limitedIdp, env: { RATE_LIMIT_REVEAL: '1' } });
    try {
      const { response } = await completeLogin(limited.app, limitedIdp);
      const cookie = sessionCookie(response);
      const csrf = await sessionCsrf(limited.app, cookie);
      const headers = { 'x-csrf-token': csrf, origin: limited.config.allowedOrigin };
      const first = await limited.app.inject({
        method: 'POST',
        url: '/api/session/tokens/reveal',
        cookies: { [cookie.name]: cookie.value },
        headers,
        payload: { kind: 'access' },
      });
      const second = await limited.app.inject({
        method: 'POST',
        url: '/api/session/tokens/reveal',
        cookies: { [cookie.name]: cookie.value },
        headers,
        payload: { kind: 'access' },
      });
      expect(first.statusCode).toBe(200);
      expect(second.statusCode).toBe(429);
      const limitedEvent = limited.store
        .listAuditEvents()
        .find(event => event.event === 'rate_limited');
      expect(limitedEvent?.actorOid).toBe('oid-default');
      expect(limitedEvent?.actorTid).toBe('tenant-1');
    } finally {
      await limited.app.close();
      limited.store.close();
      limitedIdp.stop();
    }
  });

  it('limits /auth/callback per source IP', async () => {
    const limitedIdp = new TestIdp({ tenantId: 'tenant-1', clientId: 'client-1' });
    await limitedIdp.start();
    const limited = await createHarness({ idp: limitedIdp, env: { RATE_LIMIT_LOGIN: '2' } });
    try {
      await limited.app.inject({ method: 'GET', url: '/auth/callback?code=x&state=y' });
      await limited.app.inject({ method: 'GET', url: '/auth/callback?code=x&state=y' });
      const third = await limited.app.inject({ method: 'GET', url: '/auth/callback?code=x&state=y' });
      expect(third.statusCode).toBe(429);
      expect(limited.store.listAuditEvents().some(event => event.event === 'rate_limited')).toBe(true);
    } finally {
      await limited.app.close();
      limited.store.close();
      limitedIdp.stop();
    }
  });

  it('limits /auth/login per source IP', async () => {
    const limitedIdp = new TestIdp({ tenantId: 'tenant-1', clientId: 'client-1' });
    await limitedIdp.start();
    const limited = await createHarness({ idp: limitedIdp, env: { RATE_LIMIT_LOGIN: '2' } });
    try {
      await limited.app.inject({ method: 'GET', url: '/auth/login' });
      await limited.app.inject({ method: 'GET', url: '/auth/login' });
      const third = await limited.app.inject({ method: 'GET', url: '/auth/login' });
      expect(third.statusCode).toBe(429);
    } finally {
      await limited.app.close();
      limited.store.close();
      limitedIdp.stop();
    }
  });

  it('does not let a client-supplied X-Forwarded-For bypass the login limit', async () => {
    const limitedIdp = new TestIdp({ tenantId: 'tenant-1', clientId: 'client-1' });
    await limitedIdp.start();
    const limited = await createHarness({ idp: limitedIdp, env: { RATE_LIMIT_LOGIN: '2' } });
    try {
      await limited.app.inject({
        method: 'GET',
        url: '/auth/login',
        headers: { 'x-forwarded-for': '10.0.0.1' },
      });
      await limited.app.inject({
        method: 'GET',
        url: '/auth/login',
        headers: { 'x-forwarded-for': '10.0.0.2' },
      });
      const third = await limited.app.inject({
        method: 'GET',
        url: '/auth/login',
        headers: { 'x-forwarded-for': '10.0.0.3' },
      });
      expect(third.statusCode).toBe(429);
    } finally {
      await limited.app.close();
      limited.store.close();
      limitedIdp.stop();
    }
  });
});
