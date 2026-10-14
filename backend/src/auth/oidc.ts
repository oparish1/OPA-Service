import { importPKCS8 } from 'jose';
import * as client from 'openid-client';
import type { AppConfig } from '../config';

const REFRESH_TOKEN_LIFETIME_MS = 90 * 24 * 60 * 60 * 1000;
const ASSUMED_ACCESS_TOKEN_LIFETIME_SECONDS = 3600;

export interface OidcIdentity {
  tid: string;
  oid: string;
  email: string;
  displayName: string;
  organisation: string;
  roles: string[];
  amr: string[];
}

export interface OidcTokens {
  accessToken: string;
  refreshToken: string;
  idToken: string;
  accessExpiresAt: number;
  refreshExpiresAt: number;
  scopes: string;
  identity: OidcIdentity;
}

export interface OidcLoginStart {
  url: string;
  state: string;
  nonce: string;
  codeVerifier: string;
}

export class OidcError extends Error {
  constructor(
    message: string,
    readonly reason: string
  ) {
    super(message);
    this.name = 'OidcError';
  }
}

function firstString(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === 'string' && value.length > 0) return value;
  }
  return '';
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];
}

export class OidcService {
  private configuration: client.Configuration | null = null;

  constructor(private readonly config: AppConfig) {}

  async init(): Promise<void> {
    const issuer = new URL(this.config.issuer);
    const options = this.config.allowInsecureIssuer
      ? { execute: [client.allowInsecureRequests] }
      : undefined;
    if (this.config.clientSecret) {
      this.configuration = await client.discovery(
        issuer,
        this.config.clientId,
        this.config.clientSecret,
        undefined,
        options
      );
    } else {
      const privateKey = await importPKCS8(this.config.clientPrivateKey ?? '', 'RS256');
      this.configuration = await client.discovery(
        issuer,
        this.config.clientId,
        undefined,
        client.PrivateKeyJwt(privateKey),
        options
      );
    }
    // The code is exchanged over a confidential TLS channel, but A3 still requires
    // ID-token signature verification, so opt out of the library's default skip.
    client.enableNonRepudiationChecks(this.configuration);
  }

  private scopeString(): string {
    const API_SCOPES = ['profile.read', 'projects.read']; 
    const apiScopePrefix = `${this.config.clientId}`;
    return [
      'openid',
      'profile',
      'email',
      'offline_access',
      ...API_SCOPES.map((s) => `${apiScopePrefix}/${s}`),
    ].join(' ');
  }

  private requiredConfiguration(): client.Configuration {
    if (!this.configuration) throw new OidcError('OIDC client not initialised', 'not_initialised');
    return this.configuration;
  }

  /** Builds the authorization request and the single-use login transaction values. */
  async loginStart(): Promise<OidcLoginStart> {
    const configuration = this.requiredConfiguration();
    const state = client.randomState();
    const nonce = client.randomNonce();
    const codeVerifier = client.randomPKCECodeVerifier();
    const codeChallenge = await client.calculatePKCECodeChallenge(codeVerifier);
    const scope = this.scopeString();
    const url = client.buildAuthorizationUrl(configuration, {
      redirect_uri: `${this.config.publicBaseUrl}/auth/callback`,
      scope,
      state,
      nonce,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    });
    return { url: url.href, state, nonce, codeVerifier };
  }

  /** Exchanges the code, letting the library validate signature, iss, aud, exp and nonce. */
  async exchange(
    currentUrl: URL,
    checks: { state: string; nonce: string; codeVerifier: string }
  ): Promise<OidcTokens> {
    const configuration = this.requiredConfiguration();
    const tokens = await client.authorizationCodeGrant(configuration, currentUrl, {
      pkceCodeVerifier: checks.codeVerifier,
      expectedState: checks.state,
      expectedNonce: checks.nonce,
      idTokenExpected: true,
    });
    const claims = tokens.claims();
    if (!claims) throw new OidcError('No ID token returned', 'no_id_token');
    const identity = this.identityFromClaims(claims);
    if (identity.tid !== this.config.tenantId) {
      throw new OidcError('Wrong tenant', 'wrong_tenant');
    }
    if (!identity.roles.includes(this.config.requiredAppRole)) {
      throw new OidcError('Missing app role', 'no_role');
    }
    const expiresIn = tokens.expires_in ?? ASSUMED_ACCESS_TOKEN_LIFETIME_SECONDS;
    return {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? '',
      idToken: tokens.id_token ?? '',
      accessExpiresAt: Date.now() + expiresIn * 1000,
      refreshExpiresAt: Date.now() + REFRESH_TOKEN_LIFETIME_MS,
      scopes: tokens.scope ?? '',
      identity,
    };
  }

  async refresh(refreshToken: string): Promise<OidcTokens> {
    const configuration = this.requiredConfiguration();
    const tokens = await client.refreshTokenGrant(configuration, refreshToken, {
      scope: this.scopeString(),
    });
    const claims = tokens.claims();
    const expiresIn = tokens.expires_in ?? ASSUMED_ACCESS_TOKEN_LIFETIME_SECONDS;
    return {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? refreshToken,
      idToken: tokens.id_token ?? '',
      accessExpiresAt: Date.now() + expiresIn * 1000,
      refreshExpiresAt: Date.now() + REFRESH_TOKEN_LIFETIME_MS,
      scopes: tokens.scope ?? '',
      identity: claims ? this.identityFromClaims(claims) : emptyIdentity(),
    };
  }

  jwksUri(): string | null {
    return this.configuration?.serverMetadata().jwks_uri ?? null;
  }

  /** RP-initiated logout URL; only used when ENTRA_END_SESSION is enabled. */
  endSessionUrl(): string | null {
    const configuration = this.configuration;
    if (!configuration || !this.config.entraEndSession) return null;
    try {
      return client.buildEndSessionUrl(configuration, {
        post_logout_redirect_uri: this.config.publicBaseUrl,
      }).href;
    } catch {
      return null;
    }
  }

  private identityFromClaims(claims: Record<string, unknown>): OidcIdentity {
    return {
      tid: firstString(claims.tid),
      oid: firstString(claims.oid, claims.sub),
      email: firstString(claims.email, claims.preferred_username, claims.upn),
      displayName: firstString(claims.name, claims.preferred_username),
      organisation: firstString(claims.org, claims.tenant_region_scope),
      roles: stringArray(claims.roles),
      amr: stringArray(claims.amr),
    };
  }
}

function emptyIdentity(): OidcIdentity {
  return { tid: '', oid: '', email: '', displayName: '', organisation: '', roles: [], amr: [] };
}
