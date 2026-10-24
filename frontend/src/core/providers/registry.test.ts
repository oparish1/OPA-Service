import { describe, expect, it } from 'vitest';
import { createProviderRegistry } from './registry';
import type { FrontendProviderModule } from './types';

function fakeModule(id: string): FrontendProviderModule {
  return {
    id,
    name: `Provider ${id}`,
    ssoDomain: `${id}.example`,
    links: {},
    renderIcon: () => null,
  };
}

describe('createProviderRegistry', () => {
  it('freezes the ordered list and resolves each provider by id', () => {
    const registry = createProviderRegistry([fakeModule('alpha'), fakeModule('beta')]);
    expect(registry.all.map(module => module.id)).toEqual(['alpha', 'beta']);
    expect(Object.isFrozen(registry.all)).toBe(true);
    expect(registry.get('beta')?.id).toBe('beta');
    expect(registry.get('missing')).toBeUndefined();
  });

  it('rejects duplicate ids', () => {
    expect(() => createProviderRegistry([fakeModule('alpha'), fakeModule('alpha')])).toThrow(
      /duplicate_provider_id/
    );
  });
});
