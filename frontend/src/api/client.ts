import type { ProviderId } from '../mocks/data';
import type { RelayFailure, RelaySuccess } from '../../../shared/request-runner';
import { decodeBody, formatDuration, formatSize } from '../lib/response-format';
import type {
  AccessToken,
  ApiErrorKind,
  ApiResponse,
  Identity,
  RunnerAuth,
  RunnerErrorCode,
  Session,
  TokenKind,
} from '../types';

interface RawTokenMetadata {
  masked: string;
  expiresAt: string;
  scopes?: string;
  grant?: string;
}

interface RawSession {
  provider: string;
  account: Session['account'];
  accessToken: RawTokenMetadata;
  refreshToken: RawTokenMetadata;
  issuer: string;
  issuedAt: string;
  snapshot: string;
  csrfToken: string;
}

/** Synchronizer token fetched with the session and echoed on state-changing requests. */
let csrfToken: string | null = null;

function toSession(raw: RawSession): Session {
  return {
    provider: raw.provider,
    account: raw.account,
    accessToken: { ...raw.accessToken, value: '', scopes: raw.accessToken.scopes ?? '' },
    refreshToken: { ...raw.refreshToken, value: '', grant: raw.refreshToken.grant ?? '' },
    issuer: raw.issuer,
    issuedAt: raw.issuedAt,
    snapshot: raw.snapshot,
  };
}

function csrfHeaders(): Record<string, string> {
  return csrfToken ? { 'x-csrf-token': csrfToken } : {};
}

async function readSession(): Promise<RawSession | null> {
  const response = await fetch('/api/session', { credentials: 'same-origin' });
  if (!response.ok) return null;
  const raw = (await response.json()) as RawSession;
  csrfToken = raw.csrfToken;
  return raw;
}

async function ensureCsrf(): Promise<string> {
  if (!csrfToken) await readSession();
  return csrfToken ?? '';
}

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

/** Approved display format: `10 Oct 2026 · 13:30:00 UTC`. */
export function formatTimestamp(date = new Date()): string {
  const day = String(date.getUTCDate()).padStart(2, '0');
  const month = MONTHS[date.getUTCMonth()];
  const year = date.getUTCFullYear();
  const hh = String(date.getUTCHours()).padStart(2, '0');
  const mm = String(date.getUTCMinutes()).padStart(2, '0');
  const ss = String(date.getUTCSeconds()).padStart(2, '0');
  return `${day} ${month} ${year} · ${hh}:${mm}:${ss} UTC`;
}

const FAILURE_LABEL: Record<RunnerErrorCode, string> = {
  invalid_url: 'Invalid URL',
  blocked_host: 'Blocked host',
  session_token_not_allowed_for_host: 'Session token not allowed',
  request_timeout: 'Network error',
  request_failed: 'Network error',
};

/** These failures never sent a request, so they show no time, size or date. */
const NO_REQUEST_CODES: ReadonlySet<RunnerErrorCode> = new Set([
  'invalid_url',
  'blocked_host',
  'session_token_not_allowed_for_host',
]);

function relaySuccess(payload: RelaySuccess): ApiResponse {
  const { body, bodyKind } = decodeBody(payload.contentType, payload.body, payload.size);
  return {
    status: payload.status,
    statusLabel: `${payload.status} ${payload.statusText}`.trim(),
    duration: formatDuration(payload.durationMs),
    size: formatSize(payload.size, payload.truncated),
    timestamp: formatTimestamp(new Date(payload.receivedAt)),
    body,
    headers: payload.headers,
    bodyKind,
    sizeBytes: payload.size,
  };
}

function relayFailure(payload: RelayFailure): ApiResponse {
  const code: RunnerErrorCode =
    payload.error && payload.error in FAILURE_LABEL ? payload.error : 'request_failed';
  const noRequest = NO_REQUEST_CODES.has(code);
  return {
    status: 0,
    statusLabel: FAILURE_LABEL[code],
    duration:
      noRequest || payload.durationMs === undefined ? '—' : formatDuration(payload.durationMs),
    size: '—',
    timestamp: noRequest || !payload.receivedAt ? '—' : formatTimestamp(new Date(payload.receivedAt)),
    body: { error: code },
    headers: [],
    errorCode: code,
  };
}

const ENTRA_IDENTITY: Identity = {
  id: 'microsoft',
  name: 'Microsoft Entra ID',
  icon: 'building-2',
  subtitle: 'Agentic Advantage organisation account',
  status: 'primary',
  manageUrl: 'https://mysignins.microsoft.com/security-info',
};

/** Real sign-in is a top-level navigation into the BFF authorization-code flow. */
export function signIn(_providerId: ProviderId): Promise<Session> {
  window.location.assign('/auth/login');
  return new Promise<Session>(() => undefined);
}

export async function signOut(): Promise<void> {
  await ensureCsrf();
  const response = await fetch('/auth/logout', {
    method: 'POST',
    credentials: 'same-origin',
    headers: csrfHeaders(),
  });
  csrfToken = null;
  if (!response.ok) throw new Error('Sign-out failed');
}

export async function bootstrapSession(): Promise<boolean> {
  return (await readSession()) !== null;
}

export async function getSession(): Promise<Session> {
  const raw = await readSession();
  if (!raw) throw new Error('Session unavailable');
  return toSession(raw);
}

export async function revealToken(kind: TokenKind): Promise<string> {
  await ensureCsrf();
  const response = await fetch('/api/session/tokens/reveal', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json', ...csrfHeaders() },
    body: JSON.stringify({ kind }),
  });
  if (!response.ok) throw new Error('Token reveal failed');
  const payload = (await response.json()) as { value: string };
  return payload.value;
}

export async function refreshToken(): Promise<AccessToken> {
  await ensureCsrf();
  const response = await fetch('/api/session/refresh', {
    method: 'POST',
    credentials: 'same-origin',
    headers: csrfHeaders(),
  });
  if (!response.ok) throw new Error('Refresh token expired. Sign in again.');
  const raw = (await response.json()) as RawSession;
  csrfToken = raw.csrfToken;
  return toSession(raw).accessToken;
}

export async function getIdentities(): Promise<Identity[]> {
  return [ENTRA_IDENTITY];
}

export async function discoverSso(_email: string): Promise<{ found: false; providerId: null }> {
  return { found: false, providerId: null };
}

export async function resetPassword(_email: string): Promise<{ ok: true; destination: string }> {
  return { ok: true as const, destination: 'https://passwordreset.microsoftonline.com' };
}

export async function changePassword(_providerId: string): Promise<{ ok: true; destination: string }> {
  return { ok: true as const, destination: 'https://mysignins.microsoft.com/security-info' };
}

export async function runRequest(auth: RunnerAuth, url: string): Promise<ApiResponse> {
  try {
    await ensureCsrf();
  } catch {
    return relayFailure({ error: 'request_failed', receivedAt: new Date().toISOString() });
  }
  let response: Response;
  try {
    response = await fetch('/api/request-runner', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json', ...csrfHeaders() },
      body: JSON.stringify({ url, auth }),
    });
  } catch {
    return relayFailure({ error: 'request_failed', receivedAt: new Date().toISOString() });
  }
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return relayFailure({ error: 'request_failed', receivedAt: new Date().toISOString() });
  }
  if (response.ok) return relaySuccess(payload as RelaySuccess);
  return relayFailure(payload as RelayFailure);
}

export type { ApiErrorKind };
