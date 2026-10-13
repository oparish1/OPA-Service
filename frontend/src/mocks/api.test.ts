import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  configureMocks,
  discoverSso,
  getIdentities,
  getSession,
  refreshToken,
  resetMocks,
  runRequest,
  signIn,
} from './api';
import { EXPIRED_ACCESS_TOKEN, PROFILE_ENDPOINT, PROJECTS_ENDPOINT } from './data';

beforeEach(() => {
  resetMocks();
  configureMocks({ latencyMs: 0 });
});

afterEach(() => {
  resetMocks();
});

describe('signIn', () => {
  it('returns the demo session for a known provider', async () => {
    const session = await signIn('google');
    expect(session.provider).toBe('Google Workspace / Cloud Identity');
    expect(session.accessToken.scopes).toContain('profile.read');
  });

  it('rejects when the mock is configured to fail', async () => {
    configureMocks({ signInFailure: true });
    await expect(signIn('okta')).rejects.toThrow('Sign-in failed');
  });
});

describe('getSession', () => {
  it('returns the session established by the last sign-in', async () => {
    await signIn('okta');
    await expect(getSession()).resolves.toMatchObject({ provider: 'Okta' });
  });

  it('falls back to the demo session before any sign-in', async () => {
    await expect(getSession()).resolves.toMatchObject({
      provider: 'Google Workspace / Cloud Identity',
    });
  });
});

describe('discoverSso', () => {
  it('resolves a known domain to the provider that owns it', async () => {
    await expect(discoverSso('a@agentic-advantage.example')).resolves.toEqual({
      found: true,
      providerId: 'microsoft',
    });
  });

  it('signs in as the discovered provider', async () => {
    const discovery = await discoverSso('a@agentic-advantage.example');
    if (!discovery.providerId) throw new Error('expected a discovered provider');
    await expect(signIn(discovery.providerId)).resolves.toMatchObject({
      provider: 'Microsoft Entra ID',
    });
  });

  it('reports an unknown domain', async () => {
    await expect(discoverSso('a@unknown.example')).resolves.toEqual({
      found: false,
      providerId: null,
    });
  });

  it('rejects for the seeded offline domain', async () => {
    await expect(discoverSso('a@offline.example')).rejects.toThrow('Network unavailable');
  });
});

describe('runRequest', () => {
  it('returns a 200 profile response by default', async () => {
    const response = await runRequest('valid-token', PROFILE_ENDPOINT);
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ email: expect.any(String) });
  });

  it('returns 401 for the expired token', async () => {
    const response = await runRequest(EXPIRED_ACCESS_TOKEN, PROJECTS_ENDPOINT);
    expect(response.status).toBe(401);
    expect(response.statusLabel).toBe('401 Unauthorized');
  });

  it('returns three projects and an empty list when configured', async () => {
    const populated = await runRequest('valid-token', PROJECTS_ENDPOINT);
    expect(populated.body).toMatchObject({ projects: expect.arrayContaining([expect.any(Object)]) });

    configureMocks({ projectsEmpty: true });
    const empty = await runRequest('valid-token', PROJECTS_ENDPOINT);
    expect(empty.body).toEqual({ projects: [] });
  });

  it('returns a timeout network error when configured', async () => {
    configureMocks({ runRequestFailure: 'timeout' });
    const response = await runRequest('valid-token', PROFILE_ENDPOINT);
    expect(response.statusLabel).toBe('Network error');
    expect(response.body).toEqual({ error: 'request_timeout' });
  });
});

describe('refreshToken', () => {
  it('returns a fresh token', async () => {
    await expect(refreshToken()).resolves.toMatchObject({ value: expect.any(String) });
  });

  it('rejects when configured to fail', async () => {
    configureMocks({ refreshTokenFailure: true });
    await expect(refreshToken()).rejects.toThrow('Refresh token expired');
  });
});

describe('getIdentities', () => {
  it('returns the four demo providers', async () => {
    await expect(getIdentities()).resolves.toHaveLength(4);
  });

  it('returns an empty list when configured', async () => {
    configureMocks({ identitiesEmpty: true });
    await expect(getIdentities()).resolves.toEqual([]);
  });
});
