import { TestIdp } from '../../../core/testing/idp';
import type { IdpProfile } from '../../../core/testing/idp';

export const googleIdpProfile: IdpProfile = {
  idClaims: options => ({
    sub: 'google-user-1',
    email: 'orlando.parish@agentic-advantage.example',
    name: 'Orlando Parish',
    hd: options.hostedDomain ?? 'agentic-advantage.com',
    email_verified: true,
  }),
  accessTokenClaims: options => ({
    aud: options.clientId,
    sub: 'google-user-1',
  }),
  scopes: ['openid', 'profile', 'email', 'offline_access'],
  metadata: origin => ({ revocation_endpoint: `${origin}/revoke` }),
};

export function createGoogleIdp(
  overrides: { hostedDomain?: string } = {}
): TestIdp {
  return new TestIdp({
    tenantId: 'tenant-1',
    clientId: 'google-client',
    profile: googleIdpProfile,
    hostedDomain: overrides.hostedDomain ?? 'agentic-advantage.com',
  });
}

export function googleTestEnv(idp: TestIdp): Record<string, string | undefined> {
  return {
    GOOGLE_ENABLED: 'true',
    GOOGLE_ISSUER: idp.origin,
    GOOGLE_CLIENT_ID: 'google-client',
    GOOGLE_CLIENT_SECRET: 'google-secret',
    GOOGLE_HOSTED_DOMAIN: 'agentic-advantage.com',
  };
}
