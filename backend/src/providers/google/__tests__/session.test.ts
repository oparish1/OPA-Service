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
import { googleModule } from '../index';
import { createGoogleIdp, googleTestEnv } from './idp';

const GOOGLE_PATHS = { loginPath: '/auth/login/google', callbackPath: '/auth/callback/google' };
const logs: string[] = [];

let neutral: TestIdp;
let google: TestIdp;
let harness: Harness;

beforeEach(async () => {
  neutral = createTestIdp();
  google = createGoogleIdp();
  await neutral.start();
  await google.start();
  logs.length = 0;
  harness = await createTestHarness({
    idp: neutral,
    extraModules: [googleModule],
    env: { ...googleTestEnv(google), LOG_LEVEL: 'info' },
    loggerStream: { write: message => logs.push(message) },
  });
});

afterEach(async () => {
  await harness.app.close();
  harness.store.close();
  neutral.stop();
  google.stop();
});

describe('Google session log hygiene (B16)', () => {
  it('never writes a revealed Google token to the logs', async () => {
    const { response } = await completeLogin(harness.app, google, GOOGLE_PATHS);
    const cookie = sessionCookie(response);
    const csrf = await sessionCsrf(harness.app, cookie);
    const reveal = await harness.app.inject({
      method: 'POST',
      url: '/api/session/tokens/reveal',
      cookies: { [cookie.name]: cookie.value },
      headers: { 'x-csrf-token': csrf, origin: harness.config.allowedOrigin },
      payload: { kind: 'refresh' },
    });
    const revealed = (reveal.json() as { value: string }).value;
    expect(revealed.length).toBeGreaterThan(10);
    expect(logs.join('\n')).not.toContain(revealed);
  });
});
