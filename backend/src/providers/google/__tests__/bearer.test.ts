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

describe('Google is never a bearer provider (B12)', () => {
  it('rejects a Google-shaped token presented as a bearer token', async () => {
    const token = await neutral.signAccessToken({
      iss: 'https://accounts.google.com',
      aud: 'google-client',
    });
    const response = await harness.app.inject({
      method: 'GET',
      url: '/v1/me',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(response.statusCode).toBe(401);
  });
});
