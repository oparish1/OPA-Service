import { describe, expect, it } from 'bun:test';
import { createConfig } from '../../../core/config';
import { testEnv } from '../../../../test/helpers/harness';
import { googleModule } from '../index';
import type { GoogleProviderConfig } from '../config';

function loadConfig(env: Record<string, string | undefined>) {
  return createConfig(env, [googleModule]);
}

function googleConfig(overrides: Record<string, string | undefined> = {}): GoogleProviderConfig {
  const config = loadConfig(
    testEnv({
      GOOGLE_ENABLED: 'true',
      GOOGLE_CLIENT_ID: 'google-client',
      GOOGLE_CLIENT_SECRET: 'google-secret',
      GOOGLE_HOSTED_DOMAIN: 'agentic-advantage.example',
      ...overrides,
    })
  );
  return config.providerConfigs.google as GoogleProviderConfig;
}

describe('Google config', () => {
  it('does not require Google variables while disabled', () => {
    expect(loadConfig(testEnv()).providerConfigs.google).toBeUndefined();
  });

  it('names every missing Google variable when Google is enabled', () => {
    let message = '';
    try {
      loadConfig(testEnv({ GOOGLE_ENABLED: 'true' }));
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }
    for (const name of ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_HOSTED_DOMAIN']) {
      expect(message).toContain(name);
    }
  });

  it('never echoes Google secret values in a validation error', () => {
    let message = '';
    try {
      loadConfig(testEnv({ GOOGLE_ENABLED: 'true', GOOGLE_CLIENT_SECRET: 'google-top-secret' }));
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }
    expect(message).not.toContain('google-top-secret');
  });

  it('accepts a fully configured Google provider', () => {
    expect(googleConfig()).toMatchObject({
      clientId: 'google-client',
      hostedDomain: 'agentic-advantage.example',
      promptConsent: false,
    });
  });

  it('defaults the issuer to accounts.google.com and accepts an override', () => {
    expect(googleConfig().issuer).toBe('https://accounts.google.com');
    expect(googleConfig({ GOOGLE_ISSUER: 'http://127.0.0.1:9999' }).issuer).toBe(
      'http://127.0.0.1:9999'
    );
  });

  it('treats an empty optional URL variable as unset', () => {
    const config = loadConfig(
      testEnv({
        GOOGLE_ENABLED: 'true',
        GOOGLE_CLIENT_ID: 'google-client',
        GOOGLE_CLIENT_SECRET: 'google-secret',
        GOOGLE_HOSTED_DOMAIN: 'agentic-advantage.example',
        GOOGLE_ISSUER: '',
      })
    );
    expect(config.providerConfigs.google).toBeDefined();
  });

  it('builds links only for variables that are set', () => {
    const config = googleConfig({ GOOGLE_MANAGE_ACCOUNT_URL: 'https://myaccount.google.com/' });
    expect(config.links.manageAccountUrl).toBe('https://myaccount.google.com/');
    expect(config.links.forgotPasswordUrl).toBeUndefined();
  });
});
