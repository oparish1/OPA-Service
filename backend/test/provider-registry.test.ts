import { describe, expect, it } from 'bun:test';
import { createConfig } from '../src/core/config';
import { buildProviderRegistry, composeProviderRegistry } from '../src/core/provider';
import type { ProviderDefinition, ProviderModule } from '../src/core/provider';
import { testEnv } from './helpers/harness';

function fakeDefinition(id: string): ProviderDefinition {
  return {
    id,
    name: `Provider ${id}`,
    issuer: 'https://issuer.example',
    loginPath: `/auth/login/${id}`,
    callbackPath: `/auth/callback/${id}`,
    refreshExpiry: 'fixed',
    refreshGrant: '',
    links: {},
    oidc: {
      init: async () => undefined,
      jwksUri: () => null,
    } as unknown as ProviderDefinition['oidc'],
    bearer: null,
    accountId: () => '',
    findUser: () => null,
    gate: () => undefined,
    subject: () => '',
    profile: () => ({ email: '', displayName: '', organisation: '' }),
  };
}

function fakeModule(id: string): ProviderModule {
  return {
    id,
    envShape: {},
    enabled: () => true,
    requirements: () => [],
    parse: () => ({}),
    createDefinition: () => fakeDefinition(id),
  };
}

describe('composeProviderRegistry', () => {
  it('freezes the ordered list and resolves each provider by id', () => {
    const registry = composeProviderRegistry([fakeDefinition('alpha'), fakeDefinition('beta')]);
    expect(registry.all.map(provider => provider.id)).toEqual(['alpha', 'beta']);
    expect(Object.isFrozen(registry.all)).toBe(true);
    expect(registry.get('beta')?.id).toBe('beta');
    expect(registry.get('missing')).toBeUndefined();
  });

  it('rejects duplicate ids', () => {
    expect(() => composeProviderRegistry([fakeDefinition('alpha'), fakeDefinition('alpha')])).toThrow(
      /duplicate_provider_id/
    );
  });

  it('refuses to name a default when no provider is composed', () => {
    expect(() => composeProviderRegistry([]).default()).toThrow(/provider_registry_empty/);
  });
});

describe('buildProviderRegistry', () => {
  it('builds only enabled modules, in module order', async () => {
    const enabled = fakeModule('alpha');
    const disabled: ProviderModule = { ...fakeModule('beta'), enabled: () => false };
    const config = createConfig(testEnv(), [enabled, disabled]);
    const registry = await buildProviderRegistry(config, [enabled, disabled]);
    expect(registry.all.map(provider => provider.id)).toEqual(['alpha']);
  });
});
