import type { AppConfig } from '../config';
import type { UserProfile } from '../db';
import { PROVIDER_IDS, isProviderId } from '../../../shared/providers';
import type { ProviderId } from '../../../shared/providers';
import { BearerValidator } from './bearer';
import { OidcError, OidcService } from './oidc';

export { PROVIDER_IDS, isProviderId };
export type { ProviderId };

const REFRESH_TOKEN_LIFETIME_MS = 90 * 24 * 60 * 60 * 1000;

export type RefreshExpiry = 'fixed' | 'policy' | 'none';

export interface ProviderDefinition {
  id: ProviderId;
  name: string;
  issuer: string;
  loginPath: string;
  callbackPath: string;
  refreshExpiry: RefreshExpiry;
  /** The session card's refresh-token label; provider-specific, never invented. */
  refreshGrant: string;
  oidc: OidcService;
  bearer: BearerValidator | null;
  /** Best-effort provider-side revocation of a refresh token, when supported. */
  revokeRefresh?: (token: string) => Promise<void>;
  /** Rejects claims that fail the provider's own gating; throws `OidcError(reason)`. */
  gate(claims: Record<string, unknown>): void;
  /** The `(provider, issuer, subject)` subject for this token. */
  subject(claims: Record<string, unknown>): string;
  profile(claims: Record<string, unknown>): UserProfile;
}

export interface ProviderRegistry {
  readonly all: readonly ProviderDefinition[];
  get(id: string): ProviderDefinition | undefined;
}

function firstString(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === 'string' && value.length > 0) return value;
  }
  return '';
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];
}

/** O-18: the accepted issuer is the exact string, not the bare `accounts.google.com` form. */
export function googleIssuerIsExact(claim: unknown, configured: string): boolean {
  return typeof claim === 'string' && claim === configured;
}

function entraDefinition(config: AppConfig): ProviderDefinition {
  const oidc = new OidcService({
    issuer: config.issuer,
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    clientPrivateKey: config.clientPrivateKey,
    publicBaseUrl: config.publicBaseUrl,
    allowInsecureIssuer: config.allowInsecureIssuer,
    callbackPath: '/auth/callback',
    scopes: [
      'openid',
      'profile',
      'email',
      'offline_access',
      `${config.clientId}/profile.read`,
      `${config.clientId}/projects.read`,
    ],
    refreshTokenLifetimeMs: REFRESH_TOKEN_LIFETIME_MS,
    endSession: config.entraEndSession,
  });
  const bearer = new BearerValidator({
    issuer: config.issuer,
    audience: config.apiClientId,
    subjectClaim: 'oid',
    requireTenantId: config.tenantId,
  });
  return {
    id: 'entra',
    name: 'Microsoft Entra ID',
    issuer: config.issuer,
    loginPath: '/auth/login',
    callbackPath: '/auth/callback',
    refreshExpiry: 'fixed',
    refreshGrant: 'offline_access · rotating refresh token',
    oidc,
    bearer,
    gate(claims) {
      if (firstString(claims.tid) !== config.tenantId) {
        throw new OidcError('Wrong tenant', 'wrong_tenant');
      }
      if (!stringArray(claims.roles).includes(config.requiredAppRole)) {
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

function oktaDefinition(config: AppConfig & { okta: NonNullable<AppConfig['okta']> }): ProviderDefinition {
  const okta = config.okta;
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
    id: 'okta',
    name: 'Okta',
    issuer: okta.issuer,
    loginPath: '/auth/login/okta',
    callbackPath: '/auth/callback/okta',
    refreshExpiry: 'policy',
    refreshGrant: 'Rotating refresh token · up to 8 hours',
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

function googleDefinition(
  config: AppConfig & { google: NonNullable<AppConfig['google']> }
): ProviderDefinition {
  const google = config.google;
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
    oidc,
    bearer: null,
    revokeRefresh(token) {
      return oidc.revoke(token);
    },
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

/** Builds the enabled provider definitions and initialises discovery for each. */
export async function buildProviderRegistry(config: AppConfig): Promise<ProviderRegistry> {
  const all: ProviderDefinition[] = [entraDefinition(config)];
  if (config.okta) all.push(oktaDefinition({ ...config, okta: config.okta }));
  if (config.google) all.push(googleDefinition({ ...config, google: config.google }));
  for (const provider of all) {
    await provider.oidc.init();
    const jwksUri = provider.oidc.jwksUri();
    if (provider.bearer && jwksUri) provider.bearer.setJwksUri(jwksUri);
  }
  const byId = new Map<string, ProviderDefinition>(all.map(provider => [provider.id, provider]));
  return {
    all: Object.freeze(all),
    get: id => byId.get(id),
  };
}