import { STATUS_CODES } from 'node:http';
import { parseRunnerUrl } from '../../../shared/request-runner';
import type {
  RelayFailure,
  RelayOutcome,
  RunnerAuth,
  RunnerErrorCode,
} from '../../../shared/request-runner';

export { RUNNER_AUTH_VALUES } from '../../../shared/request-runner';
export type {
  RelayFailure,
  RelayOutcome,
  RelaySuccess,
  RunnerAuth,
  RunnerErrorCode,
} from '../../../shared/request-runner';

export const RUNNER_BODY_CAP = 1024 * 1024;
export const RUNNER_TIMEOUT_MS = 10_000;
export const RUNNER_ACCEPT = 'application/json, text/plain;q=0.9, */*;q=0.1';

/** Response headers the relay is allowed to return; `set-cookie` is never among them. */
export const RUNNER_RESPONSE_HEADERS = [
  'content-type',
  'content-length',
  'date',
  'cache-control',
  'etag',
  'www-authenticate',
  'retry-after',
  'x-request-id',
] as const;

export interface RelayOptions {
  url: string;
  auth: RunnerAuth;
  sessionToken?: string;
  allowedHosts: readonly string[];
  ownOrigin: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

export interface RelayTargetOptions {
  url: string;
  auth: RunnerAuth;
  sessionToken?: string;
  allowedHosts: readonly string[];
  ownOrigin: string;
}

/** A GET dispatched through the app's own router rather than the network. */
export interface InjectRequest {
  method: string;
  url: string;
  cookies?: Record<string, string>;
  headers?: Record<string, string>;
}

export interface InjectResponse {
  statusCode: number;
  statusMessage?: string;
  headers: Record<string, string | string[] | number | undefined>;
  body: string;
}

export type Inject = (request: InjectRequest) => Promise<InjectResponse>;

export interface RelayInProcessOptions {
  url: string;
  allowedHosts: readonly string[];
  ownOrigin: string;
  cookieName: string;
  cookieValue: string;
  inject: Inject;
  timeoutMs?: number;
}

const TEXTUAL_HINTS = ['json', 'xml', 'javascript', 'x-www-form-urlencoded', 'csv'];

/** The media type without parameters, lowercased; `null` when the header is absent. */
export function normalizeContentType(value: string | null): string | null {
  if (!value) return null;
  const type = value.split(';')[0]?.trim().toLowerCase();
  return type || null;
}

/** A missing content type is treated as textual; the relay only decodes textual bodies. */
export function isTextualContentType(value: string | null): boolean {
  const type = normalizeContentType(value);
  if (!type) return true;
  if (type.startsWith('text/')) return true;
  return TEXTUAL_HINTS.some(hint => type.includes(hint));
}

function safeOrigin(value: string): string {
  try {
    return new URL(value).origin;
  } catch {
    return value;
  }
}

function filterHeaders(headers: Headers): string[] {
  const allowed = new Set<string>(RUNNER_RESPONSE_HEADERS);
  const result: string[] = [];
  headers.forEach((value, key) => {
    const name = key.toLowerCase();
    if (allowed.has(name)) result.push(`${name}: ${value}`);
  });
  return result;
}

function concatenate(chunks: readonly Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }
  return merged;
}

async function readBody(
  body: ReadableStream<Uint8Array> | null
): Promise<{ bytes: Uint8Array; truncated: boolean }> {
  if (!body) return { bytes: new Uint8Array(), truncated: false };
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  let truncated = false;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      const remaining = RUNNER_BODY_CAP - size;
      if (remaining <= 0) {
        truncated = true;
        break;
      }
      if (value.length > remaining) {
        chunks.push(value.subarray(0, remaining));
        size = RUNNER_BODY_CAP;
        truncated = true;
        break;
      }
      chunks.push(value);
      size += value.length;
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }
  return { bytes: concatenate(chunks), truncated };
}

function isAbortError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    (error as { name?: string }).name === 'AbortError'
  );
}

/**
 * Applies the URL, host-allowlist and auth/host rules. `relayRequest` and
 * `relayInProcess` share it so the in-process path cannot drift from the rules.
 */
export function resolveRelayTarget(
  options: RelayTargetOptions
): { target: URL; error?: undefined } | { target?: undefined; error: RunnerErrorCode } {
  const target = parseRunnerUrl(options.url);
  if (!target) return { error: 'invalid_url' };

  const allowed = new Set(options.allowedHosts.map(host => host.toLowerCase()));
  if (!allowed.has(target.host.toLowerCase())) return { error: 'blocked_host' };

  if (options.auth === 'session') {
    if (target.origin !== safeOrigin(options.ownOrigin)) {
      return { error: 'session_token_not_allowed_for_host' };
    }
    if (!options.sessionToken) return { error: 'request_failed' };
  }
  return { target };
}

/**
 * Relays one GET to a validated target. The caller owns the session token; this
 * function only ever attaches it to the app's own origin. Nothing is sent when
 * the URL, host or auth/host combination fails a rule.
 */
export async function relayRequest(options: RelayOptions): Promise<RelayOutcome> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? RUNNER_TIMEOUT_MS;
  const started = Date.now();
  const fail = (error: RunnerErrorCode): RelayFailure => ({
    error,
    receivedAt: new Date().toISOString(),
  });

  const resolved = resolveRelayTarget(options);
  if (resolved.error) return fail(resolved.error);
  const target = resolved.target;

  const headers: Record<string, string> = { accept: RUNNER_ACCEPT };
  if (options.auth === 'session') headers.authorization = `Bearer ${options.sessionToken}`;
  else if (options.auth === 'valid-token-123') headers.authorization = 'Bearer valid-token-123';
  else if (options.auth === 'expired-token') headers.authorization = 'Bearer expired-token';

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(target.toString(), {
      method: 'GET',
      headers,
      redirect: 'manual',
      signal: controller.signal,
    });
    const { bytes, truncated } = await readBody(response.body);
    const contentType = response.headers.get('content-type')?.toLowerCase() ?? null;
    const body =
      bytes.length > 0 && isTextualContentType(contentType) ? new TextDecoder().decode(bytes) : '';
    return {
      status: response.status,
      statusText: response.statusText || STATUS_CODES[response.status] || '',
      headers: filterHeaders(response.headers),
      contentType,
      body,
      truncated,
      size: bytes.length,
      durationMs: Date.now() - started,
      receivedAt: new Date().toISOString(),
    };
  } catch (error) {
    const failure = { durationMs: Date.now() - started, receivedAt: new Date().toISOString() };
    if (isAbortError(error)) return { error: 'request_timeout', ...failure };
    return { error: 'request_failed', ...failure };
  } finally {
    clearTimeout(timer);
  }
}

function headerEntries(headers: Record<string, string | string[] | number | undefined>): Headers {
  const result = new Headers();
  for (const [name, value] of Object.entries(headers)) {
    if (typeof value === 'string') result.set(name, value);
    else if (Array.isArray(value)) result.set(name, value.join(', '));
    else if (typeof value === 'number') result.set(name, String(value));
  }
  return result;
}

/**
 * Relays one GET by dispatching through the app's own router with the caller's
 * signed session cookie. The request re-enters the real guard and `/v1` routes,
 * so no provider token is minted, attached or sent off the process.
 */
export async function relayInProcess(options: RelayInProcessOptions): Promise<RelayOutcome> {
  const started = Date.now();
  const fail = (error: RunnerErrorCode): RelayFailure => ({
    error,
    durationMs: Date.now() - started,
    receivedAt: new Date().toISOString(),
  });

  const resolved = resolveRelayTarget({
    url: options.url,
    auth: 'session',
    allowedHosts: options.allowedHosts,
    ownOrigin: options.ownOrigin,
    sessionToken: options.cookieValue,
  });
  if (resolved.error) return fail(resolved.error);
  const target = resolved.target;

  let response: InjectResponse;
  try {
    response = await options.inject({
      method: 'GET',
      url: `${target.pathname}${target.search}`,
      cookies: { [options.cookieName]: options.cookieValue },
      headers: { accept: RUNNER_ACCEPT },
    });
  } catch {
    return fail('request_failed');
  }

  const bytes = new TextEncoder().encode(response.body ?? '');
  const truncated = bytes.length > RUNNER_BODY_CAP;
  const slice = truncated ? bytes.subarray(0, RUNNER_BODY_CAP) : bytes;
  const headers = headerEntries(response.headers);
  const contentType = headers.get('content-type')?.toLowerCase() ?? null;
  const body =
    slice.length > 0 && isTextualContentType(contentType) ? new TextDecoder().decode(slice) : '';
  return {
    status: response.statusCode,
    statusText: response.statusMessage || STATUS_CODES[response.statusCode] || '',
    headers: filterHeaders(headers),
    contentType,
    body,
    truncated,
    size: slice.length,
    durationMs: Date.now() - started,
    receivedAt: new Date().toISOString(),
  };
}
