import { AUTHZ_REASONS, CAPABILITY_IDS } from './generated';
import type { AuthzReason, CapabilityId } from './generated';

export { AUTHZ_REASONS, CAPABILITY_IDS };
export type { AuthzReason, CapabilityId };

/**
 * The normalized claim set every caller supplies to the shared policy. The
 * published policy contract has no `claim_contract`, so this input shape is
 * owned here rather than generated.
 */
export interface AuthzClaims {
  roles: string[];
  groups: string[];
  scopes: string[];
  tenant: string;
  hd: string;
  email_verified: boolean;
  has_subject: boolean;
}

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
