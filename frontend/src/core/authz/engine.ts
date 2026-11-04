import { getAppConfig, getProviderConfig } from '../config';
import { describeError, log } from '../lib/log';
import { getProviderRegistry } from '../providers/active';
import { getSession } from '../session/store';
import { evaluateCapabilities, resetPolicy } from './policy';
import { clearCapabilities, setCapabilities, setError, setLoading } from './store';
import type { AuthzInput } from './types';

/**
 * Evaluates the policy once for the current session. Called after sign-in and
 * after a renewal changes the claims, never from a render. A missing session or
 * a provider without the authz facet falls back to the pre-change behavior; a
 * load or evaluation failure falls back to the fail-closed floor.
 */
export async function refreshCapabilities(): Promise<void> {
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

  setLoading();
  try {
    const input: AuthzInput = {
      provider: module.id,
      claims: module.authz.claims(providerSession),
    };
    const data = { [module.id]: module.authz.config(providerConfig) };
    setCapabilities(await evaluateCapabilities(input, data));
  } catch (error) {
    // Only the error shape is logged; no claim, token or policy input.
    log.error('authz', 'Permissions could not be loaded', { error: describeError(error) });
    setError();
  }
}

/** Sign-out: drop the cached policy and the decisions together. */
export function clearPermissions(): void {
  resetPolicy();
  clearCapabilities();
}
