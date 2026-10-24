import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import {
  completeLogin,
  createTestHarness,
  sessionCookie,
  sessionCsrf,
} from '../../../../test/helpers/harness';
import type { Harness } from '../../../../test/helpers/harness';
import { createTestIdp } from '../../../core/testing';
import type { TestIdp } from '../../../core/testing';
import { oktaModule } from '../index';
import { createOktaIdp, oktaTestEnv } from './idp';

const OKTA_PATHS = { loginPath: '/auth/login/okta', callbackPath: '/auth/callback/okta' };

let neutral: TestIdp;
let okta: TestIdp;
let harness: Harness;

beforeEach(async () => {
  neutral = createTestIdp();
  okta = createOktaIdp();
  await neutral.start();
  await okta.start();
  harness = await createTestHarness({
    idp: neutral,
    extraModules: [oktaModule],
    env: oktaTestEnv(okta),
  });
});

afterEach(async () => {
  await harness.app.close();
  harness.store.close();
  neutral.stop();
  okta.stop();
});

describe('audit logging for a non-default provider (B18)', () => {
  it('records the Okta actor on login, refresh, reveal and logout', async () => {
    const { response } = await completeLogin(harness.app, okta, OKTA_PATHS);
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
      payload: { kind: 'refresh' },
    });
    await harness.app.inject({
      method: 'POST',
      url: '/auth/logout',
      cookies: { [cookie.name]: cookie.value },
      headers,
    });
    const events = harness.store.listAuditEvents();
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
