import type { SsoDiscovery } from '../mocks/api';
import * as mockApi from '../mocks/api';
import * as realApi from './real';
import type {
  AccessToken,
  ApiResponse,
  Identity,
  ProviderInfo,
  RunnerAuth,
  Session,
  TokenKind,
} from '../types';

/**
 * The authentication seam. Component tests and the mock demo use the mock
 * layer; `main.tsx` switches to the real provider-backed client only after it
 * has loaded and validated the public config. No build-time mode flag remains.
 */

export type ApiMode = 'mock' | 'real';

let mode: ApiMode = 'mock';

export function setApiMode(next: ApiMode): void {
  mode = next;
}

function api() {
  return mode === 'real' ? realApi : mockApi;
}

export async function signIn(providerId: string): Promise<void> {
  await api().signIn(providerId);
}

export function signOut(): Promise<void> {
  return api().signOut();
}

export function bootstrapSession(): Promise<boolean> {
  return api().bootstrapSession();
}

export function getSession(): Promise<Session> {
  return api().getSession();
}

export function getProviders(): Promise<ProviderInfo[]> {
  return api().getProviders();
}

export function revealToken(kind: TokenKind): Promise<string> {
  return api().revealToken(kind);
}

export function refreshToken(): Promise<AccessToken> {
  return api().refreshToken();
}

export function getIdentities(): Promise<Identity[]> {
  return api().getIdentities();
}

export function discoverSso(email: string): Promise<SsoDiscovery> {
  return api().discoverSso(email);
}

export function resetPassword(providerId: string): Promise<{ ok: true; destination: string }> {
  return api().resetPassword(providerId);
}

export function changePassword(providerId: string): Promise<{ ok: true; destination: string }> {
  return api().changePassword(providerId);
}

export function runRequest(auth: RunnerAuth, url: string): Promise<ApiResponse> {
  return api().runRequest(auth, url);
}
