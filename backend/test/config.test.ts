import { describe, expect, it } from 'bun:test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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

  it('does not require Okta or Google variables while they are disabled', () => {
    const config = loadConfig(testEnv());
    expect(config.okta).toBeUndefined();
    expect(config.google).toBeUndefined();
  });

  it('names every missing Okta variable when Okta is enabled', () => {
    const env = testEnv({ OKTA_ENABLED: 'true' });
    let message = '';
    try {
      loadConfig(env);
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }
    for (const name of [
      'OKTA_ISSUER',
      'OKTA_CLIENT_ID',
      'OKTA_CLIENT_SECRET',
      'OKTA_REQUIRED_GROUP',
      'OKTA_API_AUDIENCE',
    ]) {
      expect(message).toContain(name);
    }
  });

  it('names every missing Google variable when Google is enabled', () => {
    const env = testEnv({ GOOGLE_ENABLED: 'true' });
    let message = '';
    try {
      loadConfig(env);
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }
    for (const name of ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_HOSTED_DOMAIN']) {
      expect(message).toContain(name);
    }
  });

  it('never echoes Okta or Google secret values in a validation error', () => {
    const env = testEnv({
      OKTA_ENABLED: 'true',
      OKTA_CLIENT_SECRET: 'okta-top-secret',
      GOOGLE_ENABLED: 'true',
      GOOGLE_CLIENT_SECRET: 'google-top-secret',
    });
    let message = '';
    try {
      loadConfig(env);
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }
    expect(message).not.toContain('okta-top-secret');
    expect(message).not.toContain('google-top-secret');
  });

  it('accepts fully configured Okta and Google providers', () => {
    const config = loadConfig(
      testEnv({
        OKTA_ENABLED: 'true',
        OKTA_ISSUER: 'https://dev-123.okta.com',
        OKTA_CLIENT_ID: 'okta-client',
        OKTA_CLIENT_SECRET: 'okta-secret',
        OKTA_REQUIRED_GROUP: 'Workspace Users',
        OKTA_API_AUDIENCE: 'api://default',
        GOOGLE_ENABLED: 'true',
        GOOGLE_CLIENT_ID: 'google-client',
        GOOGLE_CLIENT_SECRET: 'google-secret',
        GOOGLE_HOSTED_DOMAIN: 'agentic-advantage.example',
      })
    );
    expect(config.okta).toMatchObject({
      issuer: 'https://dev-123.okta.com',
      requiredGroup: 'Workspace Users',
      apiAudience: 'api://default',
    });
    expect(config.google).toMatchObject({
      clientId: 'google-client',
      hostedDomain: 'agentic-advantage.example',
      promptConsent: false,
    });
  });

  it('accepts OKTA_CLIENT_PRIVATE_KEY_FILE as the Okta credential and reads it', () => {
    const dir = mkdtempSync(join(tmpdir(), 'archon-okta-key-'));
    const keyPath = join(dir, 'okta.pem');
    writeFileSync(keyPath, '-----BEGIN PRIVATE KEY-----\nkey-material\n-----END PRIVATE KEY-----');
    try {
      const config = loadConfig(
        testEnv({
          OKTA_ENABLED: 'true',
          OKTA_ISSUER: 'https://dev-123.okta.com',
          OKTA_CLIENT_ID: 'okta-client',
          OKTA_CLIENT_PRIVATE_KEY_FILE: keyPath,
          OKTA_REQUIRED_GROUP: 'Workspace Users',
          OKTA_API_AUDIENCE: 'api://default',
        })
      );
      expect(config.okta?.clientPrivateKey).toContain('key-material');
      expect(config.okta?.clientSecret).toBeUndefined();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('names only the variable when OKTA_CLIENT_PRIVATE_KEY_FILE cannot be read', () => {
    const env = testEnv({
      OKTA_ENABLED: 'true',
      OKTA_ISSUER: 'https://dev-123.okta.com',
      OKTA_CLIENT_ID: 'okta-client',
      OKTA_CLIENT_PRIVATE_KEY_FILE: '/no/such/okta-key.pem',
      OKTA_REQUIRED_GROUP: 'Workspace Users',
      OKTA_API_AUDIENCE: 'api://default',
    });
    let message = '';
    try {
      loadConfig(env);
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }
    expect(message).toContain('OKTA_CLIENT_PRIVATE_KEY_FILE');
  });

  it('does not read OKTA_CLIENT_PRIVATE_KEY_FILE while Okta is disabled', () => {
    const config = loadConfig(
      testEnv({ OKTA_ENABLED: 'false', OKTA_CLIENT_PRIVATE_KEY_FILE: '/no/such/okta-key.pem' })
    );
    expect(config.okta).toBeUndefined();
  });

  it('builds provider links only for variables that are set', () => {
    const config = loadConfig(
      testEnv({
        OKTA_FORGOT_PASSWORD_URL: 'https://integrator-3993617.okta.com/signin/forgot-password',
        GOOGLE_MANAGE_ACCOUNT_URL: 'https://myaccount.google.com/',
      })
    );
    expect(config.providerLinks.okta.forgotPasswordUrl).toBe(
      'https://integrator-3993617.okta.com/signin/forgot-password'
    );
    expect(config.providerLinks.okta.changePasswordUrl).toBeUndefined();
    expect(config.providerLinks.google.manageAccountUrl).toBe('https://myaccount.google.com/');
    expect(config.providerLinks.entra.forgotPasswordUrl).toBeUndefined();
  });

  it('defaults the Google issuer to accounts.google.com and accepts an override', () => {
    const base = loadConfig(
      testEnv({
        GOOGLE_ENABLED: 'true',
        GOOGLE_CLIENT_ID: 'google-client',
        GOOGLE_CLIENT_SECRET: 'google-secret',
        GOOGLE_HOSTED_DOMAIN: 'agentic-advantage.example',
      })
    );
    expect(base.google?.issuer).toBe('https://accounts.google.com');
    const overridden = loadConfig(
      testEnv({
        GOOGLE_ENABLED: 'true',
        GOOGLE_CLIENT_ID: 'google-client',
        GOOGLE_CLIENT_SECRET: 'google-secret',
        GOOGLE_HOSTED_DOMAIN: 'agentic-advantage.example',
        GOOGLE_ISSUER: 'http://127.0.0.1:9999',
      })
    );
    expect(overridden.google?.issuer).toBe('http://127.0.0.1:9999');
  });

  it('refuses the in-memory store in production', () => {
    const env = testEnv({ NODE_ENV: 'production', DATABASE_URL: undefined });
    expect(() => loadConfig(env)).toThrow(/DATABASE_URL/);
  });

  it('accepts a durable DATABASE_URL in production', () => {
    const env = testEnv({ NODE_ENV: 'production', DATABASE_URL: '/var/lib/identity/store.db' });
    expect(loadConfig(env).databaseUrl).toBe('/var/lib/identity/store.db');
  });

  it('defaults the request-runner allowlist to the public-origin host', () => {
    const config = loadConfig(testEnv({ PUBLIC_BASE_URL: 'http://localhost:3000/' }));
    expect(config.requestRunnerAllowedHosts).toEqual(['localhost:3000']);
  });

  it('unions, lowercases and trims REQUEST_RUNNER_ALLOWED_HOSTS entries', () => {
    const config = loadConfig(
      testEnv({
        PUBLIC_BASE_URL: 'https://app.example',
        REQUEST_RUNNER_ALLOWED_HOSTS: ' API.Example , other.example:8443 ,',
      })
    );
    expect(config.requestRunnerAllowedHosts).toEqual([
      'app.example',
      'api.example',
      'other.example:8443',
    ]);
  });
});
