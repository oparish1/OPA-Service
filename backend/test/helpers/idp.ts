import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import type { CryptoKey, JWK } from 'jose';

export interface TokenBehavior {
  /** Extra or overriding ID-token claims. */
  claims?: Record<string, unknown>;
  /** Sign the ID token with a key absent from the published JWKS. */
  signWithUnknownKey?: boolean;
  /** Omit the ID token entirely. */
  omitIdToken?: boolean;
}

export interface IdpOptions {
  tenantId: string;
  clientId: string;
}

function encodeCode(nonce: string): string {
  return `code-${Buffer.from(nonce).toString('base64url')}`;
}

function decodeNonce(code: string): string {
  return Buffer.from(code.replace(/^code-/, ''), 'base64url').toString('utf8');
}

/** Local OIDC issuer + JWKS so tests never call Microsoft Entra. */
export class TestIdp {
  private server: ReturnType<typeof Bun.serve> | null = null;
  private privateKey!: CryptoKey;
  private unknownKey!: CryptoKey;
  private publicJwk!: JWK;
  private refreshCount = 0;
  origin = '';
  behavior: TokenBehavior = {};

  constructor(private readonly options: IdpOptions) {}

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
  }

  async signIdToken(nonce: string): Promise<string> {
    const signingKey = this.behavior.signWithUnknownKey ? this.unknownKey : this.privateKey;
    const kid = this.behavior.signWithUnknownKey ? 'unknown-key' : 'test-key';
    const now = Math.floor(Date.now() / 1000);
    const payload: Record<string, unknown> = {
      iss: this.origin,
      aud: this.options.clientId,
      sub: 'sub-default',
      oid: 'oid-default',
      tid: this.options.tenantId,
      email: 'orlando.parish@agentic-advantage.example',
      name: 'Orlando Parish',
      roles: ['Workspace.User'],
      nonce,
      iat: now,
      exp: now + 300,
      ...this.behavior.claims,
    };
    return new SignJWT(payload)
      .setProtectedHeader({ alg: 'RS256', kid })
      .sign(signingKey);
  }

  /** Mints an access token for `/v1/*` bearer tests. */
  async signAccessToken(claims: Record<string, unknown> = {}): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    const payload: Record<string, unknown> = {
      iss: this.origin,
      aud: this.options.clientId,
      oid: 'oid-default',
      tid: this.options.tenantId,
      scp: 'profile.read projects.read',
      iat: now,
      exp: now + 300,
      ...claims,
    };
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
        scopes_supported: ['openid', 'profile', 'email', 'offline_access'],
        code_challenge_methods_supported: ['S256'],
        token_endpoint_auth_methods_supported: ['client_secret_post', 'private_key_jwt'],
        end_session_endpoint: `${this.origin}/logout`,
      });
    }
    if (url.pathname === '/jwks') {
      return Response.json({ keys: [this.publicJwk] });
    }
    if (url.pathname === '/token' && request.method === 'POST') {
      const form = new URLSearchParams(await request.text());
      if (form.get('grant_type') === 'refresh_token') {
        return this.refreshResponse();
      }
      return this.codeResponse(form);
    }
    return new Response('not found', { status: 404 });
  }

  private async codeResponse(form: URLSearchParams): Promise<Response> {
    const code = form.get('code') ?? '';
    const nonce = code ? decodeNonce(code) : '';
    const body: Record<string, unknown> = {
      token_type: 'Bearer',
      expires_in: 3600,
      access_token: await this.signAccessToken(),
      refresh_token: 'refresh-token-1',
      scope: 'openid profile email offline_access profile.read projects.read',
    };
    if (!this.behavior.omitIdToken) {
      body.id_token = await this.signIdToken(nonce);
    }
    return Response.json(body);
  }

  private async refreshResponse(): Promise<Response> {
    this.refreshCount += 1;
    return Response.json({
      token_type: 'Bearer',
      expires_in: 3600,
      access_token: `access-token-refreshed-${this.refreshCount}`,
      refresh_token: `refresh-token-${this.refreshCount + 1}`,
      scope: 'openid profile email offline_access profile.read projects.read',
    });
  }
}
