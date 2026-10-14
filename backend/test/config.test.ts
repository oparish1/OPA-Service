import { describe, expect, it } from 'bun:test';
import { loadConfig } from '../src/config';
import { testEnv } from './helpers/harness';

describe('loadConfig', () => {
  it('fails fast when a required variable is missing', () => {
    const env = testEnv();
    delete env.SESSION_SECRET;
    expect(() => loadConfig(env)).toThrow(/SESSION_SECRET/);
  });

  it('fails when no client credential is supplied', () => {
    const env = testEnv({ ENTRA_CLIENT_SECRET: undefined });
    expect(() => loadConfig(env)).toThrow(/ENTRA_CLIENT_SECRET/);
  });

  it('never echoes secret values in the error message', () => {
    const env = testEnv({ SESSION_SECRET: 'top-secret-value', ENTRA_TENANT_ID: undefined });
    let message = '';
    try {
      loadConfig(env);
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }
    expect(message).toContain('ENTRA_TENANT_ID');
    expect(message).not.toContain('top-secret-value');
  });

  it('defaults the issuer from the tenant and the api audience from the client', () => {
    const config = loadConfig(testEnv());
    expect(config.issuer).toBe('https://login.microsoftonline.com/tenant-1/v2.0');
    expect(config.apiClientId).toBe('client-1');
    expect(config.cookieSecure).toBe(false);
  });

  it('refuses the in-memory store in production', () => {
    const env = testEnv({ NODE_ENV: 'production', DATABASE_URL: undefined });
    expect(() => loadConfig(env)).toThrow(/DATABASE_URL/);
  });

  it('accepts a durable DATABASE_URL in production', () => {
    const env = testEnv({ NODE_ENV: 'production', DATABASE_URL: '/var/lib/identity/store.db' });
    expect(loadConfig(env).databaseUrl).toBe('/var/lib/identity/store.db');
  });
});
