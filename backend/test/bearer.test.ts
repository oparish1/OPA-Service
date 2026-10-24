import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { createTestHarness } from './helpers/harness';
import type { Harness } from './helpers/harness';
import { createTestIdp } from '../src/core/testing';
import type { TestIdp } from '../src/core/testing';

let idp: TestIdp;
let harness: Harness;

beforeEach(async () => {
  idp = createTestIdp();
  await idp.start();
  harness = await createTestHarness({ idp });
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

describe('bearer validation on /v1/* (A11)', () => {
  it('accepts a correctly scoped access token', async () => {
    const token = await idp.signAccessToken();
    const me = await getWithBearer('/v1/me', token);
    const projects = await getWithBearer('/v1/projects', token);
    expect(me.statusCode).toBe(200);
    expect(projects.statusCode).toBe(200);
    expect(projects.json()).toMatchObject({ projects: expect.any(Array) });
  });

  it('rejects a token for another audience', async () => {
    const token = await idp.signAccessToken({ aud: 'other-api' });
    expect((await getWithBearer('/v1/me', token)).statusCode).toBe(401);
  });

  it('rejects an expired token', async () => {
    const token = await idp.signAccessToken({ exp: Math.floor(Date.now() / 1000) - 30 });
    expect((await getWithBearer('/v1/me', token)).statusCode).toBe(401);
  });

  it('rejects a token signed with an unknown key', async () => {
    const token = await idp.signAccessToken({ __unknownKey: true });
    expect((await getWithBearer('/v1/me', token)).statusCode).toBe(401);
  });

  it('rejects a token missing the route scope', async () => {
    const token = await idp.signAccessToken({ scp: 'profile.read' });
    expect((await getWithBearer('/v1/projects', token)).statusCode).toBe(401);
  });

  it('rejects an unsigned request', async () => {
    expect((await harness.app.inject({ method: 'GET', url: '/v1/me' })).statusCode).toBe(401);
  });
});
