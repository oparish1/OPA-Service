/**
 * The browser runner's URL, timeout, response-cap and header rules. The runner
 * and its tests import this single module so the limits cannot drift apart.
 */

export const RUNNER_AUTH_VALUES = ['session', 'valid-token-123', 'expired-token', 'none'] as const;
export type RunnerAuth = (typeof RUNNER_AUTH_VALUES)[number];

export const RUNNER_MAX_URL_LENGTH = 2048;
export const RUNNER_TIMEOUT_MS = 10_000;
export const RUNNER_MAX_RESPONSE_BYTES = 1024 * 1024;

/** Response headers the browser runner may show; `set-cookie` is never included. */
export const RESPONSE_HEADER_ALLOWLIST = [
  'content-type',
  'content-length',
  'date',
  'cache-control',
  'etag',
  'www-authenticate',
  'retry-after',
  'x-request-id',
] as const;

export type RunnerErrorCode =
  | 'invalid_url'
  | 'blocked_host'
  | 'session_token_not_allowed_for_host'
  | 'request_timeout'
  | 'request_failed';

/** Parses a request target, enforcing the shared URL rules; `null` when unusable. */
export function parseRunnerUrl(value: string): URL | null {
  if (value.length > RUNNER_MAX_URL_LENGTH) return null;
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
  if (parsed.username || parsed.password) return null;
  return parsed;
}
