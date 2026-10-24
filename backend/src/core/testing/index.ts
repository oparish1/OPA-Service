import { z } from 'zod';
import { BearerValidator } from '../auth/bearer';
import { OidcError, OidcService } from '../auth/oidc';
import { firstString, optionalUrl } from '../provider';
import type { ProviderDefinition, ProviderEnv, ProviderModule, ProviderRequirement } from '../provider';
import { TestIdp } from './idp';
import { neutralIdpProfile } from './neutral-claims';

export type { IdpProfile, TokenBehavior } from './idp';
export { TestIdp } from './idp';
export { neutralIdpProfile } from './neutral-claims';

interface TestProviderConfig {
  issuer: string;
  clientId: string;
  clientSecret: string;
}

const envShape = {
  TEST_ISSUER: optionalUrl,
  TEST_CLIENT_ID: z.string().min(1).optional(),
  TEST_CLIENT_SECRET: z.string().min(1).optional(),
};

function parse(env: ProviderEnv): TestProviderConfig {
  return Object.freeze({
    issuer: firstString(env.TEST_ISSUER),
    clientId: firstString(env.TEST_CLIENT_ID) || 'test-client',
    clientSecret: firstString(env.TEST_CLIENT_SECRET) || 'test-secret',
  });
}

function createDefinition(
  config: Parameters<ProviderModule['createDefinition']>[0],
  providerConfig: unknown
): ProviderDefinition {
  const test = providerConfig as TestProviderConfig;
  const oidc = new OidcService({
    issuer: test.issuer,
    clientId: test.clientId,
    clientSecret: test.clientSecret,
    publicBaseUrl: config.publicBaseUrl,
    allowInsecureIssuer: config.allowInsecureIssuer,
    callbackPath: '/auth/callback',
    scopes: ['openid', 'profile', 'email', 'offline_access'],
    refreshTokenLifetimeMs: null,
    endSession: false,
  });
  const bearer = new BearerValidator({
    issuer: test.issuer,
    audience: test.clientId,
    subjectClaim: 'sub',
  });
  return {
    id: 'test',
    name: 'Test Provider',
    issuer: test.issuer,
    loginPath: '/auth/login',
    callbackPath: '/auth/callback',
    refreshExpiry: 'fixed',
    refreshGrant: 'Rotating refresh token',
    links: {},
    oidc,
    bearer,
    gate(claims) {
      if (!firstString(claims.sub)) {
        throw new OidcError('Missing subject', 'missing_subject');
      }
    },
    subject(claims) {
      return firstString(claims.sub);
    },
    profile(claims) {
      return {
        email: firstString(claims.email),
        displayName: firstString(claims.name),
        organisation: firstString(claims.org),
      };
    },
  };
}

const noRequirements = (): ReadonlyArray<ProviderRequirement> => [];

/** A provider-neutral module for core tests and harnesses; never in the production registry. */
export const testProviderModule: ProviderModule = {
  id: 'test',
  envShape,
  enabled: () => true,
  requirements: noRequirements,
  parse,
  createDefinition,
};

export function createTestIdp(): TestIdp {
  return new TestIdp({ tenantId: 'test-tenant', clientId: 'test-client', profile: neutralIdpProfile });
}

export function testProviderEnv(idp: TestIdp): Record<string, string | undefined> {
  return {
    TEST_ISSUER: idp.origin,
    TEST_CLIENT_ID: idp.clientId,
    TEST_CLIENT_SECRET: 'test-secret',
  };
}
