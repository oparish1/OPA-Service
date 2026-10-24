import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { hashCookieValue } from '../../../core/auth/session';
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

describe('callback refuses a transaction that belongs to another provider', () => {
  it('refuses the callback and attributes the refusal to the route provider', async () => {
    const state = 'cross-provider-state';
    const ltx = 'cross-provider-ltx';
    harness.store.createLoginTransaction({
      state,
      cookieHash: hashCookieValue(ltx),
      nonce: 'custom-nonce',
      codeVerifierEnc: harness.services.cipher.seal('custom-verifier'),
      returnTo: '/',
      createdAt: Date.now(),
      expiresAt: Date.now() + 60_000,
      provider: 'other',
    });
    const response = await harness.app.inject({
      method: 'GET',
      url: `/auth/callback?code=${idp.makeCode('custom-nonce')}&state=${state}`,
      cookies: { [harness.services.session.loginTransactionCookieName()]: ltx },
    });
    expect(response.headers.location).toBe(`${harness.config.publicBaseUrl}/?error=signin`);
    const refused = harness.store
      .listAuditEvents()
      .find(event => event.event === 'login.refused');
    expect(refused?.reason).toBe('provider_mismatch');
    expect(refused?.actorProvider).toBe('entra');
  });
});
