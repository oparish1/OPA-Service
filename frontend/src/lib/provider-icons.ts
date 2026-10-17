import { isProviderId } from '../../../shared/providers';
import type { ProviderId } from '../../../shared/providers';

/** Icon names are a frontend concern; the BFF provider contract carries no UI names. */
const ICONS: Record<ProviderId, string> = {
  entra: 'building-2',
  okta: 'circle-dot',
  google: 'google',
};

export function providerIcon(id: string): string {
  return isProviderId(id) ? ICONS[id] : 'building-2';
}