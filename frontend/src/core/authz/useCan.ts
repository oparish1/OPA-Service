import type { CapabilityId, Decision } from './types';
import { useCapabilities } from './useCapabilities';

/** The advisory decision for one capability; the gateway still enforces. */
export function useCan(capability: CapabilityId): Decision {
  return useCapabilities().capabilities[capability];
}
