import { readFileSync } from 'node:fs';
import { z } from 'zod';
import type { ProviderLinks } from '../../../../shared/providers';
import { booleanString, firstString, optionalUrl } from '../../core/provider';
import type { ProviderEnv, ProviderRequirement } from '../../core/provider';

export const oktaEnvShape: z.ZodRawShape = {
  OKTA_ENABLED: booleanString.default(false),
  OKTA_ISSUER: z.string().url().optional(),
  OKTA_CLIENT_ID: z.string().min(1).optional(),
  OKTA_CLIENT_SECRET: z.string().min(1).optional(),
  OKTA_CLIENT_PRIVATE_KEY: z.string().min(1).optional(),
  OKTA_CLIENT_PRIVATE_KEY_FILE: z.string().min(1).optional(),
  OKTA_REQUIRED_GROUP: z.string().min(1).optional(),
  OKTA_API_AUDIENCE: z.string().min(1).optional(),
  OKTA_FORGOT_PASSWORD_URL: optionalUrl,
  OKTA_CHANGE_PASSWORD_URL: optionalUrl,
  OKTA_MANAGE_ACCOUNT_URL: optionalUrl,
};

const OKTA_REQUIRED_FIELDS = [
  'OKTA_ISSUER',
  'OKTA_CLIENT_ID',
  'OKTA_REQUIRED_GROUP',
  'OKTA_API_AUDIENCE',
] as const;

export interface OktaProviderConfig {
  issuer: string;
  clientId: string;
  clientSecret?: string;
  clientPrivateKey?: string;
  requiredGroup: string;
  apiAudience: string;
  links: ProviderLinks;
}

export function oktaEnabled(env: ProviderEnv): boolean {
  return env.OKTA_ENABLED === true;
}

export function oktaRequirements(env: ProviderEnv): ReadonlyArray<ProviderRequirement> {
  const missing: ProviderRequirement[] = OKTA_REQUIRED_FIELDS.filter(
    field => !firstString(env[field])
  ).map(field => ({ path: field }));
  const hasCredential = firstString(
    env.OKTA_CLIENT_SECRET,
    env.OKTA_CLIENT_PRIVATE_KEY,
    env.OKTA_CLIENT_PRIVATE_KEY_FILE
  );
  if (!hasCredential) missing.push({ path: 'OKTA_CLIENT_SECRET' });
  return missing;
}

export function oktaLinks(env: ProviderEnv): ProviderLinks {
  return {
    forgotPasswordUrl: firstString(env.OKTA_FORGOT_PASSWORD_URL) || undefined,
    changePasswordUrl: firstString(env.OKTA_CHANGE_PASSWORD_URL) || undefined,
    manageAccountUrl: firstString(env.OKTA_MANAGE_ACCOUNT_URL) || undefined,
  };
}

/** Reads the `OKTA_CLIENT_PRIVATE_KEY_FILE` path; a failure names only the variable. */
function oktaClientPrivateKey(env: ProviderEnv): string | undefined {
  const file = firstString(env.OKTA_CLIENT_PRIVATE_KEY_FILE);
  if (file) {
    try {
      return readFileSync(file, 'utf8');
    } catch {
      throw new Error('Invalid or missing configuration: OKTA_CLIENT_PRIVATE_KEY_FILE could not be read');
    }
  }
  return firstString(env.OKTA_CLIENT_PRIVATE_KEY) || undefined;
}

export function parseOkta(env: ProviderEnv): OktaProviderConfig {
  // The key file is read only for an enabled provider, so the kill switch needs no Okta variables.
  const clientPrivateKey = oktaClientPrivateKey(env);
  return Object.freeze({
    issuer: firstString(env.OKTA_ISSUER),
    clientId: firstString(env.OKTA_CLIENT_ID),
    // A configured private key makes Okta use private_key_jwt; the secret is not sent.
    clientSecret: clientPrivateKey ? undefined : firstString(env.OKTA_CLIENT_SECRET) || undefined,
    clientPrivateKey,
    requiredGroup: firstString(env.OKTA_REQUIRED_GROUP),
    apiAudience: firstString(env.OKTA_API_AUDIENCE),
    links: oktaLinks(env),
  });
}
