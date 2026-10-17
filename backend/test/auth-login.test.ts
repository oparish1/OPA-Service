import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { beginLogin, createHarness } from './helpers/harness';
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

describe('GET /auth/providers (O-17)', () => {
  it('lists the enabled providers in order', async () => {
    const response = await harness.app.inject({ method: 'GET', url: '/auth/providers' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ providers: [{ id: 'entra', name: 'Microsoft Entra ID' }] });
  });

  it('404s a disabled provider login path without creating a transaction', async () => {
    const response = await harness.app.inject({ method: 'GET', url: '/auth/login/okta' });
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

  it('also serves Entra at the provider-id login path the frontend builds', async () => {
    for (const url of ['/auth/login', '/auth/login/entra']) {
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

describe('enabled Okta and Google routes (B1, B19, B20)', () => {
  let okta: TestIdp;
  let google: TestIdp;
  let multi: Harness;

  beforeEach(async () => {
    okta = new TestIdp({ tenantId: 'tenant-1', clientId: 'okta-client', kind: 'okta' });
    google = new TestIdp({ tenantId: 'tenant-1', clientId: 'google-client', kind: 'google' });
    await okta.start();
    await google.start();
    multi = await createHarness({
      idp,
      oktaIdp: okta,
      googleIdp: google,
      env: { OKTA_FORGOT_PASSWORD_URL: 'https://integrator-3993617.okta.com/signin/forgot-password' },
    });
  });

  afterEach(async () => {
    await multi.app.close();
    multi.store.close();
    okta.stop();
    google.stop();
  });

  it('lists the three providers in order with configured destination links', async () => {
    const response = await multi.app.inject({ method: 'GET', url: '/auth/providers' });
    expect(response.statusCode).toBe(200);
    const body = response.json() as {
      providers: Array<{ id: string; forgotPasswordUrl?: string; changePasswordUrl?: string }>;
    };
    expect(body.providers.map(provider => provider.id)).toEqual(['entra', 'okta', 'google']);
    const oktaProvider = body.providers.find(provider => provider.id === 'okta');
    expect(oktaProvider?.forgotPasswordUrl).toBe(
      'https://integrator-3993617.okta.com/signin/forgot-password'
    );
    expect(oktaProvider?.changePasswordUrl).toBeUndefined();
    expect(body.providers.find(provider => provider.id === 'entra')?.forgotPasswordUrl).toBeUndefined();
  });

  it('registers the enabled provider routes as public', () => {
    for (const url of ['/auth/login/okta', '/auth/login/google', '/auth/callback/okta', '/auth/callback/google']) {
      const route = multi.inventory.routes.find(candidate => candidate.url === url);
      expect(route?.auth).toBe('public');
    }
    expect(multi.inventory.unguarded()).toEqual([]);
  });
});
