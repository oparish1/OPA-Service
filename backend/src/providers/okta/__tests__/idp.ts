import { TestIdp } from '../../../core/testing/idp';
import type { IdpProfile } from '../../../core/testing/idp';

export const oktaIdpProfile: IdpProfile = {
  idClaims: options => ({
    sub: 'okta-user-1',
    email: 'orlando.parish@agentic-advantage.example',
    name: 'Orlando Parish',
    groups: [options.requiredGroup ?? 'Workspace User'],
  }),
  accessTokenClaims: options => ({
    aud: options.apiAudience ?? 'api://default',
    sub: 'okta-user-1',
    uid: 'okta-uid-1',
    scp: ['openid', 'email', 'profile'],
  }),
  scopes: ['openid', 'profile', 'email', 'groups', 'offline_access'],
};

export function createOktaIdp(
  overrides: { requiredGroup?: string; apiAudience?: string } = {}
): TestIdp {
  return new TestIdp({
    tenantId: 'tenant-1',
    clientId: 'okta-client',
    profile: oktaIdpProfile,
    apiAudience: overrides.apiAudience ?? 'api://default',
    requiredGroup: overrides.requiredGroup ?? 'Workspace User',
  });
}

export function oktaTestEnv(idp: TestIdp): Record<string, string | undefined> {
  return {
    OKTA_ENABLED: 'true',
    OKTA_ISSUER: idp.origin,
    OKTA_CLIENT_ID: 'okta-client',
    OKTA_CLIENT_SECRET: 'okta-secret',
    OKTA_REQUIRED_GROUP: 'Workspace User',
    OKTA_API_AUDIENCE: 'api://default',
  };
}
