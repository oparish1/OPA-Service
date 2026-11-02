import { parseAppConfig } from '../../../shared/app-config';
import type { AppConfig, ProviderConfig } from '../../../shared/app-config';
import { describeError, log } from './lib/log';

/**
 * The one runtime owner of the loaded public config. `main.tsx` loads and
 * validates `config.json` before rendering; tests and the mock layer never load
 * it, so provider-neutral code can fall back to the window origin.
 */
let config: AppConfig | null = null;

export function setAppConfig(raw: unknown): AppConfig {
  config = parseAppConfig(raw);
  return config;
}

export function getAppConfig(): AppConfig | null {
  return config;
}

export function getProviderConfig(id: string): ProviderConfig | undefined {
  return config?.providers.find(provider => provider.id === id);
}

export function gatewayUrl(): string | null {
  return config?.gatewayUrl ?? null;
}

export type ConfigFailureReason = 'missing' | 'http' | 'not-json' | 'invalid' | 'secret' | 'network';

export type ConfigLoadResult =
  | { status: 'loaded'; config: AppConfig }
  | { status: 'error'; reason: ConfigFailureReason; message: string; reference: string };

/**
 * Loads the public config and classifies every failure so the entry point can
 * show the configuration error screen instead of falling back to the mock demo.
 */
export async function loadAppConfig(
  options: { fetchImpl?: typeof fetch; baseUrl?: string } = {}
): Promise<ConfigLoadResult> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const baseUrl = options.baseUrl ?? import.meta.env.BASE_URL;

  let response: Response;
  try {
    response = await fetchImpl(`${baseUrl}config.json`, { cache: 'no-store' });
  } catch (error) {
    const message = `config.json could not be fetched: ${describeError(error).message ?? 'network error'}`;
    const reference = log.error('config', 'Configuration could not be loaded', {
      reason: 'network',
      message,
    });
    return { status: 'error', reason: 'network', message, reference };
  }

  if (response.status === 404) {
    const message = 'config.json was not found';
    const reference = log.error('config', 'Configuration could not be loaded', {
      reason: 'missing',
      message,
    });
    return { status: 'error', reason: 'missing', message, reference };
  }
  if (!response.ok) {
    const message = `config.json returned ${response.status}`;
    const reference = log.error('config', 'Configuration could not be loaded', {
      reason: 'http',
      message,
    });
    return { status: 'error', reason: 'http', message, reference };
  }

  let raw: unknown;
  try {
    raw = JSON.parse(await response.text());
  } catch {
    const message = 'config.json is not valid JSON';
    const reference = log.error('config', 'Configuration could not be loaded', {
      reason: 'not-json',
      message,
    });
    return { status: 'error', reason: 'not-json', message, reference };
  }

  try {
    const loaded = setAppConfig(raw);
    return { status: 'loaded', config: loaded };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'config.json is invalid';
    const reason: ConfigFailureReason = message.includes('looks like a secret') ? 'secret' : 'invalid';
    const reference = log.error('config', 'Configuration could not be loaded', { reason, message });
    return { status: 'error', reason, message, reference };
  }
}
