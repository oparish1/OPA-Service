/**
 * The identity providers the product supports. The frontend registry, the
 * public config schema and the gateway routes all key off these ids, so the
 * list lives in one module rather than as hand-written sets that can drift.
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
 * The provider list the sign-in and recovery screens render. The browser
 * builds it from the public config, so the destination field names have one
 * owner.
 */
export interface ProviderInfo extends ProviderLinks {
  id: string;
  name: string;
}
