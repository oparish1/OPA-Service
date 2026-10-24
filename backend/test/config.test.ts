import { describe, expect, it } from 'bun:test';
import { createConfig } from '../src/core/config';
import { testProviderModule } from '../src/core/testing';
import { testEnv } from './helpers/harness';

function config(overrides: Record<string, string | undefined> = {}) {
  return createConfig(testEnv(overrides), [testProviderModule]);
}

describe('createConfig', () => {
  it('fails fast when a required variable is missing', () => {
    const env = testEnv();
    delete env.SESSION_SECRET;
    expect(() => createConfig(env, [testProviderModule])).toThrow(/SESSION_SECRET/);
  });

  it('never echoes secret values in the error message', () => {
    const env = testEnv({ SESSION_SECRET: 'top-secret-value' });
    delete env.TOKEN_ENCRYPTION_KEY;
    let message = '';
    try {
      createConfig(env, [testProviderModule]);
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }
    expect(message).toContain('TOKEN_ENCRYPTION_KEY');
    expect(message).not.toContain('top-secret-value');
  });

  it('refuses the in-memory store in production', () => {
    const env = testEnv({ NODE_ENV: 'production', DATABASE_URL: undefined });
    expect(() => createConfig(env, [testProviderModule])).toThrow(/DATABASE_URL/);
  });

  it('accepts a durable DATABASE_URL in production', () => {
    const env = testEnv({ NODE_ENV: 'production', DATABASE_URL: '/var/lib/identity/store.db' });
    expect(config({ ...env }).databaseUrl).toBe('/var/lib/identity/store.db');
  });

  it('defaults the request-runner allowlist to the public-origin host', () => {
    const built = config({ PUBLIC_BASE_URL: 'http://localhost:3000/' });
    expect(built.requestRunnerAllowedHosts).toEqual(['localhost:3000']);
  });

  it('unions, lowercases and trims REQUEST_RUNNER_ALLOWED_HOSTS entries', () => {
    const built = config({
      PUBLIC_BASE_URL: 'https://app.example',
      REQUEST_RUNNER_ALLOWED_HOSTS: ' API.Example , other.example:8443 ,',
    });
    expect(built.requestRunnerAllowedHosts).toEqual([
      'app.example',
      'api.example',
      'other.example:8443',
    ]);
  });
});
