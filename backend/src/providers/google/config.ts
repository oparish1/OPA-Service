import { z } from 'zod';
import type { ProviderLinks } from '../../../../shared/providers';
import { booleanString, firstString, optionalUrl } from '../../core/provider';
import type { ProviderEnv } from '../../core/provider';

const GOOGLE_REQUIRED_FIELDS = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_HOSTED_DOMAIN'] as const;

const DEFAULT_GOOGLE_ISSUER = 'https://accounts.google.com';

export const googleEnvShape: z.ZodRawShape = {
  GOOGLE_ENABLED: booleanString.default(false),
  GOOGLE_CLIENT_ID: z.string().min(1).optional(),
  GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),
  GOOGLE_HOSTED_DOMAIN: z.string().min(1).optional(),
  GOOGLE_ISSUER: optionalUrl,
  GOOGLE_PROMPT_CONSENT: booleanString.default(false),
  GOOGLE_FORGOT_PASSWORD_URL: optionalUrl,
  GOOGLE_CHANGE_PASSWORD_URL: optionalUrl,
  GOOGLE_MANAGE_ACCOUNT_URL: optionalUrl,
};

export interface GoogleProviderConfig {
  clientId: string;
  clientSecret: string;
  hostedDomain: string;
  issuer: string;
  promptConsent: boolean;
  links: ProviderLinks;
}

export function googleEnabled(env: ProviderEnv): boolean {
  return env.GOOGLE_ENABLED === true;
}

export function googleRequirements(env: ProviderEnv): readonly string[] {
  return GOOGLE_REQUIRED_FIELDS.filter(field => !firstString(env[field]));
}

export function googleLinks(env: ProviderEnv): ProviderLinks {
  return {
    forgotPasswordUrl: firstString(env.GOOGLE_FORGOT_PASSWORD_URL) || undefined,
    changePasswordUrl: firstString(env.GOOGLE_CHANGE_PASSWORD_URL) || undefined,
    manageAccountUrl: firstString(env.GOOGLE_MANAGE_ACCOUNT_URL) || undefined,
  };
}

export function parseGoogle(env: ProviderEnv): GoogleProviderConfig {
  return Object.freeze({
    clientId: firstString(env.GOOGLE_CLIENT_ID),
    clientSecret: firstString(env.GOOGLE_CLIENT_SECRET),
    hostedDomain: firstString(env.GOOGLE_HOSTED_DOMAIN),
    issuer: firstString(env.GOOGLE_ISSUER) || DEFAULT_GOOGLE_ISSUER,
    promptConsent: env.GOOGLE_PROMPT_CONSENT === true,
    links: googleLinks(env),
  });
}
