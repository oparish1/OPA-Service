import { AUTHZ_REASONS, CAPABILITY_IDS } from './generated';
import type { AuthzReason, CapabilityId } from './generated';

export { AUTHZ_REASONS, CAPABILITY_IDS };
export type { AuthzReason, CapabilityId };

/**
 * A reason the UI may render. `permissions_unavailable` is never emitted by the
 * policy: the store uses it for the fail-closed floor when the capability call
 * fails, so denied controls still carry approved copy.
 */
export type DecisionReason = AuthzReason | 'permissions_unavailable';

export interface Decision {
  allowed: boolean;
  reason: DecisionReason | '';
}

export type Capabilities = Record<CapabilityId, Decision>;

export type AuthzStatus = 'disabled' | 'ready' | 'error';

export interface AuthzState {
  status: AuthzStatus;
  capabilities: Capabilities;
}
