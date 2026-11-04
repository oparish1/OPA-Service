import { describe, expect, it } from 'vitest';
import { googleAuthzConfig, googleClaims } from '../claims';
import type { ProviderConfig } from '../../../../../shared/app-config';
import type { ProviderSession } from '../../../core/providers/types';

function session(rawClaims: Record<string, unknown>): ProviderSession {
  return {
    providerId: 'google',
    providerName: 'Google',
    issuer: 'https://accounts.google.com',
    account: null,
    rawClaims,
    accessToken: { value: 'token', expiresAt: '—', scopes: '' },
  };
}

describe('google claim normalization', () => {
  it('maps the hosted domain and subject into the shared contract', () => {
    const claims = googleClaims(
      session({ sub: 'subject-1', hd: 'agentic-advantage.com', email_verified: true })
    );
    expect(claims).toEqual({
      roles: [],
      groups: [],
      scopes: [],
      tenant: '',
      hd: 'agentic-advantage.com',
      email_verified: true,
      has_subject: true,
    });
  });

  it('keeps email_verified false unless the claim is the boolean true', () => {
    expect(googleClaims(session({ email_verified: false })).email_verified).toBe(false);
    expect(googleClaims(session({ email_verified: 'true' })).email_verified).toBe(false);
  });

  it('builds the policy config slice from the public provider config', () => {
    const config = { hostedDomain: 'agentic-advantage.com' } as ProviderConfig;
    expect(googleAuthzConfig(config)).toEqual({ hosted_domain: 'agentic-advantage.com' });
  });
});
