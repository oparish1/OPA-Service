import { getAppConfig, getProviderConfig } from '../config';
import { describeError, log } from '../lib/log';
import { getProviderRegistry } from '../providers/active';
import { getSession } from '../session/store';
import { clearCapabilities, setCapabilities, setError } from './store';
import { evaluateCapabilities, resetPolicy } from './wasm';

let generation = 0;

/**
 * Loads the capability map once for the current session from the synced policy.
 * Called after sign-in and after a renewal changes the claims, never from a
 * render. A missing config, a disabled `authz.enabled` or a missing session
 * falls back to the pre-change behavior; a failed load or evaluation falls back
 * to the fail-closed floor. The run's generation is checked after the await so a
 * refresh that finishes after sign-out or a provider switch cannot repopulate
 * the map.
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
    const module = getProviderRegistry().get(session.providerId);
    const providerSession = module?.auth?.session();
    const providerConfig = getProviderConfig(session.providerId);
    if (!module?.authz || !providerSession || !providerConfig) {
      clearCapabilities();
      return;
    }
    const capabilities = await evaluateCapabilities(
      module.id,
      module.authz.claims(providerSession),
      module.authz.config(providerConfig)
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

/** Sign-out: drop the cached policy and the decisions together. */
export function clearPermissions(): void {
  generation++;
  resetPolicy();
  clearCapabilities();
}
