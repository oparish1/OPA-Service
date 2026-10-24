import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { createTestHarness } from '../../../../test/helpers/harness';
import type { Harness } from '../../../../test/helpers/harness';
import { createTestIdp } from '../../../core/testing';
import type { TestIdp } from '../../../core/testing';
import { oktaModule } from '../index';
import { createOktaIdp, oktaTestEnv } from './idp';

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
    env: {
      ...oktaTestEnv(okta),
      OKTA_FORGOT_PASSWORD_URL: 'https://integrator-3993617.okta.com/signin/forgot-password',
    },
  });
});

afterEach(async () => {
  await harness.app.close();
  harness.store.close();
  neutral.stop();
  okta.stop();
});

describe('enabled Okta routes (B1, B19)', () => {
  it('lists Okta with its configured destination links', async () => {
    const response = await harness.app.inject({ method: 'GET', url: '/auth/providers' });
    expect(response.statusCode).toBe(200);
    const body = response.json() as {
      providers: Array<{ id: string; forgotPasswordUrl?: string; changePasswordUrl?: string }>;
    };
    const oktaProvider = body.providers.find(provider => provider.id === 'okta');
    expect(oktaProvider?.forgotPasswordUrl).toBe(
      'https://integrator-3993617.okta.com/signin/forgot-password'
    );
    expect(oktaProvider?.changePasswordUrl).toBeUndefined();
  });

  it('registers the Okta login and callback routes as public', () => {
    for (const url of ['/auth/login/okta', '/auth/callback/okta']) {
      const route = harness.inventory.routes.find(candidate => candidate.url === url);
      expect(route?.auth).toBe('public');
    }
    expect(harness.inventory.unguarded()).toEqual([]);
  });
});
