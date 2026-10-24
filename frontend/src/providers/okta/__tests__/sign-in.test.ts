import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { configureMocks, getIdentities, getSession, resetMocks, signIn } from '../../../core/mocks/api';
import { setProviderRegistry } from '../../../core/providers/active';
import { oktaModule } from '../index';

beforeEach(() => {
  setProviderRegistry([oktaModule]);
  resetMocks();
  configureMocks({ latencyMs: 0 });
});

afterEach(() => {
  resetMocks();
});

describe('Okta mock sign-in', () => {
  it('returns the Okta session for a known provider', async () => {
    const session = await signIn('okta');
    expect(session.provider).toBe('Okta');
  });

  it('returns the Okta identity for the active session', async () => {
    await signIn('okta');
    await expect(getSession()).resolves.toMatchObject({ provider: 'Okta' });
    await expect(getIdentities()).resolves.toEqual([
      expect.objectContaining({ id: 'okta', name: 'Okta' }),
    ]);
  });

  it('rejects when the mock is configured to fail', async () => {
    configureMocks({ signInFailure: true });
    await expect(signIn('okta')).rejects.toThrow('Sign-in failed');
  });
});
