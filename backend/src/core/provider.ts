import { z } from 'zod';
import type { ProviderLinks } from '../../../shared/providers';
import type { BearerIdentity, BearerValidator } from './auth/bearer';
import type { OidcService } from './auth/oidc';
import type { AppConfig } from './config';
import type { IdentityKey, Store, UserProfile, UserRecord } from './db';

export type RefreshExpiry = 'fixed' | 'policy' | 'none';

export interface ProviderDefinition {
  id: string;
  name: string;
  issuer: string;
  loginPath: string;
  callbackPath: string;
  refreshExpiry: RefreshExpiry;
  /** The session card's refresh-token label; provider-specific, never invented. */
  refreshGrant: string;
  links: ProviderLinks;
  oidc: OidcService;
  bearer: BearerValidator | null;
  /** Best-effort provider-side revocation of a refresh token, when supported. */
  revokeRefresh?: (token: string) => Promise<void>;
  /** Rejects claims that fail the provider's own gating; throws `OidcError(reason)`. */
  gate(claims: Record<string, unknown>): void;
  /** The `(provider, issuer, subject)` subject for this token. */
  subject(claims: Record<string, unknown>): string;
  profile(claims: Record<string, unknown>): UserProfile;
  /** The account id the session card shows; defaults to the core's provider-neutral form. */
  accountId?(user: UserRecord): string;
  /** Matches the stored row for an identity; defaults to the core's exact-identity lookup. */
  findUser?(store: Store, identity: IdentityKey): UserRecord | null;
  /** Bearer-derived context for audit; only providers with a bearer validator supply it. */
  bearerContext?(identity: BearerIdentity): { oid?: string; tid?: string };
}

export interface ProviderRegistry {
  readonly all: readonly ProviderDefinition[];
  get(id: string): ProviderDefinition | undefined;
  /** The first enabled provider; used where a neutral fallback is required. */
  default(): ProviderDefinition;
}

/** The parsed environment fields a provider module reads; provider-neutral by type. */
export type ProviderEnv = Record<string, unknown>;

export interface ProviderRequirement {
  readonly path: string;
}

/** One provider's self-contained slice: env schema, parsing and runtime definition. */
export interface ProviderModule {
  readonly id: string;
  readonly envShape: z.ZodRawShape;
  enabled(env: ProviderEnv): boolean;
  requirements(env: ProviderEnv): ReadonlyArray<ProviderRequirement>;
  parse(env: ProviderEnv): unknown;
  createDefinition(config: AppConfig, providerConfig: unknown): ProviderDefinition;
}

export const booleanString = z.enum(['true', 'false']).transform(value => value === 'true');

/** An optional URL variable: an empty value is the operator saying "not configured". */
export const optionalUrl = z.preprocess(
  value => (value === '' ? undefined : value),
  z.string().url().optional()
);

export function firstString(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === 'string' && value.length > 0) return value;
  }
  return '';
}

export function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];
}

/** Rejects duplicate ids and freezes the ordered registry; used with fake definitions in tests. */
export function composeProviderRegistry(
  definitions: readonly ProviderDefinition[]
): ProviderRegistry {
  const all = Object.freeze([...definitions]);
  const byId = new Map<string, ProviderDefinition>();
  for (const provider of all) {
    if (byId.has(provider.id)) throw new Error(`duplicate_provider_id:${provider.id}`);
    byId.set(provider.id, provider);
  }
  return {
    all,
    get: id => byId.get(id),
    default: () => {
      const first = all[0];
      if (!first) throw new Error('provider_registry_empty');
      return first;
    },
  };
}

/** Initialises discovery for each provider, then freezes the ordered registry. */
export async function initRegistry(
  definitions: readonly ProviderDefinition[]
): Promise<ProviderRegistry> {
  for (const provider of definitions) {
    await provider.oidc.init();
    const jwksUri = provider.oidc.jwksUri();
    if (provider.bearer && jwksUri) provider.bearer.setJwksUri(jwksUri);
  }
  return composeProviderRegistry(definitions);
}

/** Builds the enabled definitions from the composed modules and initialises each. */
export async function buildProviderRegistry(
  config: AppConfig,
  modules: readonly ProviderModule[]
): Promise<ProviderRegistry> {
  const definitions = modules.flatMap(module => {
    const providerConfig = config.providerConfigs[module.id];
    if (providerConfig === undefined) return [];
    return [module.createDefinition(config, providerConfig)];
  });
  return initRegistry(definitions);
}
