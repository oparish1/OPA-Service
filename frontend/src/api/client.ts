import type { ProviderId } from '../mocks/data';
import { PROFILE_ENDPOINT } from '../mocks/data';
import type { AccessToken, ApiErrorKind, ApiResponse, Identity, Session, TokenKind } from '../types';

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

function responseHeaders(response: Response): string[] {
  const headers: string[] = [];
  response.headers.forEach((value, key) => headers.push(`${key}: ${value}`));
  return headers;
}

function networkError(): ApiResponse {
  return {
    status: 0,
    statusLabel: 'Network error',
    duration: '0 ms',
    size: '0 B',
    timestamp: formatTimestamp(),
    body: { error: 'request_timeout' },
    headers: [],
  };
}

async function request(
  endpoint: string,
  token?: string
): Promise<ApiResponse> {
  const started = Date.now();
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  try {
    const response = await fetch(new URL(endpoint).pathname, {
      credentials: 'same-origin',
      headers,
    });
    const text = await response.text();
    let body: unknown = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = text;
    }
    return {
      status: response.status,
      statusLabel: `${response.status} ${response.statusText}`.trim(),
      duration: `${Date.now() - started} ms`,
      size: `${new TextEncoder().encode(text).length} B`,
      timestamp: formatTimestamp(),
      body,
      headers: responseHeaders(response),
    };
  } catch {
    return networkError();
  }
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

export async function runRequest(token: string, endpoint: string = PROFILE_ENDPOINT): Promise<ApiResponse> {
  return request(endpoint, token || undefined);
}

export type { ApiErrorKind };
