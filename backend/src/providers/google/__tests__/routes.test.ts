import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { createTestHarness } from '../../../../test/helpers/harness';
import type { Harness } from '../../../../test/helpers/harness';
import { createTestIdp } from '../../../core/testing';
import type { TestIdp } from '../../../core/testing';
import { googleModule } from '../index';
import { createGoogleIdp, googleTestEnv } from './idp';

let neutral: TestIdp;
let google: TestIdp;
let harness: Harness;

beforeEach(async () => {
  neutral = createTestIdp();
  google = createGoogleIdp();
  await neutral.start();
  await google.start();
  harness = await createTestHarness({
    idp: neutral,
    extraModules: [googleModule],
    env: googleTestEnv(google),
  });
});

afterEach(async () => {
  await harness.app.close();
  harness.store.close();
  neutral.stop();
  google.stop();
});

describe('enabled Google routes (B1, B20)', () => {
  it('lists Google among the enabled providers', async () => {
    const response = await harness.app.inject({ method: 'GET', url: '/auth/providers' });
    expect(response.statusCode).toBe(200);
    const body = response.json() as { providers: Array<{ id: string }> };
    expect(body.providers.map(provider => provider.id)).toContain('google');
  });

  it('registers the Google login and callback routes as public', () => {
    for (const url of ['/auth/login/google', '/auth/callback/google']) {
      const route = harness.inventory.routes.find(candidate => candidate.url === url);
      expect(route?.auth).toBe('public');
    }
    expect(harness.inventory.unguarded()).toEqual([]);
  });
});
