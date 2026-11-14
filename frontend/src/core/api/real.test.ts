import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { capabilitiesWith } from '../authz/testing';
import { setAppConfig } from '../config';
import { setProviderRegistry } from '../providers/active';
import type { FrontendProviderModule, ProviderAuth, ProviderSession } from '../providers/types';
import {
  ABSOLUTE_LIMIT_MS,
  IDLE_LIMIT_MS,
  clearSession,
  getSession,
  setOnExpire,
  setSessionLimits,
} from '../session/store';
import { handleRedirect, refreshToken, signIn, signOut } from './real';

const PROVIDER_SESSION: ProviderSession = {
  providerId: 'test',
  providerName: 'Test Provider',
  issuer: 'https://issuer.example',
  account: {
    displayName: 'Test User',
    email: 'test@example.com',
    organisation: 'Test Org',
    role: 'developer',
    accountId: 'subject-1',
    createdAt: '—',
  },
  rawClaims: {},
  accessToken: { value: 'access-initial', expiresAt: 'soon', scopes: 'workspace:read' },
};

/** A provider whose `session()` tracks whether a renewal has happened. */
function providerModule(
  onSignOut: () => void = () => undefined,
  overrides: Partial<ProviderAuth> = {},
  id = 'test'
): FrontendProviderModule {
  let renewed = false;
  const current = (): ProviderSession => ({
    ...PROVIDER_SESSION,
    accessToken: {
      ...PROVIDER_SESSION.accessToken,
      value: renewed ? 'access-renewed' : 'access-initial',
    },
  });
  const auth: ProviderAuth = {
    async signIn() {
      renewed = false;
    },
    async handleRedirect() {
      return 'ignored';
    },
    async getAccessToken() {
      return current().accessToken.value;
    },
    async renew() {
      renewed = true;
      return true;
    },
    async signOut() {
      renewed = false;
      onSignOut();
    },
    session() {
      return current();
    },
    ...overrides,
  };
  return {
    id,
    name: 'Test Provider',
    ssoDomain: 'test.example',
    links: {
      forgotPasswordUrl: 'https://example.com/reset',
      changePasswordUrl: 'https://example.com/change',
      manageAccountUrl: 'https://example.com/manage',
    },
    renderIcon: () => null,
    auth,
  };
}

beforeEach(() => {
  clearSession();
  setOnExpire(null);
  setSessionLimits({ idleMs: IDLE_LIMIT_MS, absoluteMs: ABSOLUTE_LIMIT_MS });
  setProviderRegistry([providerModule()]);
});

afterEach(() => {
  clearSession();
  setOnExpire(null);
  setSessionLimits({ idleMs: IDLE_LIMIT_MS, absoluteMs: ABSOLUTE_LIMIT_MS });
  vi.useRealTimers();
  vi.unstubAllGlobals();
  // The config store is process-wide; leave it disabled so no other test in this
  // file reaches the network through the capability refresh.
  setAppConfig({
    gatewayUrl: 'https://localhost:9080',
    authz: { enabled: false },
    providers: [
      { id: 'entra', name: 'Entra', clientId: 'client-id', issuer: 'https://issuer.example' },
    ],
  });
});

describe('real API seam', () => {
  it('resolves and adopts the provider session after a non-redirect sign-in (A2, A3)', async () => {
    await signIn('test');

    expect(getSession()?.providerId).toBe('test');
    expect(getSession()?.accessToken.value).toBe('access-initial');
  });

  it('keeps the absolute deadline when a renewal replaces the tokens (A7)', async () => {
    vi.useFakeTimers();
    setSessionLimits({ idleMs: 30 * 60 * 1000, absoluteMs: 60_000 });

    await signIn('test');
    vi.advanceTimersByTime(50_000);
    await refreshToken();
    expect(getSession()?.accessToken.value).toBe('access-renewed');

    vi.advanceTimersByTime(9_999);
    expect(getSession()).not.toBeNull();
    vi.advanceTimersByTime(1);
    expect(getSession()).toBeNull();
  });

  it('refetches capabilities with the renewed token after a renewal (I1)', async () => {
    setAppConfig({
      gatewayUrl: 'https://localhost:9080',
      authz: { enabled: true },
      providers: [
        { id: 'entra', name: 'Entra', clientId: 'client-id', issuer: 'https://issuer.example' },
      ],
    });
    const calls: Array<{ url: string; authorization?: string }> = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
        calls.push({
          url: String(url),
          authorization: (init?.headers as Record<string, string> | undefined)?.authorization,
        });
        return { ok: true, status: 200, json: async () => capabilitiesWith({}) } as Response;
      })
    );

    await signIn('test');
    await refreshToken();

    expect(calls.map(call => call.authorization)).toEqual([
      'Bearer access-initial',
      'Bearer access-renewed',
    ]);
    expect(calls[1]?.url).toBe('https://localhost:9080/test/authz/capabilities');
  });

  it('signs the provider out and clears the store on expiry (A7, SD-5)', async () => {
    vi.useFakeTimers();
    const providerSignOut = vi.fn();
    setProviderRegistry([providerModule(providerSignOut)]);
    setSessionLimits({ idleMs: 1000, absoluteMs: 100_000 });
    setOnExpire(() => {
      void signOut();
    });

    await signIn('test');
    expect(getSession()).not.toBeNull();

    vi.advanceTimersByTime(1000);
    expect(providerSignOut).toHaveBeenCalledOnce();
    expect(getSession()).toBeNull();
  });

  it('skips a provider that cannot initialize instead of aborting the callback (R8)', async () => {
    const broken = providerModule(
      undefined,
      {
        async handleRedirect() {
          throw new Error('Entra is not configured');
        },
      },
      'broken'
    );
    const target = providerModule(
      undefined,
      {
        async handleRedirect() {
          return 'handled';
        },
        session() {
          return { ...PROVIDER_SESSION, providerId: 'target' };
        },
      },
      'target'
    );
    setProviderRegistry([broken, target]);

    const outcome = await handleRedirect(new URL('https://localhost:5173/?code=abc&state=xyz'));

    expect(outcome).toBe('handled');
    expect(getSession()?.providerId).toBe('target');
  });

  it('does not let a provider that rejects a callback abort one that handles it (R14)', async () => {
    const rejecting = providerModule(
      undefined,
      {
        async handleRedirect() {
          return 'rejected';
        },
      },
      'broken'
    );
    const target = providerModule(
      undefined,
      {
        async handleRedirect() {
          return 'handled';
        },
        session() {
          return { ...PROVIDER_SESSION, providerId: 'target' };
        },
      },
      'target'
    );
    setProviderRegistry([rejecting, target]);

    const outcome = await handleRedirect(new URL('https://localhost:5173/?code=abc&state=xyz'));

    expect(outcome).toBe('handled');
    expect(getSession()?.providerId).toBe('target');
  });

  it('reports a rejected callback distinctly from an unrelated one (R9)', async () => {
    const rejecting = providerModule(undefined, {
      async handleRedirect() {
        return 'rejected';
      },
    });
    setProviderRegistry([rejecting]);

    await expect(handleRedirect(new URL('https://localhost:5173/?code=abc&state=xyz'))).resolves.toBe(
      'rejected'
    );
    expect(getSession()).toBeNull();

    setProviderRegistry([providerModule()]);
    await expect(handleRedirect(new URL('https://localhost:5173/'))).resolves.toBe('ignored');
  });
});
