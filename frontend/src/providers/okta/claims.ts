import type { ProviderConfig } from '../../../../shared/app-config';
import { claimScopes, claimString, claimStringArray } from '../../core/authz/claims';
import type { AuthzClaims } from '../../core/authz/types';
import type { ProviderSession } from '../../core/providers/types';

/** Okta's contribution to the shared policy: groups, subject and granted scopes. */
export function oktaClaims(session: ProviderSession): AuthzClaims {
  const claims = session.rawClaims;
  return {
    roles: [],
    groups: claimStringArray(claims.groups),
    scopes: claimScopes(session.accessToken.scopes),
    tenant: '',
    hd: '',
    email_verified: false,
    has_subject: claimString(claims.uid).length > 0,
  };
}

export function oktaAuthzConfig(config: ProviderConfig): Record<string, unknown> {
  return { required_group: config.requiredGroup ?? '' };
}
