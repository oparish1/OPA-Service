import type { ProviderId } from '../../../../shared/providers';
import { BearerValidator } from '../../core/auth/bearer';
import { OidcError, OidcService } from '../../core/auth/oidc';
import type { AppConfig } from '../../core/config';
import { firstString, stringArray } from '../../core/provider';
import type { ProviderDefinition } from '../../core/provider';
import type { EntraProviderConfig } from './config';

const REFRESH_TOKEN_LIFETIME_MS = 90 * 24 * 60 * 60 * 1000;

export function createEntraDefinition(
  config: AppConfig,
  entra: EntraProviderConfig
): ProviderDefinition {
  const oidc = new OidcService({
    issuer: entra.issuer,
    clientId: entra.clientId,
    clientSecret: entra.clientSecret,
    clientPrivateKey: entra.clientPrivateKey,
    publicBaseUrl: config.publicBaseUrl,
    allowInsecureIssuer: config.allowInsecureIssuer,
    callbackPath: '/auth/callback',
    scopes: [
      'openid',
      'profile',
      'email',
      'offline_access',
      `${entra.clientId}/profile.read`,
      `${entra.clientId}/projects.read`,
    ],
    refreshTokenLifetimeMs: REFRESH_TOKEN_LIFETIME_MS,
    endSession: entra.endSession,
  });
  const bearer = new BearerValidator({
    issuer: entra.issuer,
    audience: entra.apiClientId,
    subjectClaim: 'oid',
    requireTenantId: entra.tenantId,
  });
  return {
    id: 'entra' satisfies ProviderId,
    name: 'Microsoft Entra ID',
    issuer: entra.issuer,
    loginPath: '/auth/login',
    callbackPath: '/auth/callback',
    refreshExpiry: 'fixed',
    refreshGrant: 'offline_access · rotating refresh token',
    links: entra.links,
    oidc,
    bearer,
    accountId: user => `acct_${user.oid}`,
    findUser: (store, identity) =>
      store.getUserByProviderSubject(identity.provider, identity.subject) ??
      store.getUserByProviderOidWithoutSubject(identity.provider, identity.subject),
    bearerContext: identity => ({ oid: identity.subject, tid: identity.tid }),
    gate(claims) {
      if (firstString(claims.tid) !== entra.tenantId) {
        throw new OidcError('Wrong tenant', 'wrong_tenant');
      }
      if (!stringArray(claims.roles).includes(entra.requiredAppRole)) {
        throw new OidcError('Missing app role', 'no_role');
      }
      if (!firstString(claims.oid, claims.sub)) {
        throw new OidcError('Missing subject', 'missing_subject');
      }
    },
    subject(claims) {
      return firstString(claims.oid, claims.sub);
    },
    profile(claims) {
      return {
        tid: firstString(claims.tid),
        oid: firstString(claims.oid, claims.sub),
        email: firstString(claims.email, claims.preferred_username, claims.upn),
        displayName: firstString(claims.name, claims.preferred_username),
        organisation: firstString(claims.org, claims.tenant_region_scope),
      };
    },
  };
}
