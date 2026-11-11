import { getAppConfig } from '../config';
import { describeError, log } from '../lib/log';
import { appUrl } from '../lib/runner-url';
import { getSession } from '../session/store';
import { AUTHZ_CAPABILITIES_PATH, fetchCapabilities } from './service';
import { clearCapabilities, setCapabilities, setError } from './store';

let generation = 0;

/**
 * Fetches the capability map once for the current session. Called after sign-in
 * and after a renewal changes the claims, never from a render. A missing config,
 * a disabled `authz.enabled` or a missing session falls back to the pre-change
 * behavior; a failed or invalid response falls back to the fail-closed floor.
 * The run's generation is checked after the await so a refresh that finishes
 * after sign-out or a provider switch cannot repopulate the map.
 */
export async function refreshCapabilities(): Promise<void> {
  const run = ++generation;
  const config = getAppConfig();
  if (!config || config.authz.enabled === false) {
    clearCapabilities();
    return;
  }

  const session = getSession();
  if (!session || !session.accessToken.value) {
    clearCapabilities();
    return;
  }

  try {
    const capabilities = await fetchCapabilities(
      appUrl(AUTHZ_CAPABILITIES_PATH),
      session.accessToken.value
    );
    if (run !== generation) return;
    setCapabilities(capabilities);
  } catch (error) {
    if (run !== generation) return;
    // Only the error shape is logged; no claim, token or body.
    log.error('authz', 'Permissions could not be loaded', { error: describeError(error) });
    setError();
  }
}

/** Sign-out: drop the cached decisions. */
export function clearPermissions(): void {
  generation++;
  clearCapabilities();
}
