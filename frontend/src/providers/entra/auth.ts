import { LogLevel, PublicClientApplication } from '@azure/msal-browser';
import type { AccountInfo, AuthenticationResult, SilentRequest } from '@azure/msal-browser';
import type { ProviderConfig } from '../../../../shared/app-config';
import { getProviderConfig } from '../../core/config';
import { describeError, log } from '../../core/lib/log';
import { formatTimestamp } from '../../core/lib/response-format';
import type { ProviderAuth, ProviderSession } from '../../core/providers/types';

/**
 * Entra's auth facet. MSAL owns code + PKCE (S256), a fresh `state`/`nonce` and
 * silent renewal; this module only maps its results into the app's in-memory
 * session and never lets a raw library error reach the screen (SD-2, A8).
 */

const PROVIDER_ID = 'entra';
const PROVIDER_NAME = 'Microsoft Entra ID';
const GENERIC_ERROR = 'We couldn’t sign you in. Try again.';
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
    const created = new PublicClientApplication({
      auth: {
        clientId: provider.clientId,
        authority: provider.issuer,
        redirectUri: provider.redirectUri || window.location.origin,
      },
      cache: { cacheLocation: 'sessionStorage' },
      system: {
        loggerOptions: {
          logLevel: LogLevel.Warning,
          piiLoggingEnabled: false,
          loggerCallback: (level, message, containsPii) => {
            if (containsPii) return;
            if (level === LogLevel.Error) log.error(PROVIDER_ID, message);
            else if (level === LogLevel.Warning) log.warn(PROVIDER_ID, message);
            else log.debug(PROVIDER_ID, message);
          },
        },
      },
    });
    await created.initialize();
    client = created;
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
    log.warn(PROVIDER_ID, 'Silent token acquisition failed', { error: describeError(error) });
    return null;
  }
}

export function createEntraAuth(): ProviderAuth {
  return {
    async signIn() {
      try {
        const msal = await getClient();
        await msal.loginRedirect({ scopes: requestScopes() });
      } catch (error) {
        log.error(PROVIDER_ID, 'Sign-in failed', { error: describeError(error) });
        throw new Error(GENERIC_ERROR);
      }
    },

    async handleRedirect(url) {
      if (!url.hash && !url.search) return 'ignored';
      // Not owning the URL stays 'ignored'; a configured provider that cannot
      // initialize is a failure, so the screen shows a notice instead.
      if (!getProviderConfig(PROVIDER_ID)) return 'ignored';
      try {
        const msal = await getClient();
        const result = await msal.handleRedirectPromise(url.hash);
        if (!result) return 'ignored';
        msal.setActiveAccount(result.account);
        current = toSession(result);
        return 'handled';
      } catch (error) {
        // A missing, wrong or reused state must not surface the library text.
        log.error(PROVIDER_ID, 'Redirect handling failed', { error: describeError(error) });
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
