import { importPKCS8 } from 'jose';
import * as client from 'openid-client';

const ASSUMED_ACCESS_TOKEN_LIFETIME_SECONDS = 3600;

export interface OidcServiceOptions {
  issuer: string;
  clientId: string;
  clientSecret?: string;
  clientPrivateKey?: string;
  publicBaseUrl: string;
  allowInsecureIssuer: boolean;
  callbackPath: string;
  scopes: readonly string[];
  /** Extra authorization-query parameters a provider requires (for example `access_type`). */
  extraAuthorizationParams?: Record<string, string>;
  /** Fixed refresh-token lifetime, or `null` when the provider does not publish one. */
  refreshTokenLifetimeMs: number | null;
  endSession: boolean;
}

const REVOCATION_TIMEOUT_MS = 5000;

/** Raw token material plus the validated ID-token claims; gating lives with the provider. */
export interface OidcTokenSet {
  accessToken: string;
  refreshToken: string;
  idToken: string;
  accessExpiresAt: number;
  refreshExpiresAt: number;
  scopes: string;
  claims: Record<string, unknown>;
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

export class OidcService {
  private configuration: client.Configuration | null = null;

  constructor(private readonly options: OidcServiceOptions) {}

  async init(): Promise<void> {
    const issuer = new URL(this.options.issuer);
    const discoveryOptions = this.options.allowInsecureIssuer
      ? { execute: [client.allowInsecureRequests] }
      : undefined;
    if (this.options.clientSecret) {
      this.configuration = await client.discovery(
        issuer,
        this.options.clientId,
        this.options.clientSecret,
        undefined,
        discoveryOptions
      );
    } else {
      const privateKey = await importPKCS8(this.options.clientPrivateKey ?? '', 'RS256');
      this.configuration = await client.discovery(
        issuer,
        this.options.clientId,
        undefined,
        client.PrivateKeyJwt(privateKey),
        discoveryOptions
      );
    }
    // The code is exchanged over a confidential TLS channel, but A3 still requires
    // ID-token signature verification, so opt out of the library's default skip.
    client.enableNonRepudiationChecks(this.configuration);
  }

  private scopeString(): string {
    return this.options.scopes.join(' ');
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
    const url = client.buildAuthorizationUrl(configuration, {
      redirect_uri: `${this.options.publicBaseUrl}${this.options.callbackPath}`,
      scope: this.scopeString(),
      state,
      nonce,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      ...this.options.extraAuthorizationParams,
    });
    return { url: url.href, state, nonce, codeVerifier };
  }

  /** Exchanges the code, letting the library validate signature, iss, aud, exp and nonce. */
  async exchange(
    currentUrl: URL,
    checks: { state: string; nonce: string; codeVerifier: string }
  ): Promise<OidcTokenSet> {
    const configuration = this.requiredConfiguration();
    const tokens = await client.authorizationCodeGrant(configuration, currentUrl, {
      pkceCodeVerifier: checks.codeVerifier,
      expectedState: checks.state,
      expectedNonce: checks.nonce,
      idTokenExpected: true,
    });
    const claims = tokens.claims();
    if (!claims) throw new OidcError('No ID token returned', 'no_id_token');
    return this.tokenSet(tokens, claims, '');
  }

  async refresh(refreshToken: string): Promise<OidcTokenSet> {
    const configuration = this.requiredConfiguration();
    const tokens = await client.refreshTokenGrant(configuration, refreshToken, {
      scope: this.scopeString(),
    });
    return this.tokenSet(tokens, tokens.claims() ?? null, refreshToken);
  }

  private tokenSet(
    tokens: client.TokenEndpointResponse,
    claims: Record<string, unknown> | null,
    fallbackRefreshToken: string
  ): OidcTokenSet {
    const expiresIn = tokens.expires_in ?? ASSUMED_ACCESS_TOKEN_LIFETIME_SECONDS;
    const lifetime = this.options.refreshTokenLifetimeMs;
    return {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? fallbackRefreshToken,
      idToken: tokens.id_token ?? '',
      accessExpiresAt: Date.now() + expiresIn * 1000,
      refreshExpiresAt: lifetime === null ? 0 : Date.now() + lifetime,
      scopes: tokens.scope ?? '',
      claims: claims ?? {},
    };
  }

  jwksUri(): string | null {
    return this.configuration?.serverMetadata().jwks_uri ?? null;
  }

  revocationEndpoint(): string | null {
    return this.configuration?.serverMetadata().revocation_endpoint ?? null;
  }

  /**
   * Best-effort RFC 7009 revocation. Bounded so a slow provider can never hold
   * up logout or the idle-timeout path.
   */
  async revoke(token: string): Promise<void> {
    if (!token || !this.revocationEndpoint()) return;
    const configuration = this.requiredConfiguration();
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        client.tokenRevocation(configuration, token),
        new Promise<never>((_resolve, reject) => {
          timer = setTimeout(() => reject(new Error('revocation_timeout')), REVOCATION_TIMEOUT_MS);
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  /** RP-initiated logout URL; only providers with an approved end-session endpoint get one. */
  endSessionUrl(): string | null {
    const configuration = this.configuration;
    if (!configuration || !this.options.endSession) return null;
    try {
      return client.buildEndSessionUrl(configuration, {
        post_logout_redirect_uri: this.options.publicBaseUrl,
      }).href;
    } catch {
      return null;
    }
  }
}
