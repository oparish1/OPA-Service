import type { ProviderId } from '../../../../shared/providers';
import { BearerValidator } from '../../core/auth/bearer';
import { OidcError, OidcService } from '../../core/auth/oidc';
import type { AppConfig } from '../../core/config';
import { firstString, stringArray } from '../../core/provider';
import type { ProviderDefinition } from '../../core/provider';
import type { OktaProviderConfig } from './config';

export function createOktaDefinition(
  config: AppConfig,
  okta: OktaProviderConfig
): ProviderDefinition {
  const oidc = new OidcService({
    issuer: okta.issuer,
    clientId: okta.clientId,
    clientSecret: okta.clientSecret,
    clientPrivateKey: okta.clientPrivateKey,
    publicBaseUrl: config.publicBaseUrl,
    allowInsecureIssuer: config.allowInsecureIssuer,
    callbackPath: '/auth/callback/okta',
    scopes: ['openid', 'profile', 'email', 'groups', 'offline_access'],
    refreshTokenLifetimeMs: null,
    endSession: false,
  });
  const bearer = new BearerValidator({
    issuer: okta.issuer,
    audience: okta.apiAudience,
    subjectClaim: 'uid',
    enforceScope: false,
  });
  return {
    id: 'okta' satisfies ProviderId,
    name: 'Okta',
    issuer: okta.issuer,
    loginPath: '/auth/login/okta',
    callbackPath: '/auth/callback/okta',
    refreshExpiry: 'policy',
    refreshGrant: 'Rotating refresh token · up to 8 hours',
    links: okta.links,
    oidc,
    bearer,
    gate(claims) {
      if (!stringArray(claims.groups).includes(okta.requiredGroup)) {
        throw new OidcError('Missing required group', 'no_group');
      }
      if (!firstString(claims.sub)) {
        throw new OidcError('Missing subject', 'missing_subject');
      }
    },
    subject(claims) {
      return firstString(claims.sub);
    },
    profile(claims) {
      return {
        email: firstString(claims.email, claims.preferred_username),
        displayName: firstString(claims.name, claims.preferred_username),
        organisation: firstString(claims.organisation, claims.org),
      };
    },
  };
}
