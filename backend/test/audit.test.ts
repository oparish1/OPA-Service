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

describe('audit logging (A20)', () => {
  it('records actor, outcome, source and time on a successful sign-in', async () => {
    const { response } = await completeLogin(harness.app, idp);
    expect(response.statusCode).toBe(302);
    const event = harness.store
      .listAuditEvents()
      .find(candidate => candidate.event === 'login.success');
    expect(event).toBeDefined();
    expect(event?.actorOid).toBe('oid-default');
    expect(event?.actorTid).toBe('tenant-1');
    expect(event?.actorProvider).toBe('entra');
    expect(event?.actorSubject).toBe('oid-default');
    expect(event?.outcome).toBe('success');
    expect(event?.sessionHash).toBeTruthy();
    expect(event?.ip).toBeTruthy();
    expect(event?.userAgent).toBeTruthy();
    expect(event?.createdAt).toBeGreaterThan(0);
  });

  it('records the revealed token kind', async () => {
    const { response } = await completeLogin(harness.app, idp);
    const cookie = sessionCookie(response);
    const csrf = await sessionCsrf(harness.app, cookie);
    await harness.app.inject({
      method: 'POST',
      url: '/api/session/tokens/reveal',
      cookies: { [cookie.name]: cookie.value },
      headers: { 'x-csrf-token': csrf, origin: harness.config.allowedOrigin },
      payload: { kind: 'refresh' },
    });
    const event = harness.store.listAuditEvents().find(candidate => candidate.event === 'token.reveal');
    expect(event).toBeDefined();
    expect(event?.metadata).toContain('refresh');
  });

  it('attributes refresh, reveal and logout to the authenticated actor', async () => {
    const { response } = await completeLogin(harness.app, idp);
    const cookie = sessionCookie(response);
    const csrf = await sessionCsrf(harness.app, cookie);
    const headers = { 'x-csrf-token': csrf, origin: harness.config.allowedOrigin };
    await harness.app.inject({
      method: 'POST',
      url: '/api/session/refresh',
      cookies: { [cookie.name]: cookie.value },
      headers,
    });
    await harness.app.inject({
      method: 'POST',
      url: '/api/session/tokens/reveal',
      cookies: { [cookie.name]: cookie.value },
      headers,
      payload: { kind: 'access' },
    });
    await harness.app.inject({
      method: 'POST',
      url: '/auth/logout',
      cookies: { [cookie.name]: cookie.value },
      headers,
    });

    const events = harness.store.listAuditEvents();
    for (const name of ['session.refresh', 'token.reveal', 'logout']) {
      const event = events.find(candidate => candidate.event === name);
      expect(event?.actorOid).toBe('oid-default');
      expect(event?.actorTid).toBe('tenant-1');
      expect(event?.actorProvider).toBe('entra');
      expect(event?.actorSubject).toBe('oid-default');
    }
  });
});

describe('audit logging for non-Entra providers (B18)', () => {
  let okta: TestIdp;
  let multi: Harness;

  beforeEach(async () => {
    okta = new TestIdp({ tenantId: 'tenant-1', clientId: 'okta-client', kind: 'okta' });
    await okta.start();
    multi = await createHarness({ idp, oktaIdp: okta });
  });

  afterEach(async () => {
    await multi.app.close();
    multi.store.close();
    okta.stop();
  });

  it('records the Okta actor on login, refresh, reveal and logout', async () => {
    const { response } = await completeLogin(multi.app, okta, {
      loginPath: '/auth/login/okta',
      callbackPath: '/auth/callback/okta',
    });
    const cookie = sessionCookie(response);
    const csrf = await sessionCsrf(multi.app, cookie);
    const headers = { 'x-csrf-token': csrf, origin: multi.config.allowedOrigin };
    await multi.app.inject({
      method: 'POST',
      url: '/api/session/refresh',
      cookies: { [cookie.name]: cookie.value },
      headers,
    });
    await multi.app.inject({
      method: 'POST',
      url: '/api/session/tokens/reveal',
      cookies: { [cookie.name]: cookie.value },
      headers,
      payload: { kind: 'refresh' },
    });
    await multi.app.inject({
      method: 'POST',
      url: '/auth/logout',
      cookies: { [cookie.name]: cookie.value },
      headers,
    });
    const events = multi.store.listAuditEvents();
    const success = events.find(event => event.event === 'login.success');
    expect(success?.actorProvider).toBe('okta');
    expect(success?.actorSubject).toBe('okta-user-1');
    for (const name of ['session.refresh', 'token.reveal', 'logout']) {
      const event = events.find(candidate => candidate.event === name);
      expect(event?.actorProvider).toBe('okta');
      expect(event?.actorSubject).toBe('okta-user-1');
    }
  });
});
