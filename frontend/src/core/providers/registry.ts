import type { FrontendProviderModule, ProviderRegistry } from './types';

/** Freezes an ordered set of modules and resolves each by id; used with fakes in tests. */
export function createProviderRegistry(
  modules: readonly FrontendProviderModule[]
): ProviderRegistry {
  const all = Object.freeze([...modules]);
  const byId = new Map<string, FrontendProviderModule>();
  for (const module of all) {
    if (byId.has(module.id)) throw new Error(`duplicate_provider_id:${module.id}`);
    byId.set(module.id, module);
  }
  return { all, get: id => byId.get(id) };
}
