import { describe, expect, it } from 'bun:test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createConfig } from '../../../core/config';
import { testEnv } from '../../../../test/helpers/harness';
import { oktaModule } from '../index';
import type { OktaProviderConfig } from '../config';

const REQUIRED = ['OKTA_ISSUER', 'OKTA_CLIENT_ID', 'OKTA_CLIENT_SECRET', 'OKTA_REQUIRED_GROUP', 'OKTA_API_AUDIENCE'];

function loadConfig(env: Record<string, string | undefined>) {
  return createConfig(env, [oktaModule]);
}

describe('Okta config', () => {
  it('does not require Okta variables while disabled', () => {
    const config = loadConfig(testEnv());
    expect(config.providerConfigs.okta).toBeUndefined();
  });

  it('names every missing Okta variable when Okta is enabled', () => {
    let message = '';
    try {
      loadConfig(testEnv({ OKTA_ENABLED: 'true' }));
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }
    for (const name of REQUIRED) expect(message).toContain(name);
  });

  it('never echoes Okta secret values in a validation error', () => {
    let message = '';
    try {
      loadConfig(testEnv({ OKTA_ENABLED: 'true', OKTA_CLIENT_SECRET: 'okta-top-secret' }));
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }
    expect(message).not.toContain('okta-top-secret');
  });

  it('accepts a fully configured Okta provider', () => {
    const config = loadConfig(
      testEnv({
        OKTA_ENABLED: 'true',
        OKTA_ISSUER: 'https://dev-123.okta.com',
        OKTA_CLIENT_ID: 'okta-client',
        OKTA_CLIENT_SECRET: 'okta-secret',
        OKTA_REQUIRED_GROUP: 'Workspace Users',
        OKTA_API_AUDIENCE: 'api://default',
      })
    );
    expect(config.providerConfigs.okta as OktaProviderConfig).toMatchObject({
      issuer: 'https://dev-123.okta.com',
      requiredGroup: 'Workspace Users',
      apiAudience: 'api://default',
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
      const okta = config.providerConfigs.okta as OktaProviderConfig;
      expect(okta.clientPrivateKey).toContain('key-material');
      expect(okta.clientSecret).toBeUndefined();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('names only the variable when OKTA_CLIENT_PRIVATE_KEY_FILE cannot be read', () => {
    let message = '';
    try {
      loadConfig(
        testEnv({
          OKTA_ENABLED: 'true',
          OKTA_ISSUER: 'https://dev-123.okta.com',
          OKTA_CLIENT_ID: 'okta-client',
          OKTA_CLIENT_PRIVATE_KEY_FILE: '/no/such/okta-key.pem',
          OKTA_REQUIRED_GROUP: 'Workspace Users',
          OKTA_API_AUDIENCE: 'api://default',
        })
      );
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }
    expect(message).toContain('OKTA_CLIENT_PRIVATE_KEY_FILE');
  });

  it('does not read OKTA_CLIENT_PRIVATE_KEY_FILE while Okta is disabled', () => {
    const config = loadConfig(
      testEnv({ OKTA_ENABLED: 'false', OKTA_CLIENT_PRIVATE_KEY_FILE: '/no/such/okta-key.pem' })
    );
    expect(config.providerConfigs.okta).toBeUndefined();
  });

  it('builds links only for variables that are set', () => {
    const config = loadConfig(
      testEnv({
        OKTA_ENABLED: 'true',
        OKTA_ISSUER: 'https://dev-123.okta.com',
        OKTA_CLIENT_ID: 'okta-client',
        OKTA_CLIENT_SECRET: 'okta-secret',
        OKTA_REQUIRED_GROUP: 'Workspace Users',
        OKTA_API_AUDIENCE: 'api://default',
        OKTA_FORGOT_PASSWORD_URL: 'https://integrator-3993617.okta.com/signin/forgot-password',
      })
    );
    const okta = config.providerConfigs.okta as OktaProviderConfig;
    expect(okta.links.forgotPasswordUrl).toBe(
      'https://integrator-3993617.okta.com/signin/forgot-password'
    );
    expect(okta.links.changePasswordUrl).toBeUndefined();
  });
});
