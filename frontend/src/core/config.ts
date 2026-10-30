import { parseAppConfig } from '../../../shared/app-config';
import type { AppConfig, ProviderConfig } from '../../../shared/app-config';

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
