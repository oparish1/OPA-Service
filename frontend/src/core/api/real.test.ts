import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setProviderRegistry } from '../providers/active';
import type { FrontendProviderModule, ProviderAuth, ProviderSession } from '../providers/types';
import { clearSession, getSession, setSessionLimits } from '../session/store';
import { refreshToken, signIn } from './real';

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
  accessToken: { value: 'access-initial', expiresAt: 'soon', scopes: 'workspace:read' },
};

/** A provider whose `session()` tracks whether a renewal has happened. */
function providerModule(): FrontendProviderModule {
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
      return false;
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
    },
    session() {
      return current();
    },
  };
  return {
    id: 'test',
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
  setProviderRegistry([providerModule()]);
});

afterEach(() => {
  clearSession();
  vi.useRealTimers();
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
});
