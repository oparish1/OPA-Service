/**
 * Local OIDC issuer used only by the Docker integration script. It mints
 * provider-shaped tokens with controllable claims and publishes discovery and
 * JWKS so APISIX can validate them without ever calling a real identity
 * provider. The signing key never leaves this process and is generated at boot.
 */

type Claims = Record<string, unknown>;

const provider = process.env.PROVIDER ?? 'entra';
const origin = process.env.ISSUER_ORIGIN ?? `http://localhost:${process.env.PORT ?? '8090'}`;

const issuerId = (() => {
  if (provider === 'google') return process.env.GOOGLE_ISSUER_ID ?? 'https://accounts.google.com';
  return origin;
})();

const algorithm = {
  name: 'RSASSA-PKCS1-v1_5',
  modulusLength: 2048,
  publicExponent: new Uint8Array([1, 0, 1]),
  hash: 'SHA-256',
};

const keyPair = await crypto.subtle.generateKey(algorithm, true, ['sign', 'verify']);
// A second key is never published in JWKS, so tokens signed with it exercise
// the unknown-key rejection path.
const unknownKeyPair = await crypto.subtle.generateKey(algorithm, true, ['sign', 'verify']);

const publicJwk: JsonWebKey & { kid: string; use: string; alg: string } = {
  ...(await crypto.subtle.exportKey('jwk', keyPair.publicKey)),
  kid: 'test-key',
  use: 'sig',
  alg: 'RS256',
};

function base64url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function encodeJson(value: unknown): string {
  return base64url(new TextEncoder().encode(JSON.stringify(value)));
}

function defaults(): Claims {
  const now = Math.floor(Date.now() / 1000);
  const base: Claims = { iss: issuerId, iat: now, exp: now + 300 };
  switch (provider) {
    case 'okta':
      return {
        ...base,
        aud: 'api://default',
        uid: 'okta-uid-1',
        sub: 'okta-sub-1',
        email: 'okta.user@agentic-advantage.example',
        name: 'Okta Test User',
        groups: ['Workspace User'],
        scp: ['workspace:read', 'workspace:write'],
      };
    case 'google':
      return {
        ...base,
        aud: 'test-google-client',
        sub: 'google-sub-1',
        email: 'google.user@agentic-advantage.com',
        name: 'Google Test User',
        email_verified: true,
        hd: 'agentic-advantage.com',
        nonce: 'test-nonce',
      };
    default:
      return {
        ...base,
        aud: 'api://test-entra-client',
        sub: 'entra-sub-1',
        tid: 'tenant-1',
        email: 'entra.user@agentic-advantage.example',
        name: 'Entra Test User',
        roles: ['Workspace.User'],
        scp: 'workspace:read workspace:write',
      };
  }
}

interface MintOptions {
  claims?: Claims;
  key?: 'known' | 'unknown';
  alg?: 'RS256' | 'none';
  tamper?: boolean;
}

async function sign(options: MintOptions): Promise<string> {
  const claims = { ...defaults(), ...(options.claims ?? {}) };
  if (options.alg === 'none') {
    return `${encodeJson({ alg: 'none', typ: 'JWT' })}.${encodeJson(claims)}.`;
  }
  const signingKey = options.key === 'unknown' ? unknownKeyPair.privateKey : keyPair.privateKey;
  const data = `${encodeJson({ alg: 'RS256', typ: 'JWT', kid: 'test-key' })}.${encodeJson(claims)}`;
  const signature = new Uint8Array(
    await crypto.subtle.sign('RSASSA-PKCS1-v1_5', signingKey, new TextEncoder().encode(data))
  );
  if (options.tamper) signature[0] ^= 0xff;
  return `${data}.${base64url(signature)}`;
}

Bun.serve({
  port: Number(process.env.PORT ?? '8090'),
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === '/.well-known/openid-configuration') {
      return Response.json({
        issuer: issuerId,
        authorization_endpoint: `${origin}/authorize`,
        token_endpoint: `${origin}/token`,
        jwks_uri: `${origin}/jwks`,
        response_types_supported: ['code'],
        subject_types_supported: ['public'],
        id_token_signing_alg_values_supported: ['RS256'],
        scopes_supported: ['openid', 'profile', 'email', 'offline_access'],
        code_challenge_methods_supported: ['S256'],
      });
    }
    if (url.pathname === '/jwks') {
      return Response.json({ keys: [publicJwk] });
    }
    if (url.pathname === '/mint' && request.method === 'POST') {
      const body = (await request.json().catch(() => ({}))) as MintOptions;
      return Response.json({ token: await sign(body) });
    }
    return new Response('not found', { status: 404 });
  },
});
