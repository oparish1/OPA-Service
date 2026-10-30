import {
  parseRunnerUrl,
  RESPONSE_HEADER_ALLOWLIST,
  RUNNER_MAX_RESPONSE_BYTES,
  RUNNER_TIMEOUT_MS,
} from '../../../../shared/request-runner';
import { gatewayUrl } from '../config';
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

function failure(code: RunnerErrorCode): ApiResponse {
  return {
    status: 0,
    statusLabel: FAILURE_LABEL[code],
    duration: '—',
    size: '—',
    timestamp: '—',
    body: { error: code },
    headers: [],
    errorCode: code,
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
  } catch {
    return null;
  }
}

export async function runRequest(auth: RunnerAuth, url: string): Promise<ApiResponse> {
  const target = parseRunnerUrl(url);
  if (!target) return failure('invalid_url');

  const origin = gatewayOrigin();
  if (!origin || target.origin !== origin) return failure('blocked_host');

  if (auth === 'session') touch();
  const token = await authorizationValue(auth);
  if (auth === 'session' && !token) return failure('request_failed');

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

    return {
      status: response.status,
      statusLabel: `${response.status} ${response.statusText}`.trim(),
      duration: formatDuration(Date.now() - started),
      size: formatSize(bytes.byteLength, truncated),
      timestamp: formatTimestamp(new Date()),
      body,
      headers: responseHeaders,
      bodyKind,
      sizeBytes: bytes.byteLength,
    };
  } catch (error) {
    if (controller.signal.aborted) return failure('request_timeout');
    if (error instanceof Error) return failure('request_failed');
    return failure('request_failed');
  } finally {
    clearTimeout(timeout);
  }
}
