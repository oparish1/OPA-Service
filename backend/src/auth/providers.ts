import type { AppConfig } from '../config';
import type { UserProfile } from '../db';
import { BearerValidator } from './bearer';
import { OidcError, OidcService } from './oidc';

const REFRESH_TOKEN_LIFETIME_MS = 90 * 24 * 60 * 60 * 1000;

export const PROVIDER_IDS = ['entra', 'okta', 'google'] as const;
export type ProviderId = (typeof PROVIDER_IDS)[number];
export type RefreshExpiry = 'fixed' | 'policy' | 'none';

export interface ProviderDefinition {
  id: ProviderId;
  name: string;
  issuer: string;
  loginPath: string;
  callbackPath: string;
  refreshExpiry: RefreshExpiry;
  oidc: OidcService;
  bearer: BearerValidator | null;
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

export function isProviderId(value: string): value is ProviderId {
  return (PROVIDER_IDS as readonly string[]).includes(value);
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

/** Builds the enabled provider definitions and initialises discovery for each. */
export async function buildProviderRegistry(config: AppConfig): Promise<ProviderRegistry> {
  const all: ProviderDefinition[] = [entraDefinition(config)];
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
