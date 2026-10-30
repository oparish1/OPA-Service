import { TestIdp } from '../../../core/testing/idp';
import type { IdpProfile } from '../../../core/testing/idp';

export const entraIdpProfile: IdpProfile = {
  idClaims: options => ({
    oid: 'oid-default',
    tid: options.tenantId,
    email: 'orlando.parish@agentic-advantage.example',
    name: 'Orlando Parish',
    roles: ['Workspace.User'],
  }),
  accessTokenClaims: options => ({
    aud: options.apiAudience ?? options.clientId,
    oid: 'oid-default',
    tid: options.tenantId,
    scp: 'workspace:read workspace:write',
  }),
  scopes: ['openid', 'profile', 'email', 'offline_access'],
};

export function createEntraIdp(
  overrides: { tenantId?: string; clientId?: string; apiAudience?: string } = {}
): TestIdp {
  return new TestIdp({
    tenantId: overrides.tenantId ?? 'tenant-1',
    clientId: overrides.clientId ?? 'client-1',
    apiAudience: overrides.apiAudience ?? overrides.clientId ?? 'client-1',
    profile: entraIdpProfile,
  });
}

export function entraTestEnv(idp: TestIdp): Record<string, string | undefined> {
  return {
    ENTRA_ISSUER: idp.origin,
    ENTRA_TENANT_ID: 'tenant-1',
    ENTRA_CLIENT_ID: 'client-1',
    ENTRA_CLIENT_SECRET: 'secret-1',
  };
}
