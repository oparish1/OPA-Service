import {
  parseRunnerUrl,
  RESPONSE_HEADER_ALLOWLIST,
  RUNNER_MAX_RESPONSE_BYTES,
  RUNNER_TIMEOUT_MS,
} from '../../../../shared/request-runner';
import { gatewayUrl } from '../config';
import { describeError, log } from '../lib/log';
import { decodeBody, formatDuration, formatSize, formatTimestamp } from '../lib/response-format';
import { revealToken, touch } from '../session/store';
import type { ApiResponse, RunnerAuth, RunnerErrorCode } from '../types';

/**
 * The browser's direct runner (FE-6). It may call only the configured gateway
 * origin; any other origin fails before a request is sent (A5). The gateway is
 * the authority, so this code only attaches the chosen Authorization value.
 */

const FAILURE_LABEL: Record<RunnerErrorCode, string> = {
  invalid_url: 'Invalid URL',
  blocked_host: 'Blocked host',
  session_token_not_allowed_for_host: 'Session token not allowed',
  request_timeout: 'Network error',
  request_failed: 'Network error',
};

function failure(code: RunnerErrorCode, reference?: string): ApiResponse {
  return {
    status: 0,
    statusLabel: FAILURE_LABEL[code],
    duration: '—',
    size: '—',
    timestamp: '—',
    body: { error: code },
    headers: [],
    errorCode: code,
    reference,
  };
}

async function authorizationValue(auth: RunnerAuth): Promise<string | null> {
  switch (auth) {
    case 'session':
      return revealToken('access');
    case 'valid-token-123':
      return 'valid-token-123';
    case 'expired-token':
      return 'expired-token';
    case 'none':
      return null;
  }
}

export function gatewayOrigin(): string | null {
  const configured = gatewayUrl();
  if (!configured) return null;
  try {
    return new URL(configured).origin;
  } catch (error) {
    log.warn('runner', 'Gateway URL is not a valid URL', { error: describeError(error) });
    return null;
  }
}

export async function runRequest(auth: RunnerAuth, url: string): Promise<ApiResponse> {
  const target = parseRunnerUrl(url);
  if (!target) {
    const reference = log.error('runner', 'Request URL is invalid', { url });
    return failure('invalid_url', reference);
  }

  const origin = gatewayOrigin();
  if (!origin || target.origin !== origin) {
    const reference = log.error('runner', 'Request host is not allowed', {
      host: target.host,
      path: target.pathname,
    });
    return failure('blocked_host', reference);
  }

  if (auth === 'session') touch();
  const token = await authorizationValue(auth);
  if (auth === 'session' && !token) {
    const reference = log.error('runner', 'Session token is unavailable', {
      host: target.host,
      path: target.pathname,
    });
    return failure('request_failed', reference);
  }

  const headers: Record<string, string> = {
    accept: 'application/json, text/plain;q=0.9, */*;q=0.1',
  };
  if (token) headers.authorization = `Bearer ${token}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), RUNNER_TIMEOUT_MS);
  const started = Date.now();
  try {
    const response = await fetch(target.toString(), {
      headers,
      signal: controller.signal,
      redirect: 'manual',
    });
    const buffer = new Uint8Array(await response.arrayBuffer());
    const truncated = buffer.byteLength > RUNNER_MAX_RESPONSE_BYTES;
    const bytes = truncated ? buffer.slice(0, RUNNER_MAX_RESPONSE_BYTES) : buffer;
    const text = new TextDecoder().decode(bytes);

    const responseHeaders: string[] = [];
    response.headers.forEach((value, key) => {
      if ((RESPONSE_HEADER_ALLOWLIST as readonly string[]).includes(key.toLowerCase())) {
        responseHeaders.push(`${key.toLowerCase()}: ${value}`);
      }
    });
    const contentType = response.headers.get('content-type');
    const { body, bodyKind } = decodeBody(contentType, text, bytes.byteLength);
    const durationMs = Date.now() - started;

    let reference: string | undefined;
    if (response.status >= 400) {
      const logStatus = response.status >= 500 ? log.error : log.warn;
      reference = logStatus('runner', 'Request returned an error status', {
        host: target.host,
        path: target.pathname,
        status: response.status,
        durationMs,
        requestId: response.headers.get('x-request-id') ?? undefined,
      });
    }

    return {
      status: response.status,
      statusLabel: `${response.status} ${response.statusText}`.trim(),
      duration: formatDuration(durationMs),
      size: formatSize(bytes.byteLength, truncated),
      timestamp: formatTimestamp(new Date()),
      body,
      headers: responseHeaders,
      bodyKind,
      sizeBytes: bytes.byteLength,
      reference,
    };
  } catch (error) {
    const durationMs = Date.now() - started;
    if (controller.signal.aborted) {
      const reference = log.error('runner', 'Request timed out', {
        host: target.host,
        path: target.pathname,
        durationMs,
      });
      return failure('request_timeout', reference);
    }
    const reference = log.error('runner', 'Request failed', {
      host: target.host,
      path: target.pathname,
      durationMs,
      error: describeError(error),
    });
    return failure('request_failed', reference);
  } finally {
    clearTimeout(timeout);
  }
}
