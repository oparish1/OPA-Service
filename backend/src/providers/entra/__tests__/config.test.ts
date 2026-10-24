import { describe, expect, it } from 'bun:test';
import { createConfig } from '../../../core/config';
import { testEnv } from '../../../../test/helpers/harness';
import { entraModule } from '../index';
import type { EntraProviderConfig } from '../config';

const VALID = {
  ENTRA_TENANT_ID: 'tenant-1',
  ENTRA_CLIENT_ID: 'client-1',
  ENTRA_CLIENT_SECRET: 'secret-1',
};

function entraConfig(overrides: Record<string, string | undefined> = {}): EntraProviderConfig {
  const config = createConfig(testEnv({ ...VALID, ...overrides }), [entraModule]);
  return config.providerConfigs.entra as EntraProviderConfig;
}

describe('Entra config', () => {
  it('fails when no client credential is supplied', () => {
    const env = testEnv({ ...VALID, ENTRA_CLIENT_SECRET: undefined });
    expect(() => createConfig(env, [entraModule])).toThrow(/ENTRA_CLIENT_SECRET/);
  });

  it('defaults the issuer from the tenant and the api audience from the client', () => {
    const config = entraConfig();
    expect(config.issuer).toBe('https://login.microsoftonline.com/tenant-1/v2.0');
    expect(config.apiClientId).toBe('client-1');
  });

  it('accepts an explicit issuer and API client id', () => {
    const config = entraConfig({
      ENTRA_ISSUER: 'https://login.microsoftonline.com/tenant-2/v2.0',
      ENTRA_API_CLIENT_ID: 'api-client',
    });
    expect(config.issuer).toBe('https://login.microsoftonline.com/tenant-2/v2.0');
    expect(config.apiClientId).toBe('api-client');
  });

  it('builds links only for variables that are set', () => {
    expect(entraConfig().links.forgotPasswordUrl).toBeUndefined();
  });

  it('treats an empty optional URL variable as unset', () => {
    const config = entraConfig({ ENTRA_FORGOT_PASSWORD_URL: '' });
    expect(config.links.forgotPasswordUrl).toBeUndefined();
  });

  it('exposes a configured link', () => {
    const config = entraConfig({ ENTRA_MANAGE_ACCOUNT_URL: 'https://example.com/manage' });
    expect(config.links.manageAccountUrl).toBe('https://example.com/manage');
  });
});
