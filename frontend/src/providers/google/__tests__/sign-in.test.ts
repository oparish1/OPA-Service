import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { configureMocks, getIdentities, getSession, resetMocks, signIn } from '../../../core/mocks/api';
import { setProviderRegistry } from '../../../core/providers/active';
import { googleModule } from '../index';

beforeEach(() => {
  setProviderRegistry([googleModule]);
  resetMocks();
  configureMocks({ latencyMs: 0 });
});

afterEach(() => {
  resetMocks();
});

describe('Google mock sign-in', () => {
  it('returns the Google session for a known provider', async () => {
    const session = await signIn('google');
    expect(session.provider).toBe('Google Workspace / Cloud Identity');
  });

  it('returns the Google identity for the active session', async () => {
    await signIn('google');
    await expect(getSession()).resolves.toMatchObject({
      provider: 'Google Workspace / Cloud Identity',
    });
    await expect(getIdentities()).resolves.toEqual([
      expect.objectContaining({ id: 'google', name: 'Google Workspace / Cloud Identity' }),
    ]);
  });

  it('rejects when the mock is configured to fail', async () => {
    configureMocks({ signInFailure: true });
    await expect(signIn('google')).rejects.toThrow('Sign-in failed');
  });
});
