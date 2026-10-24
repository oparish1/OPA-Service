import { createProviderRegistry } from './registry';
import type { FrontendProviderModule, ProviderRegistry } from './types';

/**
 * The active frontend registry. Core code never imports the production registry;
 * the app entry point installs it and tests install the neutral test provider,
 * so core screens and mocks stay provider-independent.
 */
let registry: ProviderRegistry = createProviderRegistry([]);

export function setProviderRegistry(modules: readonly FrontendProviderModule[]): void {
  registry = createProviderRegistry(modules);
}

export function getProviderRegistry(): ProviderRegistry {
  return registry;
}
