import { CAPABILITY_IDS } from './types';
import type { AuthzState, Capabilities, Decision } from './types';

/**
 * The one cached capabilities map. `disabled` keeps the pre-change behavior
 * (everything available); `ready` applies the policy; `error` is the fail-closed
 * floor, so a load or evaluation failure never enables more.
 */

const ALL_ALLOWED: Capabilities = build(() => ({ allowed: true, reason: '' }));

const BASELINE_FLOOR: Capabilities = build(capability =>
  capability === 'nav.overview' || capability === 'nav.account'
    ? { allowed: true, reason: '' }
    : { allowed: false, reason: 'permissions_unavailable' }
);

function build(decide: (capability: (typeof CAPABILITY_IDS)[number]) => Decision): Capabilities {
  const result = {} as Capabilities;
  for (const capability of CAPABILITY_IDS) result[capability] = decide(capability);
  return result;
}

let state: AuthzState = { status: 'disabled', capabilities: ALL_ALLOWED };
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getSnapshot(): AuthzState {
  return state;
}

/** Pre-change behavior: nothing was loaded and every control is available. */
export function clearCapabilities(): void {
  state = { status: 'disabled', capabilities: ALL_ALLOWED };
  emit();
}

export function setCapabilities(capabilities: Capabilities): void {
  state = { status: 'ready', capabilities };
  emit();
}

/** The fail-closed floor: Overview and Account only, with load-failure copy. */
export function setError(): void {
  state = { status: 'error', capabilities: BASELINE_FLOOR };
  emit();
}
