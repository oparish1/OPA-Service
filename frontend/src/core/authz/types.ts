import { AUTHZ_REASONS, CAPABILITY_IDS } from './generated';
import type { AuthzReason, CapabilityId } from './generated';

export { AUTHZ_REASONS, CAPABILITY_IDS };
export type { AuthzReason, CapabilityId };

/**
 * A reason the UI may render. `permissions_unavailable` is never emitted by the
 * policy: the store uses it for the fail-closed floor when the WASM cannot load
 * or evaluate, so denied controls still carry approved copy.
 */
export type DecisionReason = AuthzReason | 'permissions_unavailable';

export interface Decision {
  allowed: boolean;
  reason: DecisionReason | '';
}

export type Capabilities = Record<CapabilityId, Decision>;

/** The normalized claim set every provider module produces; the shared input contract. */
export interface AuthzClaims {
  roles: string[];
  groups: string[];
  scopes: string[];
  tenant: string;
  hd: string;
  email_verified: boolean;
  has_subject: boolean;
}

export interface AuthzInput {
  provider: string;
  claims: AuthzClaims;
}

export type AuthzStatus = 'disabled' | 'ready' | 'error';

export interface AuthzState {
  status: AuthzStatus;
  capabilities: Capabilities;
}
