import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { completeLogin, createHarness } from '../../../../test/helpers/harness';
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

function refuseCount(): number {
  return harness.store.listAuditEvents().filter(event => event.event === 'login.refused').length;
}

describe('Entra callback gating (A3, A4)', () => {
  it('refuses a valid token without the required app role and creates no user', async () => {
    idp.behavior.claims = { roles: ['SomeOther.Role'] };
    const { response } = await completeLogin(harness.app, idp);
    expect(response.headers.location).toBe(`${harness.config.publicBaseUrl}/?error=signin`);
    expect(harness.store.countUsers()).toBe(0);
    expect(refuseCount()).toBe(1);
  });

  it('refuses a token from another tenant and creates no user', async () => {
    idp.behavior.claims = { tid: 'other-tenant' };
    const { response } = await completeLogin(harness.app, idp);
    expect(response.headers.location).toBe(`${harness.config.publicBaseUrl}/?error=signin`);
    expect(harness.store.countUsers()).toBe(0);
    expect(refuseCount()).toBe(1);
  });
});
