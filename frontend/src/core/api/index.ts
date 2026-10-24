import type { SsoDiscovery } from '../mocks/api';
import * as mockApi from '../mocks/api';
import * as realApi from './client';
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
 * The authentication seam. Component tests import the mocks directly; the running
 * app resolves here and picks the real BFF client when VITE_AUTH_MODE=entra.
 */
const useReal = import.meta.env.VITE_AUTH_MODE === 'entra';

export function signIn(providerId: string): Promise<Session> {
  return useReal ? realApi.signIn(providerId) : mockApi.signIn(providerId);
}

export function signOut(): Promise<void> {
  return useReal ? realApi.signOut() : mockApi.signOut();
}

export function bootstrapSession(): Promise<boolean> {
  return useReal ? realApi.bootstrapSession() : mockApi.bootstrapSession();
}

export function getSession(): Promise<Session> {
  return useReal ? realApi.getSession() : mockApi.getSession();
}

export function getProviders(): Promise<ProviderInfo[]> {
  return useReal ? realApi.getProviders() : mockApi.getProviders();
}

export function revealToken(kind: TokenKind): Promise<string> {
  return useReal ? realApi.revealToken(kind) : mockApi.revealToken(kind);
}

export function refreshToken(): Promise<AccessToken> {
  return useReal ? realApi.refreshToken() : mockApi.refreshToken();
}

export function getIdentities(): Promise<Identity[]> {
  return useReal ? realApi.getIdentities() : mockApi.getIdentities();
}

export function discoverSso(email: string): Promise<SsoDiscovery> {
  return useReal ? realApi.discoverSso(email) : mockApi.discoverSso(email);
}

export function resetPassword(providerId: string): Promise<{ ok: true; destination: string }> {
  return useReal ? realApi.resetPassword(providerId) : mockApi.resetPassword(providerId);
}

export function changePassword(providerId: string): Promise<{ ok: true; destination: string }> {
  return useReal ? realApi.changePassword(providerId) : mockApi.changePassword(providerId);
}

export function runRequest(auth: RunnerAuth, url: string): Promise<ApiResponse> {
  return useReal ? realApi.runRequest(auth, url) : mockApi.runRequest(auth, url);
}