import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import {
  completeLogin,
  createTestHarness,
  sessionCookie,
  sessionCsrf,
  sessionIdOf,
} from '../../../../test/helpers/harness';
import type { Harness } from '../../../../test/helpers/harness';
import { createTestIdp } from '../../../core/testing';
import type { TestIdp } from '../../../core/testing';
import { googleModule } from '../index';
import { createGoogleIdp, googleTestEnv } from './idp';

const GOOGLE_PATHS = { loginPath: '/auth/login/google', callbackPath: '/auth/callback/google' };

let neutral: TestIdp;
let google: TestIdp;
let harness: Harness;
const logs: string[] = [];

beforeEach(async () => {
  neutral = createTestIdp();
  google = createGoogleIdp();
  await neutral.start();
  await google.start();
  logs.length = 0;
  harness = await createTestHarness({
    idp: neutral,
    extraModules: [googleModule],
    env: { ...googleTestEnv(google), REQUEST_RUNNER_ALLOWED_HOSTS: 'other.example' },
    loggerStream: { write: message => logs.push(message) },
  });
});

afterEach(async () => {
  await harness.app.close();
  harness.store.close();
  neutral.stop();
  google.stop();
});

async function signInGoogle() {
  const { response } = await completeLogin(harness.app, google, GOOGLE_PATHS);
  const cookie = sessionCookie(response);
  const csrf = await sessionCsrf(harness.app, cookie);
  return { cookie, csrf };
}

function runRunner(cookie: { name: string; value: string }, csrf: string, url: string) {
  return harness.app.inject({
    method: 'POST',
    url: '/api/request-runner',
    cookies: { [cookie.name]: cookie.value },
    headers: { 'x-csrf-token': csrf, origin: harness.config.allowedOrigin },
    payload: { url, auth: 'session' },
  });
}

describe('Google in-process relay (B13, B12)', () => {
  it('returns the real /v1 body with no outbound request and no token in the relay', async () => {
    const { cookie, csrf } = await signInGoogle();
    const sessionId = sessionIdOf(harness.app, cookie);
    const tokens = harness.store.getTokens(sessionId);
    if (!tokens) throw new Error('tokens missing');
    const accessToken = harness.services.cipher.open(tokens.accessTokenEnc);
    const refreshToken = harness.services.cipher.open(tokens.refreshTokenEnc);

    const realFetch = globalThis.fetch;
    globalThis.fetch = (() => {
      throw new Error('outbound fetch is forbidden for the Google relay');
    }) as unknown as typeof fetch;
    try {
      const response = await runRunner(cookie, csrf, `${harness.config.publicBaseUrl}/v1/me`);
      expect(response.statusCode).toBe(200);
      const payload = response.json() as { status: number; body: string };
      expect(payload.status).toBe(200);
      expect(payload.body).toContain('orlando.parish@agentic-advantage.example');
      expect(response.body).not.toContain(accessToken);
      expect(response.body).not.toContain(refreshToken);
      expect(logs.join('')).not.toContain(accessToken);
    } finally {
      globalThis.fetch = realFetch;
    }
  });

  it('still refuses a Google session for any other allowed host', async () => {
    const { cookie, csrf } = await signInGoogle();
    const response = await runRunner(cookie, csrf, 'http://other.example/v1/me');
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: 'session_token_not_allowed_for_host' });
  });

  it('rejects a Google access token presented directly on /v1', async () => {
    const { cookie } = await signInGoogle();
    const sessionId = sessionIdOf(harness.app, cookie);
    const tokens = harness.store.getTokens(sessionId);
    if (!tokens) throw new Error('tokens missing');
    const accessToken = harness.services.cipher.open(tokens.accessTokenEnc);
    const response = await harness.app.inject({
      method: 'GET',
      url: '/v1/me',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(response.statusCode).toBe(401);
  });
});
