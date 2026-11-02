import {
  InteractionRequiredAuthError,
  PublicClientApplication,
} from '@azure/msal-browser';
import type { AccountInfo, AuthenticationResult, SilentRequest } from '@azure/msal-browser';
import type { ProviderConfig } from '../../../../shared/app-config';
import { getProviderConfig } from '../../core/config';
import { formatTimestamp } from '../../core/lib/response-format';
import type { ProviderAuth, ProviderSession } from '../../core/providers/types';

/**
 * Entra's auth facet. MSAL owns code + PKCE (S256), a fresh `state`/`nonce` and
 * silent renewal; this module only maps its results into the app's in-memory
 * session and never lets a raw library error reach the screen (SD-2, A8).
 */

const PROVIDER_ID = 'entra';
const PROVIDER_NAME = 'Microsoft Entra ID';
const OIDC_SCOPES = new Set(['openid', 'profile', 'email', 'offline_access']);

let client: PublicClientApplication | null = null;
let current: ProviderSession | null = null;

function config(): ProviderConfig {
  const value = getProviderConfig(PROVIDER_ID);
  if (!value) throw new Error('Entra is not configured');
  return value;
}

/** Composes the resource scopes the issue defines, e.g. `api://x/workspace:read`. */
function requestScopes(): string[] {
  const provider = config();
  const requested = provider.scopes ?? ['workspace:read'];
  const scopes = requested.map(scope =>
    OIDC_SCOPES.has(scope) || !provider.apiResource
      ? scope
      : `${provider.apiResource.replace(/\/$/, '')}/${scope}`
  );
  return [...new Set([...scopes, 'offline_access'])];
}

async function getClient(): Promise<PublicClientApplication> {
  if (!client) {
    const provider = config();
    client = new PublicClientApplication({
      auth: {
        clientId: provider.clientId,
        authority: provider.issuer,
        redirectUri: provider.redirectUri || window.location.origin,
      },
      cache: { cacheLocation: 'sessionStorage' },
    });
    await client.initialize();
  }
  return client;
}

function stringClaim(claims: Record<string, unknown>, key: string): string {
  const value = claims[key];
  return typeof value === 'string' ? value : '';
}

function roleClaim(claims: Record<string, unknown>): string {
  const roles = claims.roles;
  if (Array.isArray(roles)) return roles.filter(role => typeof role === 'string').join(', ');
  return '';
}

function toSession(result: AuthenticationResult): ProviderSession {
  const claims = (result.account.idTokenClaims ?? {}) as Record<string, unknown>;
  return {
    providerId: PROVIDER_ID,
    providerName: PROVIDER_NAME,
    issuer: stringClaim(claims, 'iss') || config().issuer,
    account: {
      displayName: result.account.name ?? stringClaim(claims, 'name'),
      email: result.account.username,
      organisation: stringClaim(claims, 'tid'),
      role: roleClaim(claims),
      accountId: result.account.localAccountId,
      createdAt: '—',
    },
    accessToken: {
      value: result.accessToken,
      expiresAt: formatTimestamp(result.expiresOn ?? new Date()),
      scopes: result.scopes.join(' '),
    },
    // MSAL keeps the SPA refresh token in its memory cache and renews silently;
    // it never exposes the token value to app code.
    renewable: true,
  };
}

function activeAccount(msal: PublicClientApplication): AccountInfo | null {
  return msal.getActiveAccount() ?? msal.getAllAccounts()[0] ?? null;
}

async function acquireSilent(forceRefresh = false): Promise<AuthenticationResult | null> {
  const msal = await getClient();
  const account = activeAccount(msal);
  if (!account) return null;
  const request: SilentRequest = { scopes: requestScopes(), account, forceRefresh };
  try {
    return await msal.acquireTokenSilent(request);
  } catch (error) {
    console.error('Entra renewal failed', error instanceof Error ? error.name : error);
    return null;
  }
}

export function createEntraAuth(): ProviderAuth {
  return {
    async signIn() {
      const msal = await getClient();
      await msal.loginRedirect({ scopes: requestScopes() });
    },

    async handleRedirect(url) {
      if (!url.hash && !url.search) return 'ignored';
      const msal = await getClient();
      try {
        const result = await msal.handleRedirectPromise(url.hash);
        if (!result) return 'ignored';
        msal.setActiveAccount(result.account);
        current = toSession(result);
        return 'handled';
      } catch {
        // A missing, wrong or reused state must not surface the library text.
        return 'rejected';
      }
    },

    async getAccessToken() {
      const result = await acquireSilent();
      if (result) current = toSession(result);
      return result?.accessToken ?? null;
    },

    async renew() {
      const result = await acquireSilent(true);
      if (!result) return false;
      current = toSession(result);
      return true;
    },

    async signOut() {
      const msal = await getClient();
      // SD-5: local only, cleared in memory; no IdP end-session redirect.
      await msal.clearCache();
      current = null;
    },

    session() {
      return current;
    },
  };
}
