import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  bootstrapSession,
  configureMocks,
  discoverSso,
  getIdentities,
  getSession,
  refreshToken,
  resetMocks,
  revealToken,
  runRequest,
  signIn,
} from './api';
import { PROFILE_PATH, PROJECTS_PATH } from '../lib/runner-url';

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
  it('returns a 200 profile response for the session option', async () => {
    const response = await runRequest('session', PROFILE_PATH);
    expect(response.status).toBe(200);
    expect(response.bodyKind).toBe('json');
    expect(response.body).toMatchObject({ email: expect.any(String) });
  });

  it('returns three projects and an empty list when configured', async () => {
    const populated = await runRequest('session', PROJECTS_PATH);
    expect(populated.body).toMatchObject({ projects: expect.arrayContaining([expect.any(Object)]) });

    configureMocks({ projectsEmpty: true });
    const empty = await runRequest('session', PROJECTS_PATH);
    expect(empty.body).toEqual({ projects: [] });
  });

  for (const auth of ['valid-token-123', 'expired-token', 'none'] as const) {
    it(`returns 401 for the ${auth} option without a bypass`, async () => {
      const response = await runRequest(auth, PROFILE_PATH);
      expect(response.status).toBe(401);
      expect(response.statusLabel).toBe('401 Unauthorized');
    });
  }

  it('returns a timeout network error when configured', async () => {
    configureMocks({ runRequestFailure: 'timeout' });
    const response = await runRequest('session', PROFILE_PATH);
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
  it('returns only the enabled provider', async () => {
    await expect(getIdentities()).resolves.toEqual([
      expect.objectContaining({ id: 'microsoft', name: 'Microsoft Entra ID' }),
    ]);
  });

  it('returns an empty list when configured', async () => {
    configureMocks({ identitiesEmpty: true });
    await expect(getIdentities()).resolves.toEqual([]);
  });
});

describe('revealToken', () => {
  it('returns the demo access and refresh values', async () => {
    await expect(revealToken('access')).resolves.toBe('demo_at_op_20261010_orlando_parish_9b4e');
    await expect(revealToken('refresh')).resolves.toBe('demo_rt_agadv_20261011_orlando_parish_7c2f');
  });
});

describe('bootstrapSession', () => {
  it('never restores a mock session', async () => {
    await signIn('microsoft');
    await expect(bootstrapSession()).resolves.toBe(false);
  });
});
