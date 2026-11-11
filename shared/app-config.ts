import { PROVIDER_IDS } from './providers';
import type { ProviderLinks } from './providers';

/**
 * The static public configuration the browser loads at runtime (FE-1). It is
 * the one file besides `shared/providers.ts` and the provider registries that
 * may name more than one provider id (A21).
 */

export interface ProviderConfig extends ProviderLinks {
  id: (typeof PROVIDER_IDS)[number];
  name: string;
  clientId: string;
  issuer: string;
  /** Where the identity provider sends the browser back after sign-in (redirect-based providers). */
  redirectUri?: string;
  /** Entra only: the API application id URI scopes are composed against. */
  apiResource?: string;
  /** Entra only: the tenant the token's `tid` claim must match. */
  tenant?: string;
  /** Google only: the Workspace hosted domain the ID token must carry. */
  hostedDomain?: string;
  /** Scopes to request; defaults to `workspace:read`. */
  scopes?: string[];
}

export type AppLogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVELS: readonly AppLogLevel[] = ['debug', 'info', 'warn', 'error'];

export interface AuthzConfig {
  /** When false the browser skips the capability call and keeps pre-change behavior. */
  enabled: boolean;
}

export interface AppConfig {
  /** The gateway origin; the request runner may call no other origin. */
  gatewayUrl: string;
  providers: ProviderConfig[];
  /** Optional browser log level; defaults to debug in development and warn in production. */
  logLevel?: AppLogLevel;
  /** Advisory UI authorization; the gateway enforces regardless. */
  authz: AuthzConfig;
}

export type AppConfigErrorReason = 'invalid' | 'secret';

export class AppConfigError extends Error {
  readonly reason: AppConfigErrorReason;

  constructor(message: string, reason: AppConfigErrorReason = 'invalid') {
    super(message);
    this.name = 'AppConfigError';
    this.reason = reason;
  }
}

const SECRET_KEY = /^(client_?secret|private_?key|api_?key|password|secret)$/i;
const PEM = /-----BEGIN [A-Z ]*PRIVATE KEY-----/;
const LONG_BASE64 = /^[A-Za-z0-9+/]{40,}={0,2}$/;
const LOOKS_LIKE_JWT = /^[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}$/;

/** Fails closed on a value that looks like a secret, not on public identifiers. */
export function findSecretLikeValue(config: unknown, path = 'config'): string | null {
  if (typeof config === 'string') {
    if (PEM.test(config) || LONG_BASE64.test(config) || LOOKS_LIKE_JWT.test(config)) {
      return `${path} looks like a secret`;
    }
    return null;
  }
  if (Array.isArray(config)) {
    for (const [index, value] of config.entries()) {
      const found = findSecretLikeValue(value, `${path}[${index}]`);
      if (found) return found;
    }
    return null;
  }
  if (config && typeof config === 'object') {
    for (const [key, value] of Object.entries(config)) {
      if (value !== undefined && SECRET_KEY.test(key)) return `${path}.${key} looks like a secret`;
      const found = findSecretLikeValue(value, `${path}.${key}`);
      if (found) return found;
    }
    return null;
  }
  return null;
}

function requireString(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new AppConfigError(`${path} must be a non-empty string`);
  }
  return value;
}

function requireHttpUrl(value: unknown, path: string): string {
  const text = requireString(value, path);
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    throw new AppConfigError(`${path} must be a valid URL`);
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new AppConfigError(`${path} must be http or https`);
  }
  return text;
}

/**
 * Validates the public config. Unknown provider ids and duplicate ids fail
 * closed; a secret-looking value fails the build (A18).
 */
export function parseAppConfig(raw: unknown): AppConfig {
  if (!raw || typeof raw !== 'object') throw new AppConfigError('config must be an object');

  const secret = findSecretLikeValue(raw);
  if (secret) throw new AppConfigError(secret, 'secret');

  const value = raw as Record<string, unknown>;
  const gatewayUrl = requireHttpUrl(value.gatewayUrl, 'gatewayUrl');

  const logLevel = value.logLevel;
  if (logLevel !== undefined && !LOG_LEVELS.includes(logLevel as AppLogLevel)) {
    throw new AppConfigError(`logLevel must be one of ${LOG_LEVELS.join(', ')}`);
  }

  if (!Array.isArray(value.providers) || value.providers.length === 0) {
    throw new AppConfigError('providers must be a non-empty array');
  }

  const seen = new Set<string>();
  const providers = value.providers.map((entry, index) => {
    if (!entry || typeof entry !== 'object') {
      throw new AppConfigError(`providers[${index}] must be an object`);
    }
    const provider = entry as Record<string, unknown>;
    const id = requireString(provider.id, `providers[${index}].id`);
    if (!(PROVIDER_IDS as readonly string[]).includes(id)) {
      throw new AppConfigError(`providers[${index}].id is not a supported provider`);
    }
    if (seen.has(id)) throw new AppConfigError(`duplicate provider id ${id}`);
    seen.add(id);

    const scopes = provider.scopes;
    if (scopes !== undefined && (!Array.isArray(scopes) || scopes.some(s => typeof s !== 'string'))) {
      throw new AppConfigError(`providers[${index}].scopes must be an array of strings`);
    }

    const normalized: ProviderConfig = {
      id: id as ProviderConfig['id'],
      name: requireString(provider.name, `providers[${index}].name`),
      clientId: requireString(provider.clientId, `providers[${index}].clientId`),
      issuer: requireHttpUrl(provider.issuer, `providers[${index}].issuer`),
      redirectUri:
        provider.redirectUri === undefined
          ? undefined
          : requireHttpUrl(provider.redirectUri, `providers[${index}].redirectUri`),
      apiResource:
        provider.apiResource === undefined
          ? undefined
          : requireString(provider.apiResource, `providers[${index}].apiResource`),
      tenant:
        provider.tenant === undefined
          ? undefined
          : requireString(provider.tenant, `providers[${index}].tenant`),
      hostedDomain:
        provider.hostedDomain === undefined
          ? undefined
          : requireString(provider.hostedDomain, `providers[${index}].hostedDomain`),
      scopes: scopes as string[] | undefined,
      forgotPasswordUrl:
        provider.forgotPasswordUrl === undefined
          ? undefined
          : requireHttpUrl(provider.forgotPasswordUrl, `providers[${index}].forgotPasswordUrl`),
      changePasswordUrl:
        provider.changePasswordUrl === undefined
          ? undefined
          : requireHttpUrl(provider.changePasswordUrl, `providers[${index}].changePasswordUrl`),
      manageAccountUrl:
        provider.manageAccountUrl === undefined
          ? undefined
          : requireHttpUrl(provider.manageAccountUrl, `providers[${index}].manageAccountUrl`),
    };

    // The role and group the policy used to compare are now derived from the
    // provider claim through the shared claim-to-role map; any field outside
    // the normalized shape fails the build, so the schema cannot drift from
    // `ProviderConfig`.
    for (const key of Object.keys(provider)) {
      if (!Object.hasOwn(normalized, key)) {
        throw new AppConfigError(`providers[${index}].${key} is not a supported field`);
      }
    }

    return normalized;
  });

  return { gatewayUrl, providers, logLevel: logLevel as AppLogLevel | undefined, authz: parseAuthz(value.authz) };
}

function parseAuthz(raw: unknown): AuthzConfig {
  if (raw === undefined) return { enabled: true };
  if (!raw || typeof raw !== 'object') throw new AppConfigError('authz must be an object');
  const value = raw as Record<string, unknown>;
  // The old per-provider role/group keys lived under `authz`; any key outside
  // the normalized shape fails the build rather than being silently dropped.
  for (const key of Object.keys(value)) {
    if (key !== 'enabled') throw new AppConfigError(`authz.${key} is not a supported field`);
  }
  const enabled = value.enabled;
  if (enabled !== undefined && typeof enabled !== 'boolean') {
    throw new AppConfigError('authz.enabled must be a boolean');
  }
  return { enabled: enabled !== false };
}
