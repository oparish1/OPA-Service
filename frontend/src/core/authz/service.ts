import { RUNNER_TIMEOUT_MS } from '../../../../shared/request-runner';
import { AUTHZ_REASONS, CAPABILITY_IDS } from './generated';
import type { AuthzReason, Capabilities, Decision } from './types';

/**
 * The gateway's capability endpoint. The gateway builds the OPA input from the
 * token it already verified, so the browser sends only its bearer token and
 * never claims or a policy query.
 */

export const AUTHZ_CAPABILITIES_PATH = '/authz/capabilities';

function isAuthzReason(value: unknown): value is AuthzReason {
  return typeof value === 'string' && (AUTHZ_REASONS as readonly string[]).includes(value);
}

/** A stable failure code an operator can look up; never carries body content. */
export class CapabilitiesError extends Error {
  readonly code: string;

  constructor(code: string) {
    super(code);
    this.name = 'CapabilitiesError';
    this.code = code;
  }
}

function parseDecision(value: unknown): Decision {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new CapabilitiesError('capabilities_body_invalid');
  }
  const record = value as Record<string, unknown>;
  if (typeof record.allowed !== 'boolean') {
    throw new CapabilitiesError('capabilities_body_invalid');
  }
  if (record.allowed) return { allowed: true, reason: '' };
  if (!isAuthzReason(record.reason)) throw new CapabilitiesError('capabilities_body_invalid');
  return { allowed: false, reason: record.reason };
}

/** Requires every capability with a boolean decision and an allowed deny reason. */
export function parseCapabilities(raw: unknown): Capabilities {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new CapabilitiesError('capabilities_body_invalid');
  }
  const record = raw as Record<string, unknown>;
  const result = {} as Capabilities;
  for (const capability of CAPABILITY_IDS) {
    result[capability] = parseDecision(record[capability]);
  }
  return result;
}

/** Fetches and validates the caller's capability map from the gateway. */
export async function fetchCapabilities(
  url: string,
  token: string,
  fetchImpl: typeof fetch = fetch
): Promise<Capabilities> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), RUNNER_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetchImpl(url, {
      headers: { authorization: `Bearer ${token}`, accept: 'application/json' },
      redirect: 'manual',
      signal: controller.signal,
    });
  } catch {
    throw new CapabilitiesError(
      controller.signal.aborted ? 'capabilities_timeout' : 'capabilities_fetch_failed'
    );
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) throw new CapabilitiesError(`capabilities_http_${response.status}`);

  let raw: unknown;
  try {
    raw = await response.json();
  } catch {
    throw new CapabilitiesError('capabilities_body_invalid');
  }
  return parseCapabilities(raw);
}
