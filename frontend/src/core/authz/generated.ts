/**
 * Generated from the shared policy by `frontend/scripts/authz-codegen.ts`.
 * Do not edit by hand; run `bun run gen:authz`.
 */

export const CAPABILITY_IDS = [
  'action.api.send.read',
  'action.api.send.write',
  'action.projects.delete',
  'action.unmapped.write',
  'data.actor.list',
  'data.customer.details',
  'data.customer.list',
  'data.customer.write',
  'data.film.list',
  'data.staff.list',
  'data.unmapped',
  'nav.account',
  'nav.api.profile',
  'nav.api.projects',
  'nav.overview',
] as const;

export type CapabilityId = (typeof CAPABILITY_IDS)[number];

export const AUTHZ_REASONS = [
  'method_not_allowed',
  'not_signed_in',
  'missing_role',
  'missing_group',
  'wrong_tenant',
  'wrong_domain',
  'email_unverified',
  'missing_scope',
  'insufficient_role',
] as const;

export type AuthzReason = (typeof AUTHZ_REASONS)[number];

/** The normalized claim set every caller supplies to the shared policy. */
export interface AuthzClaims {
  roles: string[];
  groups: string[];
  scopes: string[];
  tenant: string;
  hd: string;
  email_verified: boolean;
  has_subject: boolean;
}
