import { describe, expect, it } from 'vitest';
import { AppConfigError, parseAppConfig } from '../../../shared/app-config';

const VALID = {
  gatewayUrl: 'http://localhost:9080',
  providers: [
    {
      id: 'entra',
      name: 'Microsoft Entra ID',
      clientId: 'spa-client-id',
      issuer: 'https://login.microsoftonline.com/tenant/v2.0',
      apiResource: 'api://api-client-id',
      scopes: ['workspace:read'],
      changePasswordUrl: 'https://example.com/change',
    },
  ],
};

describe('parseAppConfig', () => {
  it('accepts a valid config', () => {
    expect(parseAppConfig(VALID)).toMatchObject({ gatewayUrl: 'http://localhost:9080' });
  });

  it('rejects an unknown provider id', () => {
    expect(() =>
      parseAppConfig({ ...VALID, providers: [{ ...VALID.providers[0], id: 'github' }] })
    ).toThrow(AppConfigError);
  });

  it('rejects duplicate provider ids', () => {
    expect(() =>
      parseAppConfig({ ...VALID, providers: [VALID.providers[0], VALID.providers[0]] })
    ).toThrow(/duplicate/);
  });

  it('rejects a non-http gateway URL', () => {
    expect(() => parseAppConfig({ ...VALID, gatewayUrl: 'ftp://example.com' })).toThrow(AppConfigError);
  });

  it('fails on a secret-shaped value (A18)', () => {
    expect(() =>
      parseAppConfig({
        ...VALID,
        providers: [{ ...VALID.providers[0], clientId: 'A'.repeat(48) }],
      })
    ).toThrow(/looks like a secret/);
  });

  it('fails on a client_secret key', () => {
    expect(() => parseAppConfig({ ...VALID, client_secret: 'anything' })).toThrow(/looks like a secret/);
  });
});
