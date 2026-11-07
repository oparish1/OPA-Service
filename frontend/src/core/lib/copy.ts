import type { DecisionReason } from '../authz/types';

/** Standing-rule copy shared by the screens that surface it. */
export const GENERIC_ERROR = 'Something went wrong. Try again.';
export const PROVIDER_ERROR = 'Choose an identity provider to continue.';
export const BLOCKED_HOST = 'This host is not allowed. Ask an administrator to add it.';
export const PERMISSIONS_UNAVAILABLE = 'Permissions could not be loaded.';

/** Approved display copy per policy reason; a raw code never reaches the screen. */
export const AUTHZ_REASON_COPY: Record<DecisionReason, string> = {
  not_signed_in: 'Sign in to continue.',
  missing_role: 'Your account does not have the workspace role.',
  missing_group: 'Your account is not in the workspace group.',
  wrong_tenant: 'Your account belongs to a different organisation.',
  wrong_domain: 'Sign in with your workspace account.',
  email_unverified: 'Verify your email address to continue.',
  missing_scope: 'Your session does not have the required permission.',
  insufficient_role: 'Your role does not include this.',
  method_not_allowed: 'This action is not available for your account.',
  permissions_unavailable: PERMISSIONS_UNAVAILABLE,
};

/** The approved copy for a decision reason; an empty reason falls back to the load-failure copy. */
export function permissionReason(reason: DecisionReason | ''): string {
  return reason ? AUTHZ_REASON_COPY[reason] : PERMISSIONS_UNAVAILABLE;
}
