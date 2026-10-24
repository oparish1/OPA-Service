import { OidcError, OidcService } from '../../core/auth/oidc';
import type { AppConfig } from '../../core/config';
import { firstString } from '../../core/provider';
import type { ProviderDefinition } from '../../core/provider';
import type { GoogleProviderConfig } from './config';

/** O-18: the accepted issuer is the exact string, not the bare `accounts.google.com` form. */
export function googleIssuerIsExact(claim: unknown, configured: string): boolean {
  return typeof claim === 'string' && claim === configured;
}

export function createGoogleDefinition(
  config: AppConfig,
  google: GoogleProviderConfig
): ProviderDefinition {
  const extraAuthorizationParams = {
    access_type: 'offline',
    ...(google.promptConsent ? { prompt: 'consent' } : {}),
  };
  const oidc = new OidcService({
    issuer: google.issuer,
    clientId: google.clientId,
    clientSecret: google.clientSecret,
    publicBaseUrl: config.publicBaseUrl,
    allowInsecureIssuer: config.allowInsecureIssuer,
    callbackPath: '/auth/callback/google',
    scopes: ['openid', 'email', 'profile'],
    extraAuthorizationParams,
    refreshTokenLifetimeMs: null,
    endSession: false,
  });
  return {
    id: 'google',
    name: 'Google Workspace / Cloud Identity',
    issuer: google.issuer,
    loginPath: '/auth/login/google',
    callbackPath: '/auth/callback/google',
    refreshExpiry: 'none',
    refreshGrant: 'Refresh token · up to 8 hours (app limit)',
    links: google.links,
    oidc,
    bearer: null,
    revokeRefresh(token) {
      return oidc.revoke(token);
    },
    accountId: user => `acct_${user.provider}_${user.subject}`,
    findUser: (store, identity) =>
      store.getUserByIdentity(identity.provider, identity.issuer, identity.subject),
    gate(claims) {
      if (!googleIssuerIsExact(claims.iss, google.issuer)) {
        throw new OidcError('Wrong issuer', 'wrong_issuer');
      }
      if (firstString(claims.hd) !== google.hostedDomain) {
        throw new OidcError('Wrong hosted domain', 'wrong_hd');
      }
      if (claims.email_verified !== true) {
        throw new OidcError('Email not verified', 'email_unverified');
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
        email: firstString(claims.email),
        displayName: firstString(claims.name),
        organisation: firstString(claims.hd),
      };
    },
  };
}
