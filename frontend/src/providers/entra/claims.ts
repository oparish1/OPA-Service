import type { ProviderConfig } from '../../../../shared/app-config';
import { claimScopes, claimStringArray } from '../../core/authz/claims';
import type { AuthzClaims } from '../../core/authz/types';
import { claimString } from '../../core/lib/claims';
import type { ProviderSession } from '../../core/providers/types';

/**
 * Entra's contribution to the shared policy. The roles and tenant come from the
 * ID token; the granted scopes come from MSAL's result, with the API resource
 * prefix stripped so `api://x/workspace:read` matches the policy's bare scope.
 */
export function entraClaims(session: ProviderSession): AuthzClaims {
  const claims = session.rawClaims;
  return {
    roles: claimStringArray(claims.roles),
    groups: [],
    scopes: claimScopes(session.accessToken.scopes).map(bareScope),
    tenant: claimString(claims.tid),
    hd: '',
    email_verified: false,
    has_subject: claimString(claims.sub).length > 0,
  };
}

export function entraAuthzConfig(config: ProviderConfig): Record<string, unknown> {
  return { tenant: config.tenant ?? '' };
}

function bareScope(scope: string): string {
  const slash = scope.lastIndexOf('/');
  return slash === -1 ? scope : scope.slice(slash + 1);
}
