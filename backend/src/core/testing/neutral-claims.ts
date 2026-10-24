import type { IdpProfile } from './idp';

/**
 * The neutral test provider's token shapes. It names no real provider and mints
 * the smallest identity a core test needs, so `core/` behaviour can be exercised
 * without a provider module.
 */
export const neutralIdpProfile: IdpProfile = {
  idClaims: () => ({
    sub: 'subject-default',
    email: 'orlando.parish@agentic-advantage.example',
    name: 'Orlando Parish',
  }),
  accessTokenClaims: options => ({
    aud: options.clientId,
    sub: 'subject-default',
    scp: 'profile.read projects.read',
  }),
  scopes: ['openid', 'profile', 'email', 'offline_access'],
};
