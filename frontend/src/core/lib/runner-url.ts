import { parseRunnerUrl } from '../../../../shared/request-runner';
import { getAppConfig } from '../config';
import { getSession } from '../session/store';
import type { RunnerAuth } from '../types';

export const PROFILE_PATH = '/v1/me';
export const PROJECTS_PATH = '/v1/projects';
export const INVALID_URL_MESSAGE = 'Enter a valid http or https URL.';

/**
 * The active provider's gateway URL plus the `/v1` path (FE-6). Before the
 * public config is loaded the window origin is used, so the mock layer and its
 * component tests keep working unchanged.
 */
export function appUrl(path: string): string {
  const config = getAppConfig();
  if (!config) return `${window.location.origin}${path}`;
  const providerId = getSession()?.providerId ?? config.providers[0]?.id;
  return `${config.gatewayUrl.replace(/\/$/, '')}/${providerId}${path}`;
}

/** The four Authorization options in their fixed order; the session entry is default. */
export function runnerAuthOptions(
  masked: string
): ReadonlyArray<{ value: RunnerAuth; label: string }> {
  return [
    { value: 'session', label: `Bearer · ${masked}` },
    { value: 'valid-token-123', label: 'Bearer valid-token-123' },
    { value: 'expired-token', label: 'Bearer expired-token' },
    { value: 'none', label: 'no-token' },
  ];
}

/** Returns the error message for an unusable request URL, or null when it is valid. */
export function validateRunnerUrl(value: string): string | null {
  return parseRunnerUrl(value) ? null : INVALID_URL_MESSAGE;
}
