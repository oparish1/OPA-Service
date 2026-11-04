import { getAppConfig, getProviderConfig } from '../config';
import { describeError, log } from '../lib/log';
import { getProviderRegistry } from '../providers/active';
import { getSession } from '../session/store';
import { evaluateCapabilities, resetPolicy } from './policy';
import { clearCapabilities, setCapabilities, setError } from './store';
import type { AuthzInput } from './types';

let generation = 0;

/**
 * Evaluates the policy once for the current session. Called after sign-in and
 * after a renewal changes the claims, never from a render. A missing session or
 * a provider without the authz facet falls back to the pre-change behavior; a
 * load or evaluation failure falls back to the fail-closed floor. The run's
 * generation is checked after every await so a refresh that finishes after
 * sign-out or a provider switch cannot repopulate the map.
 */
export async function refreshCapabilities(): Promise<void> {
  const run = ++generation;
  const config = getAppConfig();
  if (!config || config.authz.enabled === false) {
    clearCapabilities();
    return;
  }

  const session = getSession();
  const module = session ? getProviderRegistry().get(session.providerId) : undefined;
  const providerSession = module?.auth?.session() ?? null;
  const providerConfig = session ? getProviderConfig(session.providerId) : undefined;
  if (!module?.authz || !providerSession || !providerConfig) {
    clearCapabilities();
    return;
  }

  try {
    const input: AuthzInput = {
      provider: module.id,
      claims: module.authz.claims(providerSession),
    };
    const capabilities = await evaluateCapabilities(input, module.authz.config(providerConfig));
    if (run !== generation) return;
    setCapabilities(capabilities);
  } catch (error) {
    if (run !== generation) return;
    // Only the error shape is logged; no claim, token or policy input.
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
