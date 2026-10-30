import { OktaAuth, isAccessToken, isIDToken, isRefreshToken } from '@okta/okta-auth-js';
import type { ProviderConfig } from '../../../../shared/app-config';
import { getProviderConfig } from '../../core/config';
import { formatTimestamp } from '../../core/lib/response-format';
import type { ProviderAuth, ProviderSession } from '../../core/providers/types';

/**
 * Okta's auth facet. `@okta/okta-auth-js` owns code + PKCE (S256), a fresh
 * `state`/`nonce` and silent renewal; the token manager keeps tokens in memory
 * only (SD-2, SD-3). No raw library error text reaches the screen (A8).
 */

const PROVIDER_ID = 'okta';
const PROVIDER_NAME = 'Okta';
const OIDC_SCOPES = new Set(['openid', 'profile', 'email', 'offline_access']);

let client: OktaAuth | null = null;
let current: ProviderSession | null = null;

function config(): ProviderConfig {
  const value = getProviderConfig(PROVIDER_ID);
  if (!value) throw new Error('Okta is not configured');
  return value;
}

function requestScopes(): string[] {
  const requested = config().scopes ?? ['workspace:read'];
  return [...new Set([...requested.filter(scope => !OIDC_SCOPES.has(scope)), 'openid', 'profile', 'offline_access'])];
}

function getClient(): OktaAuth {
  if (!client) {
    const provider = config();
    client = new OktaAuth({
      issuer: provider.issuer,
      clientId: provider.clientId,
      redirectUri: window.location.origin,
      scopes: requestScopes(),
      pkce: true,
      tokenManager: { storage: 'memory' },
    });
  }
  return client;
}

function stringClaim(claims: Record<string, unknown>, key: string): string {
  const value = claims[key];
  return typeof value === 'string' ? value : '';
}

function groupClaim(claims: Record<string, unknown>): string {
  const groups = claims.groups;
  if (Array.isArray(groups)) return groups.filter(group => typeof group === 'string').join(', ');
  return '';
}

function expiresAt(seconds: number | undefined): string {
  return seconds ? formatTimestamp(new Date(seconds * 1000)) : '—';
}

async function toSession(oktaAuth: OktaAuth): Promise<ProviderSession | null> {
  const accessResult = await oktaAuth.tokenManager.get('accessToken');
  if (!accessResult || !isAccessToken(accessResult)) return null;
  const accessToken = accessResult;
  const idResult = await oktaAuth.tokenManager.get('idToken');
  const idToken = idResult && isIDToken(idResult) ? idResult : undefined;
  const refreshResult = await oktaAuth.tokenManager.get('refreshToken');
  const refreshToken = refreshResult && isRefreshToken(refreshResult) ? refreshResult : undefined;
  const claims = { ...(accessToken.claims ?? {}), ...(idToken?.claims ?? {}) } as Record<string, unknown>;
  const username = stringClaim(claims, 'email') || stringClaim(claims, 'preferred_username');
  return {
    providerId: PROVIDER_ID,
    providerName: PROVIDER_NAME,
    issuer: stringClaim(claims, 'iss') || config().issuer,
    account: {
      displayName: stringClaim(claims, 'name') || username,
      email: username,
      organisation: stringClaim(claims, 'org'),
      role: groupClaim(claims),
      accountId: stringClaim(claims, 'uid') || stringClaim(claims, 'sub'),
      createdAt: '—',
    },
    accessToken: {
      value: accessToken.accessToken,
      expiresAt: expiresAt(accessToken.expiresAt),
      scopes: accessToken.scopes.join(' '),
    },
    refreshToken: refreshToken
      ? { value: refreshToken.refreshToken, expiresAt: expiresAt(refreshToken.expiresAt), grant: 'refresh_token' }
      : undefined,
    renewable: true,
  };
}

export function createOktaAuth(): ProviderAuth {
  return {
    async signIn() {
      await getClient().signInWithRedirect({ scopes: requestScopes() });
    },

    async handleRedirect(url) {
      const oktaAuth = getClient();
      if (!url.search.includes('code=') || !url.search.includes('state=')) return false;
      try {
        await oktaAuth.handleLoginRedirect();
        const session = await toSession(oktaAuth);
        if (!session) return false;
        current = session;
        return true;
      } catch {
        return false;
      }
    },

    async getAccessToken() {
      const oktaAuth = getClient();
      try {
        const token = await oktaAuth.getOrRenewAccessToken();
        if (!token) return null;
        const session = await toSession(oktaAuth);
        if (session) current = session;
        return token;
      } catch {
        return null;
      }
    },

    async renew() {
      const oktaAuth = getClient();
      try {
        const renewed = await oktaAuth.tokenManager.renew('accessToken');
        if (!renewed) return false;
        const session = await toSession(oktaAuth);
        if (!session) return false;
        current = session;
        return true;
      } catch {
        return false;
      }
    },

    async signOut() {
      const oktaAuth = getClient();
      // SD-5: local only; clear the in-memory token manager, no IdP redirect.
      oktaAuth.tokenManager.clear();
      current = null;
    },

    session() {
      return current;
    },
  };
}
