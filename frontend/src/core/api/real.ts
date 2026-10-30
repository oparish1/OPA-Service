import { getAppConfig, getProviderConfig } from '../config';
import { formatTimestamp } from '../lib/response-format';
import { getProviderRegistry } from '../providers/active';
import type { ProviderSession } from '../providers/types';
import {
  clearSession,
  getSession as readStore,
  hasSession,
  revealToken as revealStore,
  setSession,
  updateSession,
} from '../session/store';
import type {
  AccessToken,
  ApiResponse,
  Identity,
  ProviderInfo,
  RunnerAuth,
  Session,
  TokenKind,
} from '../types';
import { runRequest as runDirectRequest } from './runner';

/**
 * The real browser API: provider auth facets plus the in-memory session store.
 * `api/index.ts` selects this module only after `main.tsx` loads the public
 * config, so tests keep using the mock seam.
 */

function mask(value: string): string {
  if (value.length <= 10) return value;
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

function toSession(providerSession: ProviderSession): Session {
  const now = formatTimestamp();
  return {
    provider: providerSession.providerName,
    providerId: providerSession.providerId,
    account: providerSession.account,
    accessToken: {
      value: providerSession.accessToken.value,
      masked: mask(providerSession.accessToken.value),
      expiresAt: providerSession.accessToken.expiresAt,
      scopes: providerSession.accessToken.scopes,
    },
    refreshToken: providerSession.refreshToken
      ? {
          value: providerSession.refreshToken.value,
          masked: mask(providerSession.refreshToken.value),
          expiresAt: providerSession.refreshToken.expiresAt,
          grant: providerSession.refreshToken.grant,
        }
      : { value: '', masked: '', expiresAt: '—', grant: '—' },
    renewable: providerSession.renewable ?? Boolean(providerSession.refreshToken),
    issuer: providerSession.issuer,
    issuedAt: now,
    snapshot: `${providerSession.providerId} · ${now}`,
  };
}

function refreshStoredSession(): void {
  const providerId = readStore()?.providerId;
  if (!providerId) return;
  const providerSession = getProviderRegistry().get(providerId)?.auth?.session();
  if (providerSession) updateSession(toSession(providerSession));
}

function requireProvider(providerId: string) {
  const module = getProviderRegistry().get(providerId);
  if (!module?.auth) throw new Error('Provider not available');
  return module.auth;
}

export async function signIn(providerId: string): Promise<void> {
  const auth = requireProvider(providerId);
  await auth.signIn();
  const providerSession = auth.session();
  if (providerSession) setSession(toSession(providerSession));
}

/** Adopts a provider redirect callback into the in-memory session (A3). */
export async function handleRedirect(url: URL): Promise<boolean> {
  for (const module of getProviderRegistry().all) {
    if (!module.auth) continue;
    if (await module.auth.handleRedirect(url)) {
      const providerSession = module.auth.session();
      if (providerSession) setSession(toSession(providerSession));
      return true;
    }
  }
  return false;
}

export async function signOut(): Promise<void> {
  const providerId = readStore()?.providerId;
  if (providerId) await getProviderRegistry().get(providerId)?.auth?.signOut();
  clearSession();
}

export async function bootstrapSession(): Promise<boolean> {
  return hasSession();
}

export async function getSession(): Promise<Session> {
  const session = readStore();
  if (!session) throw new Error('Session unavailable');
  return session;
}

export async function getProviders(): Promise<ProviderInfo[]> {
  const config = getAppConfig();
  if (!config) throw new Error('Configuration unavailable');
  return config.providers.map(({ id, name, ...links }) => ({ id, name, ...links }));
}

export async function revealToken(kind: TokenKind): Promise<string> {
  const value = revealStore(kind);
  if (value === null) throw new Error('Token reveal failed');
  return value;
}

export async function refreshToken(): Promise<AccessToken> {
  const providerId = readStore()?.providerId;
  if (!providerId) throw new Error('Refresh token expired. Sign in again.');
  const auth = requireProvider(providerId);
  const renewed = await auth.renew();
  if (!renewed) throw new Error('Refresh token expired. Sign in again.');
  refreshStoredSession();
  const accessToken = readStore()?.accessToken;
  if (!accessToken) throw new Error('Refresh token expired. Sign in again.');
  return accessToken;
}

export async function getIdentities(): Promise<Identity[]> {
  const session = readStore();
  if (!session) return [];
  const provider = getProviderConfig(session.providerId);
  if (!provider) return [];
  return [
    {
      id: provider.id,
      name: provider.name,
      subtitle: session.account?.email ?? '',
      status: 'primary',
      manageUrl: provider.manageAccountUrl,
    },
  ];
}

export async function discoverSso(_email: string): Promise<{ found: false; providerId: null }> {
  return { found: false, providerId: null };
}

export async function resetPassword(providerId: string): Promise<{ ok: true; destination: string }> {
  const destination = getProviderConfig(providerId)?.forgotPasswordUrl;
  if (!destination) throw new Error('No recovery destination configured');
  return { ok: true as const, destination };
}

export async function changePassword(providerId: string): Promise<{ ok: true; destination: string }> {
  const destination = getProviderConfig(providerId)?.changePasswordUrl;
  if (!destination) throw new Error('No change-password destination configured');
  return { ok: true as const, destination };
}

export function runRequest(auth: RunnerAuth, url: string): Promise<ApiResponse> {
  return runDirectRequest(auth, url);
}
