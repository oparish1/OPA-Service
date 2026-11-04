/** The capability ids the shared Rego policy decides; the array is the single owner. */
export const CAPABILITY_IDS = [
  'nav.overview',
  'nav.account',
  'nav.api.profile',
  'nav.api.projects',
  'action.api.send.read',
  'action.api.send.write',
] as const;

export type CapabilityId = (typeof CAPABILITY_IDS)[number];

/** The neutral reason codes the shared policy emits. */
export type AuthzReason =
  | 'not_signed_in'
  | 'missing_role'
  | 'missing_group'
  | 'wrong_tenant'
  | 'wrong_domain'
  | 'email_unverified'
  | 'missing_scope'
  | 'method_not_allowed';

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
