import type { Capabilities, CapabilityId, DecisionReason } from './types';
import { CAPABILITY_IDS } from './types';
import { clearCapabilities, setCapabilities } from './store';

/**
 * A test double for the policy result. Tests seed a full map through the same
 * store API the app uses, so components need no other seam.
 */

export function capabilitiesWith(
  overrides: Partial<Record<CapabilityId, { allowed: boolean; reason?: DecisionReason | '' }>>
): Capabilities {
  const result = {} as Capabilities;
  for (const capability of CAPABILITY_IDS) {
    const override = overrides[capability];
    result[capability] = override
      ? { allowed: override.allowed, reason: override.allowed ? '' : override.reason ?? '' }
      : { allowed: true, reason: '' };
  }
  return result;
}

export function seedCapabilities(capabilities: Capabilities): void {
  setCapabilities(capabilities);
}

export function resetCapabilities(): void {
  clearCapabilities();
}
