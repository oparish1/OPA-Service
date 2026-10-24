import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { beginLogin, createTestHarness } from './helpers/harness';
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

describe('GET /auth/providers (O-17)', () => {
  it('lists the enabled providers in order', async () => {
    const response = await harness.app.inject({ method: 'GET', url: '/auth/providers' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ providers: [{ id: 'test', name: 'Test Provider' }] });
  });

  it('404s a disabled provider login path without creating a transaction', async () => {
    const response = await harness.app.inject({ method: 'GET', url: '/auth/login/other' });
    expect(response.statusCode).toBe(404);
    expect(harness.store.listAuditEvents().filter(event => event.event === 'login.start')).toHaveLength(
      0
    );
  });
});

describe('GET /auth/login (A1)', () => {
  it('redirects to the discovered authorize endpoint with the required parameters', async () => {
    const start = await beginLogin(harness.app);
    expect(start.location.origin).toBe(idp.origin);
    expect(start.location.pathname).toBe('/authorize');
    expect(start.location.searchParams.get('response_type')).toBe('code');
    expect(start.location.searchParams.get('code_challenge_method')).toBe('S256');
    expect(start.location.searchParams.get('code_challenge')).toBeTruthy();
    expect(start.location.searchParams.get('state')).toBeTruthy();
    expect(start.location.searchParams.get('nonce')).toBeTruthy();
    expect(start.location.searchParams.get('redirect_uri')).toBe(
      `${harness.config.publicBaseUrl}/auth/callback`
    );
  });

  it('also serves the provider at the provider-id login path the frontend builds', async () => {
    for (const url of ['/auth/login', '/auth/login/test']) {
      const response = await harness.app.inject({ method: 'GET', url });
      expect(response.statusCode).toBe(302);
      expect(new URL(response.headers.location as string).origin).toBe(idp.origin);
    }
    expect(
      harness.store.listAuditEvents().filter(event => event.event === 'login.start')
    ).toHaveLength(2);
  });

  it('records a login.start audit event and sets a login-transaction cookie', async () => {
    const start = await beginLogin(harness.app);
    expect(start.ltxValue).toBeTruthy();
    const events = harness.store.listAuditEvents().filter(event => event.event === 'login.start');
    expect(events).toHaveLength(1);
  });
});
