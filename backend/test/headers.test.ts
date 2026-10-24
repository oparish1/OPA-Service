import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { createTestHarness } from './helpers/harness';
import type { Harness } from './helpers/harness';
import { createTestIdp } from '../src/core/testing';
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

describe('security headers', () => {
  it('serves a strict CSP without inline or third-party scripts', async () => {
    const response = await harness.app.inject({ method: 'GET', url: '/healthz' });
    const csp = response.headers['content-security-policy'] as string;
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("script-src 'self'");
    expect(csp).not.toMatch(/script-src[^;]*unsafe-inline/);
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain('https://fonts.gstatic.com');
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['referrer-policy']).toBe('no-referrer');
  });

  it('omits HSTS outside production', async () => {
    const response = await harness.app.inject({ method: 'GET', url: '/healthz' });
    expect(response.headers['strict-transport-security']).toBeUndefined();
  });

  it('sets HSTS in production', async () => {
    const prodIdp = createTestIdp();
    await prodIdp.start();
    const prod = await createTestHarness({
      idp: prodIdp,
      env: { NODE_ENV: 'production', COOKIE_SECURE: 'true', DATABASE_URL: '/tmp/archon-identity-test.db' },
    });
    try {
      const response = await prod.app.inject({ method: 'GET', url: '/healthz' });
      expect(response.headers['strict-transport-security']).toContain('max-age=31536000');
    } finally {
      await prod.app.close();
      prod.store.close();
      prodIdp.stop();
    }
  });

  it('returns a generic 401 for unauthenticated protected routes', async () => {
    const response = await harness.app.inject({ method: 'GET', url: '/v1/me' });
    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ error: 'unauthorized' });
  });
});
