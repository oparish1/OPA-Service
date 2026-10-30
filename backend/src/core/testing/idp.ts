import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import type { CryptoKey, JWK } from 'jose';
import { neutralIdpProfile } from './neutral-claims';

export interface TokenBehavior {
  /** Extra or overriding ID-token claims. */
  claims?: Record<string, unknown>;
  /** Sign the ID token with a key absent from the published JWKS. */
  signWithUnknownKey?: boolean;
  /** Omit the ID token entirely. */
  omitIdToken?: boolean;
  /** Omit the rotated refresh token from refresh responses (Google's consent-only case). */
  omitRefreshedRefreshToken?: boolean;
  /** Reject the next refresh with `invalid_grant`. */
  invalidGrant?: boolean;
}

export interface IdpOptions {
  tenantId: string;
  clientId: string;
  /** ID-token and access-token shapes, supplied by the provider under test. */
  profile?: IdpProfile;
  /** Okta default-AS API audience expected on `/v1` access tokens. */
  apiAudience?: string;
  /** Google Workspace hosted domain (`hd`) the app requires. */
  hostedDomain?: string;
  /** Okta group the app requires in the ID-token `groups` claim. */
  requiredGroup?: string;
}

/** The provider-specific token shapes a test issuer mints, without naming a provider. */
export interface IdpProfile {
  idClaims(options: IdpOptions): Record<string, unknown>;
  accessTokenClaims(options: IdpOptions): Record<string, unknown>;
  scopes: readonly string[];
  metadata?(origin: string): Record<string, unknown>;
}

function encodeCode(nonce: string): string {
  return `code-${Buffer.from(nonce).toString('base64url')}`;
}

function decodeNonce(code: string): string {
  return Buffer.from(code.replace(/^code-/, ''), 'base64url').toString('utf8');
}

/** Local OIDC issuer + JWKS so tests never call a real identity provider. */
export class TestIdp {
  private server: ReturnType<typeof Bun.serve> | null = null;
  private privateKey!: CryptoKey;
  private unknownKey!: CryptoKey;
  private publicJwk!: JWK;
  private refreshCount = 0;
  private validRefreshTokens = new Set<string>();
  revokeCount = 0;
  origin = '';
  behavior: TokenBehavior = {};

  constructor(private readonly options: IdpOptions) {}

  /** The client id the issuer mints `aud` for; the harness derives the module env from it. */
  get clientId(): string {
    return this.options.clientId;
  }

  private get profile(): IdpProfile {
    return this.options.profile ?? neutralIdpProfile;
  }

  async start(): Promise<void> {
    const known = await generateKeyPair('RS256');
    const unknown = await generateKeyPair('RS256');
    this.privateKey = known.privateKey;
    this.unknownKey = unknown.privateKey;
    this.publicJwk = await exportJWK(known.publicKey);
    this.publicJwk.kid = 'test-key';
    this.publicJwk.use = 'sig';
    this.publicJwk.alg = 'RS256';

    this.server = Bun.serve({
      port: 0,
      fetch: request => this.handle(request),
    });
    this.origin = `http://127.0.0.1:${this.server.port}`;
  }

  stop(): void {
    this.server?.stop(true);
  }

  metadataUri(): string {
    return `${this.origin}/.well-known/openid-configuration`;
  }

  makeCode(nonce: string): string {
    return encodeCode(nonce);
  }

  reset(): void {
    this.behavior = {};
    this.refreshCount = 0;
    this.validRefreshTokens.clear();
    this.revokeCount = 0;
  }

  private idClaims(): Record<string, unknown> {
    return {
      iss: this.origin,
      aud: this.options.clientId,
      sub: 'sub-default',
      nonce: '',
      iat: 0,
      exp: 0,
      ...this.profile.idClaims(this.options),
    };
  }

  async signIdToken(nonce: string): Promise<string> {
    const signingKey = this.behavior.signWithUnknownKey ? this.unknownKey : this.privateKey;
    const kid = this.behavior.signWithUnknownKey ? 'unknown-key' : 'test-key';
    const now = Math.floor(Date.now() / 1000);
    const payload: Record<string, unknown> = {
      ...this.idClaims(),
      nonce,
      iat: now,
      exp: now + 300,
      ...this.behavior.claims,
    };
    return new SignJWT(payload)
      .setProtectedHeader({ alg: 'RS256', kid })
      .sign(signingKey);
  }

  /** Mints a `/v1` bearer access token shaped for this provider. */
  async signAccessToken(claims: Record<string, unknown> = {}): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    const base: Record<string, unknown> = {
      iss: this.origin,
      iat: now,
      exp: now + 300,
      ...this.profile.accessTokenClaims(this.options),
    };
    const payload: Record<string, unknown> = { ...base, ...claims };
    const key = claims.__unknownKey ? this.unknownKey : this.privateKey;
    const kid = claims.__unknownKey ? 'unknown-key' : 'test-key';
    delete payload.__unknownKey;
    return new SignJWT(payload).setProtectedHeader({ alg: 'RS256', kid }).sign(key);
  }

  private async handle(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/.well-known/openid-configuration') {
      return Response.json({
        issuer: this.origin,
        authorization_endpoint: `${this.origin}/authorize`,
        token_endpoint: `${this.origin}/token`,
        jwks_uri: `${this.origin}/jwks`,
        response_types_supported: ['code'],
        subject_types_supported: ['public'],
        id_token_signing_alg_values_supported: ['RS256'],
        scopes_supported: this.profile.scopes,
        code_challenge_methods_supported: ['S256'],
        token_endpoint_auth_methods_supported: ['client_secret_post', 'private_key_jwt'],
        end_session_endpoint: `${this.origin}/logout`,
        ...this.profile.metadata?.(this.origin),
      });
    }
    if (url.pathname === '/jwks') {
      return Response.json({ keys: [this.publicJwk] });
    }
    if (url.pathname === '/revoke' && request.method === 'POST') {
      this.revokeCount += 1;
      return new Response('', { status: 200 });
    }
    if (url.pathname === '/token' && request.method === 'POST') {
      const form = new URLSearchParams(await request.text());
      if (form.get('grant_type') === 'refresh_token') {
        return this.refreshResponse(form);
      }
      return this.codeResponse(form);
    }
    return new Response('not found', { status: 404 });
  }

  private async codeResponse(form: URLSearchParams): Promise<Response> {
    const code = form.get('code') ?? '';
    const nonce = code ? decodeNonce(code) : '';
    this.validRefreshTokens.add('refresh-token-1');
    const body: Record<string, unknown> = {
      token_type: 'Bearer',
      expires_in: 3600,
      access_token: await this.signAccessToken(),
      refresh_token: 'refresh-token-1',
      scope: 'openid profile email offline_access workspace:read workspace:write',
    };
    if (!this.behavior.omitIdToken) {
      body.id_token = await this.signIdToken(nonce);
    }
    return Response.json(body);
  }

  private async refreshResponse(form: URLSearchParams): Promise<Response> {
    const presented = form.get('refresh_token') ?? '';
    if (this.behavior.invalidGrant || !this.validRefreshTokens.has(presented)) {
      return Response.json({ error: 'invalid_grant', error_description: 'token revoked' }, { status: 400 });
    }
    this.refreshCount += 1;
    const body: Record<string, unknown> = {
      token_type: 'Bearer',
      expires_in: 3600,
      access_token: `access-token-refreshed-${this.refreshCount}`,
      scope: 'openid profile email offline_access workspace:read workspace:write',
    };
    if (!this.behavior.omitRefreshedRefreshToken) {
      const rotated = `refresh-token-${this.refreshCount + 1}`;
      this.validRefreshTokens.delete(presented);
      this.validRefreshTokens.add(rotated);
      body.refresh_token = rotated;
    }
    return Response.json(body);
  }
}
