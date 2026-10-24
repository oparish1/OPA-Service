import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  configureMocks,
  discoverSso,
  getIdentities,
  getSession,
  resetMocks,
  signIn,
} from '../../../core/mocks/api';
import { setProviderRegistry } from '../../../core/providers/active';
import { entraModule } from '../index';

beforeEach(() => {
  setProviderRegistry([entraModule]);
  resetMocks();
  configureMocks({ latencyMs: 0 });
});

afterEach(() => {
  resetMocks();
});

describe('Entra mock sign-in', () => {
  it('returns the Entra session for a known provider', async () => {
    const session = await signIn('entra');
    expect(session.provider).toBe('Microsoft Entra ID');
    expect(session.accessToken.scopes).toContain('profile.read');
  });

  it('resolves the seeded domain to Entra', async () => {
    await expect(discoverSso('a@agentic-advantage.example')).resolves.toEqual({
      found: true,
      providerId: 'entra',
    });
  });

  it('returns the Entra identity for the active session', async () => {
    await signIn('entra');
    await expect(getSession()).resolves.toMatchObject({ provider: 'Microsoft Entra ID' });
    await expect(getIdentities()).resolves.toEqual([
      expect.objectContaining({ id: 'entra', name: 'Microsoft Entra ID' }),
    ]);
  });

  it('rejects when the mock is configured to fail', async () => {
    configureMocks({ signInFailure: true });
    await expect(signIn('entra')).rejects.toThrow('Sign-in failed');
  });
});
