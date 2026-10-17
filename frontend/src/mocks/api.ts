import { PROJECTS_PATH } from '../lib/runner-url';
import {
  EMPTY_PROJECTS_BODY,
  MOCK_PROFILE_BODY,
  MOCK_PROJECTS_BODY,
  MOCK_SESSION,
  PROVIDER_LINKS,
  PROVIDERS,
  identityFor,
  providerInfos,
} from './data';
import type { ProviderId } from './data';
import type {
  AccessToken,
  ApiErrorKind,
  ApiResponse,
  Identity,
  MockConfig,
  ProviderInfo,
  RunnerAuth,
  Session,
  TokenKind,
} from './types';

const DEFAULT_CONFIG: MockConfig = {
  latencyMs: 1500,
  signInFailure: false,
  resetPasswordFailure: false,
  changePasswordFailure: false,
  refreshTokenFailure: false,
  revealTokenFailure: false,
  getSessionFailure: false,
  getIdentitiesFailure: false,
  runRequestFailure: null,
  projectsEmpty: false,
  identitiesEmpty: false,
};

let config: MockConfig = { ...DEFAULT_CONFIG };

/** The mock's current session; the default demo session until a sign-in or refresh replaces it. */
let activeSession: Session = MOCK_SESSION;
let activeProviderId: ProviderId = 'entra';

/** Test/demo seam for the mocked network. */
export function configureMocks(partial: Partial<MockConfig>): void {
  config = { ...config, ...partial };
}

export function resetMocks(): void {
  config = { ...DEFAULT_CONFIG };
  activeSession = MOCK_SESSION;
  activeProviderId = 'entra';
}

/** Clears the mocked session when the user signs out. */
export async function signOut(): Promise<void> {
  activeSession = MOCK_SESSION;
  activeProviderId = 'entra';
}

export async function getProviders(): Promise<ProviderInfo[]> {
  return delay(providerInfos());
}

function delay<T>(value: T, ms = config.latencyMs): Promise<T> {
  return new Promise(resolve => {
    setTimeout(() => resolve(value), ms);
  });
}

function fail<T>(error: Error, ms = config.latencyMs): Promise<T> {
  return new Promise((_resolve, reject) => {
    setTimeout(() => reject(error), ms);
  });
}

const RESPONSE_DATE = 'Fri, 10 Oct 2026 14:12:00 GMT';

function responseHeaders(statusLabel: string): string[] {
  return [`status: ${statusLabel}`, 'content-type: application/json', `date: ${RESPONSE_DATE}`];
}

function errorResponse(kind: ApiErrorKind): ApiResponse {
  switch (kind) {
    case 'unauthorized':
      return {
        status: 401,
        statusLabel: '401 Unauthorized',
        duration: '84 ms',
        size: '186 B',
        timestamp: '14:30 UTC',
        body: {
          error: 'invalid_token',
          message: 'The access token has expired.',
          expired_at: '2026-10-10T14:30:00Z',
          request_id: 'demo-req-002',
        },
        headers: responseHeaders('401 Unauthorized'),
        bodyKind: 'json',
        sizeBytes: 186,
      };
    case 'forbidden':
      return {
        status: 403,
        statusLabel: '403 Forbidden',
        duration: '96 ms',
        size: '162 B',
        timestamp: '14:30 UTC',
        body: { error: 'forbidden', message: 'Missing scope profile.read' },
        headers: responseHeaders('403 Forbidden'),
        bodyKind: 'json',
        sizeBytes: 162,
      };
    case 'notFound':
      return {
        status: 404,
        statusLabel: '404 Not Found',
        duration: '78 ms',
        size: '148 B',
        timestamp: '14:30 UTC',
        body: { error: 'not_found', message: 'Resource not found' },
        headers: responseHeaders('404 Not Found'),
        bodyKind: 'json',
        sizeBytes: 148,
      };
    case 'server':
      return {
        status: 500,
        statusLabel: '500 Server Error',
        duration: '412 ms',
        size: '154 B',
        timestamp: '14:30 UTC',
        body: { error: 'server_error', message: 'Downstream service unavailable' },
        headers: responseHeaders('500 Server Error'),
        bodyKind: 'json',
        sizeBytes: 154,
      };
    case 'timeout':
      return {
        status: 0,
        statusLabel: 'Network error',
        duration: '10000 ms',
        size: '30 B',
        timestamp: '14:30 UTC',
        body: { error: 'request_timeout' },
        headers: [],
        bodyKind: 'json',
        sizeBytes: 30,
      };
  }
}

function successResponse(endpoint: string): ApiResponse {
  const isProjects = endpoint.includes(PROJECTS_PATH);
  const body = isProjects
    ? config.projectsEmpty
      ? EMPTY_PROJECTS_BODY
      : MOCK_PROJECTS_BODY
    : MOCK_PROFILE_BODY;
  const sizeBytes = new TextEncoder().encode(JSON.stringify(body)).length;
  return {
    status: 200,
    statusLabel: '200 OK',
    duration: isProjects ? '128 ms' : '142 ms',
    size: `${sizeBytes} B`,
    timestamp: '10 Oct 2026 · 14:12:00 UTC',
    body,
    headers: responseHeaders('200 OK'),
    bodyKind: 'json',
    sizeBytes,
  };
}

/** Mocked provider sign-in. Establishes the session returned by later `getSession` calls. */
export async function signIn(providerId: ProviderId): Promise<Session> {
  if (config.signInFailure) {
    return fail(new Error('Sign-in failed. Try again.'));
  }
  const provider = PROVIDERS.find(candidate => candidate.id === providerId);
  const session = await delay({ ...MOCK_SESSION, provider: provider?.name ?? MOCK_SESSION.provider });
  activeSession = session;
  activeProviderId = provider?.id ?? activeProviderId;
  return session;
}

export interface SsoDiscovery {
  found: boolean;
  providerId: ProviderId | null;
}

/**
 * Mocked SSO discovery. A recognized domain resolves to the matching provider;
 * an unknown domain resolves `found:false`; the seeded `offline.example` domain
 * rejects to exercise the network-failure notice.
 */
export async function discoverSso(email: string): Promise<SsoDiscovery> {
  const domain = email.split('@')[1]?.toLowerCase() ?? '';
  if (domain === 'offline.example') {
    return fail(new Error('Network unavailable'));
  }
  const provider = PROVIDERS.find(candidate => candidate.ssoDomain === domain);
  return delay(provider ? { found: true, providerId: provider.id } : { found: false, providerId: null });
}

export async function resetPassword(providerId: ProviderId): Promise<{ ok: true; destination: string }> {
  const destination = PROVIDER_LINKS[providerId]?.forgotPasswordUrl;
  if (!destination) return fail(new Error('No recovery destination configured.'));
  if (config.resetPasswordFailure) return fail(new Error('Reset request failed.'));
  return delay({ ok: true as const, destination });
}

export async function changePassword(providerId: ProviderId): Promise<{ ok: true; destination: string }> {
  const destination = PROVIDER_LINKS[providerId]?.changePasswordUrl;
  if (!destination) return fail(new Error('No change-password destination configured.'));
  if (config.changePasswordFailure) return fail(new Error('Change request failed.'));
  return delay({ ok: true as const, destination });
}

export async function getSession(): Promise<Session> {
  if (config.getSessionFailure) {
    return fail(new Error('Session unavailable'));
  }
  return delay(activeSession);
}

export async function getIdentities(): Promise<Identity[]> {
  if (config.getIdentitiesFailure) {
    return fail(new Error('Could not load identities'));
  }
  if (config.identitiesEmpty) return delay([]);
  return delay([identityFor(activeProviderId, activeSession.account?.email ?? '')]);
}

/**
 * Mocked session bootstrap. The mock never restores a session across reloads,
 * so the app keeps its configured initial screen.
 */
export async function bootstrapSession(): Promise<boolean> {
  return false;
}

/** Mocked token reveal. Returns the value the mocked session already holds. */
export async function revealToken(kind: TokenKind): Promise<string> {
  if (config.revealTokenFailure) {
    return fail(new Error('Token reveal failed'));
  }
  return delay(kind === 'access' ? activeSession.accessToken.value : activeSession.refreshToken.value);
}

export async function runRequest(auth: RunnerAuth, url: string): Promise<ApiResponse> {
  if (config.runRequestFailure) {
    return delay(errorResponse(config.runRequestFailure));
  }
  if (auth !== 'session') {
    return delay(errorResponse('unauthorized'));
  }
  return delay(successResponse(url));
}

export async function refreshToken(): Promise<AccessToken> {
  if (config.refreshTokenFailure) {
    return fail(new Error('Refresh token expired. Sign in again.'));
  }
  const refreshed: AccessToken = {
    masked: 'demo_at_refreshed…b21c',
    value: 'demo_at_refreshed_20261010_orlando_parish_b21c',
    expiresAt: '10 Oct 2026 · 15:00:00 UTC',
    scopes: 'profile.read · projects.read',
  };
  activeSession = { ...activeSession, accessToken: refreshed };
  return delay(refreshed);
}
