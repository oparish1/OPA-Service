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