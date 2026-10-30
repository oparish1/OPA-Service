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
  /** Entra only: the API application id URI scopes are composed against. */
  apiResource?: string;
  /** Google only: the Workspace hosted domain the ID token must carry. */
  hostedDomain?: string;
  /** Scopes to request; defaults to `workspace:read`. */
  scopes?: string[];
}

export interface AppConfig {
  /** The gateway origin; the request runner may call no other origin. */
  gatewayUrl: string;
  providers: ProviderConfig[];
}

export class AppConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AppConfigError';
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
  if (secret) throw new AppConfigError(secret);

  const value = raw as Record<string, unknown>;
  const gatewayUrl = requireHttpUrl(value.gatewayUrl, 'gatewayUrl');

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

    return {
      id: id as ProviderConfig['id'],
      name: requireString(provider.name, `providers[${index}].name`),
      clientId: requireString(provider.clientId, `providers[${index}].clientId`),
      issuer: requireHttpUrl(provider.issuer, `providers[${index}].issuer`),
      apiResource:
        provider.apiResource === undefined
          ? undefined
          : requireString(provider.apiResource, `providers[${index}].apiResource`),
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
  });

  return { gatewayUrl, providers };
}
