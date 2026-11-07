import { describe, expect, it } from 'vitest';
import { entraAuthzConfig, entraClaims } from '../claims';
import type { ProviderConfig } from '../../../../../shared/app-config';
import type { ProviderSession } from '../../../core/providers/types';

function session(rawClaims: Record<string, unknown>, scopes: string): ProviderSession {
  return {
    providerId: 'entra',
    providerName: 'Entra',
    issuer: 'https://login.example/tenant/v2.0',
    account: null,
    rawClaims,
    accessToken: { value: 'token', expiresAt: '—', scopes },
  };
}

describe('entra claim normalization', () => {
  it('strips the API resource prefix so a granted scope matches the policy', () => {
    const claims = entraClaims(
      session({ sub: 'subject-1', tid: 'tenant-1', roles: ['Workspace.User'] }, 'api://api-client/workspace:read')
    );
    expect(claims.scopes).toEqual(['workspace:read']);
  });

  it('maps the ID-token claims into the shared contract', () => {
    const claims = entraClaims(
      session(
        { sub: 'subject-1', tid: 'tenant-1', roles: ['Workspace.User'] },
        'api://api-client/workspace:read api://api-client/workspace:write'
      )
    );
    expect(claims).toEqual({
      roles: ['Workspace.User'],
      groups: [],
      scopes: ['workspace:read', 'workspace:write'],
      tenant: 'tenant-1',
      hd: '',
      email_verified: false,
      has_subject: true,
    });
  });

  it('builds the policy config slice from the public provider config', () => {
    const config = { tenant: 'tenant-1' } as ProviderConfig;
    expect(entraAuthzConfig(config)).toEqual({ tenant: 'tenant-1' });
  });
});
