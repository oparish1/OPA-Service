import { createRemoteJWKSet, jwtVerify } from 'jose';

export interface BearerValidatorOptions {
  issuer: string;
  audience: string;
  /** Claim holding the account subject: Entra `oid`, Okta `uid`. */
  subjectClaim: string;
  requireTenantId?: string;
}

export interface BearerIdentity {
  subject: string;
  tid: string;
  scopes: string[];
}

/** Validates one provider's access tokens against its own issuer, audience and JWKS. */
export class BearerValidator {
  private jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

  constructor(private readonly options: BearerValidatorOptions) {}

  setJwksUri(jwksUri: string): void {
    this.jwks = createRemoteJWKSet(new URL(jwksUri));
  }

  async validate(token: string, requiredScope?: string): Promise<BearerIdentity> {
    if (!this.jwks) throw new Error('bearer_not_configured');
    const { payload } = await jwtVerify(token, this.jwks, {
      issuer: this.options.issuer,
      audience: this.options.audience,
    });
    if (this.options.requireTenantId && payload.tid !== this.options.requireTenantId) {
      throw new Error('wrong_tenant');
    }
    const scopes = typeof payload.scp === 'string' ? payload.scp.split(' ') : [];
    if (requiredScope && !scopes.includes(requiredScope)) throw new Error('missing_scope');
    const value = payload[this.options.subjectClaim];
    const subject = typeof value === 'string' ? value : '';
    if (!subject) throw new Error('missing_subject');
    const tid = typeof payload.tid === 'string' ? payload.tid : '';
    return { subject, tid: this.options.requireTenantId ?? tid, scopes };
  }
}
