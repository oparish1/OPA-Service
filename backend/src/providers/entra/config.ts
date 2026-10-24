import { z } from 'zod';
import type { ProviderLinks } from '../../../../shared/providers';
import { booleanString, firstString, optionalUrl } from '../../core/provider';
import type { ProviderEnv } from '../../core/provider';

export const entraEnvShape: z.ZodRawShape = {
  ENTRA_TENANT_ID: z.string().min(1),
  ENTRA_ISSUER: z.string().url().optional(),
  ENTRA_CLIENT_ID: z.string().min(1),
  ENTRA_CLIENT_SECRET: z.string().min(1).optional(),
  ENTRA_CLIENT_PRIVATE_KEY: z.string().min(1).optional(),
  ENTRA_REQUIRED_APP_ROLE: z.string().min(1).default('Workspace.User'),
  ENTRA_API_CLIENT_ID: z.string().optional(),
  ENTRA_END_SESSION: booleanString.default(false),
  ENTRA_FORGOT_PASSWORD_URL: optionalUrl,
  ENTRA_CHANGE_PASSWORD_URL: optionalUrl,
  ENTRA_MANAGE_ACCOUNT_URL: optionalUrl,
};

export interface EntraProviderConfig {
  tenantId: string;
  issuer: string;
  clientId: string;
  clientSecret?: string;
  clientPrivateKey?: string;
  requiredAppRole: string;
  apiClientId: string;
  endSession: boolean;
  links: ProviderLinks;
}

export function entraEnabled(): boolean {
  return true;
}

export function entraRequirements(env: ProviderEnv): readonly string[] {
  if (firstString(env.ENTRA_CLIENT_SECRET, env.ENTRA_CLIENT_PRIVATE_KEY)) return [];
  return ['ENTRA_CLIENT_SECRET'];
}

/** Never invents a destination: each link is present only when its variable is set. */
export function entraLinks(env: ProviderEnv): ProviderLinks {
  return {
    forgotPasswordUrl: firstString(env.ENTRA_FORGOT_PASSWORD_URL) || undefined,
    changePasswordUrl: firstString(env.ENTRA_CHANGE_PASSWORD_URL) || undefined,
    manageAccountUrl: firstString(env.ENTRA_MANAGE_ACCOUNT_URL) || undefined,
  };
}

export function parseEntra(env: ProviderEnv): EntraProviderConfig {
  const tenantId = firstString(env.ENTRA_TENANT_ID);
  const clientId = firstString(env.ENTRA_CLIENT_ID);
  return Object.freeze({
    tenantId,
    issuer:
      firstString(env.ENTRA_ISSUER) || `https://login.microsoftonline.com/${tenantId}/v2.0`,
    clientId,
    clientSecret: firstString(env.ENTRA_CLIENT_SECRET) || undefined,
    clientPrivateKey: firstString(env.ENTRA_CLIENT_PRIVATE_KEY) || undefined,
    requiredAppRole: firstString(env.ENTRA_REQUIRED_APP_ROLE),
    apiClientId: firstString(env.ENTRA_API_CLIENT_ID) || clientId,
    endSession: env.ENTRA_END_SESSION === true,
    links: entraLinks(env),
  });
}
