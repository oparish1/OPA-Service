import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { createHarness } from '../../../../test/helpers/harness';
import type { Harness } from '../../../../test/helpers/harness';
import type { TestIdp } from '../../../core/testing/idp';
import { entraModule } from '../index';
import { createEntraIdp, entraTestEnv } from './idp';

let idp: TestIdp;
let harness: Harness;

beforeEach(async () => {
  idp = createEntraIdp();
  await idp.start();
  harness = await createHarness({ modules: [entraModule], env: entraTestEnv(idp) });
});

afterEach(async () => {
  await harness.app.close();
  harness.store.close();
  idp.stop();
});

function getWithBearer(url: string, token: string) {
  return harness.app.inject({
    method: 'GET',
    url,
    headers: { authorization: `Bearer ${token}` },
  });
}

describe('Entra bearer validation (B10)', () => {
  it('accepts an Entra access token from the configured issuer', async () => {
    expect((await getWithBearer('/v1/me', await idp.signAccessToken())).statusCode).toBe(200);
  });

  it('rejects an Entra-signed token claiming a foreign issuer', async () => {
    const token = await idp.signAccessToken({ iss: 'https://other.example' });
    expect((await getWithBearer('/v1/me', token)).statusCode).toBe(401);
  });

  it('rejects a token signed by a key absent from the published JWKS', async () => {
    const token = await idp.signAccessToken({ __unknownKey: true });
    expect((await getWithBearer('/v1/me', token)).statusCode).toBe(401);
  });

  it('rejects a token from another tenant', async () => {
    const token = await idp.signAccessToken({ tid: 'other-tenant' });
    expect((await getWithBearer('/v1/me', token)).statusCode).toBe(401);
  });
});
