import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { createTestHarness } from '../../../../test/helpers/harness';
import type { Harness } from '../../../../test/helpers/harness';
import { createTestIdp } from '../../../core/testing';
import type { TestIdp } from '../../../core/testing';
import { oktaModule } from '../index';
import { createOktaIdp, oktaTestEnv } from './idp';

let neutral: TestIdp;
let okta: TestIdp;
let harness: Harness;

beforeEach(async () => {
  neutral = createTestIdp();
  okta = createOktaIdp();
  await neutral.start();
  await okta.start();
  harness = await createTestHarness({
    idp: neutral,
    extraModules: [oktaModule],
    env: oktaTestEnv(okta),
  });
});

afterEach(async () => {
  await harness.app.close();
  harness.store.close();
  neutral.stop();
  okta.stop();
});

function getWithBearer(url: string, token: string) {
  return harness.app.inject({
    method: 'GET',
    url,
    headers: { authorization: `Bearer ${token}` },
  });
}

describe('Okta bearer validation (B11, B12)', () => {
  it('accepts an Okta default-AS token and resolves it by uid', async () => {
    const token = await okta.signAccessToken();
    const response = await getWithBearer('/v1/me', token);
    expect(response.statusCode).toBe(200);
    expect((response.json() as { id: string }).id).toBe('usr_okta-uid-1');
  });

  it('rejects an Okta token with a wrong audience', async () => {
    const token = await okta.signAccessToken({ aud: 'api://other' });
    expect((await getWithBearer('/v1/me', token)).statusCode).toBe(401);
  });

  it('rejects an expired Okta token', async () => {
    const token = await okta.signAccessToken({ exp: Math.floor(Date.now() / 1000) - 3600 });
    expect((await getWithBearer('/v1/me', token)).statusCode).toBe(401);
  });

  it('rejects an Okta token signed by an unknown key', async () => {
    const token = await okta.signAccessToken({ __unknownKey: true });
    expect((await getWithBearer('/v1/me', token)).statusCode).toBe(401);
  });

  it('rejects an Okta org-authorization-server token (issuer other than the configured default AS)', async () => {
    const token = await okta.signAccessToken({ iss: 'https://integrator-3993617.okta.com' });
    expect((await getWithBearer('/v1/me', token)).statusCode).toBe(401);
  });

  it('rejects an Okta token without a uid claim', async () => {
    const token = await okta.signAccessToken({ uid: undefined });
    expect((await getWithBearer('/v1/me', token)).statusCode).toBe(401);
  });

  it('rejects an Okta token signed by the provider key but claiming the neutral test issuer', async () => {
    const token = await okta.signAccessToken({ iss: neutral.origin });
    expect((await getWithBearer('/v1/me', token)).statusCode).toBe(401);
  });
});
