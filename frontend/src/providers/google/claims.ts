import type { ProviderConfig } from '../../../../shared/app-config';
import { claimString } from '../../core/authz/claims';
import type { AuthzClaims } from '../../core/authz/types';
import type { ProviderSession } from '../../core/providers/types';

/** Google's contribution to the shared policy: hosted domain, verification and subject. */
export function googleClaims(session: ProviderSession): AuthzClaims {
  const claims = session.rawClaims;
  return {
    roles: [],
    groups: [],
    scopes: [],
    tenant: '',
    hd: claimString(claims.hd),
    email_verified: claims.email_verified === true,
    has_subject: claimString(claims.sub).length > 0,
  };
}

export function googleAuthzConfig(config: ProviderConfig): Record<string, unknown> {
  return { hosted_domain: config.hostedDomain ?? '' };
}
