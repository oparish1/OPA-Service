import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { createHarness } from './helpers/harness';
import type { Harness } from './helpers/harness';
import { TestIdp } from './helpers/idp';

let entra: TestIdp;
let okta: TestIdp;
let harness: Harness;

beforeEach(async () => {
  entra = new TestIdp({ tenantId: 'tenant-1', clientId: 'client-1' });
  okta = new TestIdp({
    tenantId: 'tenant-1',
    clientId: 'okta-client',
    kind: 'okta',
    apiAudience: 'api://default',
    requiredGroup: 'Workspace User',
  });
  await entra.start();
  await okta.start();
  harness = await createHarness({ idp: entra, oktaIdp: okta });
});

afterEach(async () => {
  await harness.app.close();
  harness.store.close();
  entra.stop();
  okta.stop();
});

function getWithBearer(url: string, token: string) {
  return harness.app.inject({
    method: 'GET',
    url,
    headers: { authorization: `Bearer ${token}` },
  });
}

describe('multi-provider bearer validation (B10, B11, B12)', () => {
  it('accepts an Entra access token from the configured issuer', async () => {
    expect((await getWithBearer('/v1/me', await entra.signAccessToken())).statusCode).toBe(200);
  });

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

  it('rejects an Entra-signed key claiming the Okta issuer', async () => {
    const token = await entra.signAccessToken({ iss: okta.origin, aud: 'api://default' });
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

  it('rejects an Okta token signed by the provider key but claiming Entra issuer', async () => {
    const token = await okta.signAccessToken({ iss: entra.origin });
    expect((await getWithBearer('/v1/me', token)).statusCode).toBe(401);
  });

  it('rejects a Google-shaped token presented as a bearer token', async () => {
    const token = await entra.signAccessToken({ iss: 'https://accounts.google.com', aud: 'google-client' });
    expect((await getWithBearer('/v1/me', token)).statusCode).toBe(401);
  });
});