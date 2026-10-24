import { createConfig } from '../core/config';
import type { AppConfig } from '../core/config';
import type { ProviderModule } from '../core/provider';
import { entraModule } from './entra';
import { googleModule } from './google';
import { oktaModule } from './okta';

/** The composition point: the only file outside `shared/` that names every provider. */
export const PROVIDER_MODULES: readonly ProviderModule[] = [
  entraModule,
  oktaModule,
  googleModule,
];

export function loadConfig(env: Record<string, string | undefined> = process.env): AppConfig {
  return createConfig(env, PROVIDER_MODULES);
}
