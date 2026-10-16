import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { createHarness } from './helpers/harness';
import type { Harness } from './helpers/harness';
import { TestIdp } from './helpers/idp';

let idp: TestIdp;
let harness: Harness;

beforeEach(async () => {
  idp = new TestIdp({ tenantId: 'tenant-1', clientId: 'client-1' });
  await idp.start();
  harness = await createHarness({ idp });
});

afterEach(async () => {
  await harness.app.close();
  harness.store.close();
  idp.stop();
});

async function getWithBearer(url: string, token: string) {
  return harness.app.inject({
    method: 'GET',
    url,
    headers: { authorization: `Bearer ${token}` },
  });
}

describe('multi-provider bearer validation (B11, B12)', () => {
  it('accepts an access token from the configured issuer', async () => {
    const token = await idp.signAccessToken();
    expect((await getWithBearer('/v1/me', token)).statusCode).toBe(200);
  });

  it('rejects a token signed by the provider key but claiming another issuer', async () => {
    const token = await idp.signAccessToken({ iss: 'https://dev-123.okta.com/oauth2/default' });
    expect((await getWithBearer('/v1/me', token)).statusCode).toBe(401);
  });

  it('rejects a Google-shaped token presented as a bearer token', async () => {
    const token = await idp.signAccessToken({ iss: 'https://accounts.google.com', aud: 'google-client' });
    expect((await getWithBearer('/v1/me', token)).statusCode).toBe(401);
  });
});
