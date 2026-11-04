import { describe, expect, it } from 'vitest';
import { oktaAuthzConfig, oktaClaims } from '../claims';
import type { ProviderConfig } from '../../../../../shared/app-config';
import type { ProviderSession } from '../../../core/providers/types';

function session(rawClaims: Record<string, unknown>, scopes: string): ProviderSession {
  return {
    providerId: 'okta',
    providerName: 'Okta',
    issuer: 'https://dev-1.okta.example/oauth2/default',
    account: null,
    rawClaims,
    accessToken: { value: 'token', expiresAt: '—', scopes },
  };
}

describe('okta claim normalization', () => {
  it('splits a space-delimited scope string so the policy sees bare scopes', () => {
    const claims = oktaClaims(
      session({ uid: 'uid-1', groups: ['Workspace User'] }, 'workspace:read workspace:write')
    );
    expect(claims.scopes).toEqual(['workspace:read', 'workspace:write']);
  });

  it('maps groups, subject and scopes into the shared contract', () => {
    const claims = oktaClaims(session({ uid: 'uid-1', groups: ['Workspace User'] }, 'workspace:read'));
    expect(claims).toEqual({
      roles: [],
      groups: ['Workspace User'],
      scopes: ['workspace:read'],
      tenant: '',
      hd: '',
      email_verified: false,
      has_subject: true,
    });
  });

  it('builds the policy config slice from the public provider config', () => {
    const config = { requiredGroup: 'Workspace User' } as ProviderConfig;
    expect(oktaAuthzConfig(config)).toEqual({ required_group: 'Workspace User' });
  });
});
