/**
 * The identity providers the product supports. The backend registers these ids
 * and the frontend renders their buttons, so the list lives in one module rather
 * than as two hand-written sets that can drift apart.
 */

export const PROVIDER_IDS = ['entra', 'okta', 'google'] as const;
export type ProviderId = (typeof PROVIDER_IDS)[number];

export function isProviderId(value: string): value is ProviderId {
  return (PROVIDER_IDS as readonly string[]).includes(value);
}

/** Public provider-hosted account destinations; a link is hidden when unset. */
export interface ProviderLinks {
  forgotPasswordUrl?: string;
  changePasswordUrl?: string;
  manageAccountUrl?: string;
}

/**
 * The `GET /auth/providers` wire contract. The backend serialises it and the
 * frontend consumes it, so the destination field names have one owner.
 */
export interface ProviderInfo extends ProviderLinks {
  id: string;
  name: string;
}
