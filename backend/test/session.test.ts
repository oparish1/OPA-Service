import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import {
  completeLogin,
  createTestHarness,
  sessionCookie,
  sessionCsrf,
  sessionIdOf,
} from './helpers/harness';
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

async function signIn(): Promise<{ name: string; value: string; csrf: string }> {
  const { response } = await completeLogin(harness.app, idp);
  const cookie = sessionCookie(response);
  const csrf = await sessionCsrf(harness.app, cookie);
  return { ...cookie, csrf };
}

describe('session timeouts (A7)', () => {
  it('rejects a session idle for more than 30 minutes', async () => {
    const user = harness.store.upsertUserByIdentity(
      { provider: 'test', issuer: 'https://test.example', subject: 'o1' },
      { email: 'a@x', displayName: 'A', organisation: 'AA' }
    );
    harness.store.createSession({
      id: 'idle-session',
      userId: user.id,
      csrfToken: 'csrf',
      createdAt: Date.now(),
      lastSeenAt: Date.now() - 31 * 60 * 1000,
    });
    const response = await harness.app.inject({
      method: 'GET',
      url: '/api/session',
      cookies: { aa_session: harness.app.signCookie('idle-session') },
    });
    expect(response.statusCode).toBe(401);
    expect(harness.store.getSession('idle-session')).toBeNull();
  });

  it('rejects a session older than 8 hours even when recently active', async () => {
    const user = harness.store.upsertUserByIdentity(
      { provider: 'test', issuer: 'https://test.example', subject: 'o1' },
      { email: 'a@x', displayName: 'A', organisation: 'AA' }
    );
    harness.store.createSession({
      id: 'old-session',
      userId: user.id,
      csrfToken: 'csrf',
      createdAt: Date.now() - 9 * 60 * 60 * 1000,
      lastSeenAt: Date.now(),
    });
    const response = await harness.app.inject({
      method: 'GET',
      url: '/api/session',
      cookies: { aa_session: harness.app.signCookie('old-session') },
    });
    expect(response.statusCode).toBe(401);
    expect(harness.store.getSession('old-session')).toBeNull();
  });

  it('rolls the session cookie on an authenticated request', async () => {
    const cookie = await signIn();
    const response = await harness.app.inject({
      method: 'GET',
      url: '/api/session',
      cookies: { [cookie.name]: cookie.value },
    });
    expect(response.statusCode).toBe(200);
    const setCookie = ([] as string[]).concat(response.headers['set-cookie'] ?? []);
    const sessionHeader = setCookie.find(header => header.startsWith('aa_session='));
    expect(sessionHeader).toBeDefined();
    expect(sessionHeader).toContain('Max-Age=1800');
  });

  it('rejects an unsigned session cookie so a rotated secret ends the session', async () => {
    const cookie = await signIn();
    const unsigned = await harness.app.inject({
      method: 'GET',
      url: '/api/session',
      cookies: { [cookie.name]: sessionIdOf(harness.app, cookie) },
    });
    expect(unsigned.statusCode).toBe(401);
  });
});

describe('logout (A8)', () => {
  it('destroys the server-side session so the old cookie returns 401', async () => {
    const cookie = await signIn();
    const logout = await harness.app.inject({
      method: 'POST',
      url: '/auth/logout',
      cookies: { [cookie.name]: cookie.value },
      headers: { 'x-csrf-token': cookie.csrf, origin: harness.config.allowedOrigin },
    });
    expect(logout.statusCode).toBe(204);
    expect(harness.store.getSession(sessionIdOf(harness.app, cookie))).toBeNull();

    const after = await harness.app.inject({
      method: 'GET',
      url: '/api/session',
      cookies: { [cookie.name]: cookie.value },
    });
    expect(after.statusCode).toBe(401);
  });
});
