import { createRemoteJWKSet, jwtVerify } from 'jose';
import type { AppConfig } from '../config';

export interface BearerIdentity {
  oid: string;
  tid: string;
  scopes: string[];
}

/** Validates Entra access tokens against the tenant JWKS, issuer and exposed-API audience. */
export class BearerValidator {
  private jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

  constructor(private readonly config: AppConfig) {}

  setJwksUri(jwksUri: string): void {
    this.jwks = createRemoteJWKSet(new URL(jwksUri));
  }

  async validate(token: string, requiredScope?: string): Promise<BearerIdentity> {
    if (!this.jwks) throw new Error('bearer_not_configured');
    const { payload } = await jwtVerify(token, this.jwks, {
      issuer: this.config.issuer,
      audience: this.config.apiClientId,
    });
    if (payload.tid !== this.config.tenantId) throw new Error('wrong_tenant');
    const scopes = typeof payload.scp === 'string' ? payload.scp.split(' ') : [];
    if (requiredScope && !scopes.includes(requiredScope)) throw new Error('missing_scope');
    const oid = typeof payload.oid === 'string' ? payload.oid : '';
    if (!oid) throw new Error('missing_oid');
    return { oid, tid: this.config.tenantId, scopes };
  }
}
