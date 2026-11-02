import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setAppConfig } from '../../../core/config';
import { log } from '../../../core/lib/log';
import { createOktaAuth } from '../auth';

interface MockGlobal {
  __lastSignIn?: { scopes: string[] };
  __oktaTokens?: Record<string, unknown>;
  __oktaPendingReject?: Error;
  __oktaRenewReject?: Error;
  __oktaCleared?: boolean;
  __oktaInitReject?: Error;
  __oktaOptions?: { tokenManager?: { storage?: string } };
}

const globalMock = globalThis as unknown as MockGlobal;

vi.mock('@okta/okta-auth-js', () => {
  class OktaAuth {
    options: unknown;
    store: Record<string, unknown> = {};
    tokenManager = {
      get: async (key: string): Promise<unknown> => this.store[key],
      renew: async (key: string): Promise<unknown> => {
        const pending = (globalThis as unknown as MockGlobal).__oktaRenewReject;
        if (pending) throw pending;
        return this.store[key];
      },
      clear: (): void => {
        (globalThis as unknown as MockGlobal).__oktaCleared = true;
        this.store = {};
      },
    };

    constructor(options: unknown) {
      const pending = (globalThis as unknown as MockGlobal).__oktaInitReject;
      if (pending) throw pending;
      this.options = options;
      (globalThis as unknown as MockGlobal).__oktaOptions = options as MockGlobal['__oktaOptions'];
    }

    async signInWithRedirect(options: { scopes: string[] }): Promise<void> {
      (globalThis as unknown as MockGlobal).__lastSignIn = options;
    }

    async handleLoginRedirect(): Promise<void> {
      const pending = (globalThis as unknown as MockGlobal).__oktaPendingReject;
      if (pending) throw pending;
      const tokens = (globalThis as unknown as MockGlobal).__oktaTokens;
      if (tokens) this.store = tokens;
    }

    async getOrRenewAccessToken(): Promise<string | null> {
      const access = this.store.accessToken as { accessToken?: string } | undefined;
      return access?.accessToken ?? null;
    }
  }
  const isAccessToken = (token: unknown): boolean =>
    typeof token === 'object' && token !== null && typeof (token as { accessToken?: unknown }).accessToken === 'string';
  const isIDToken = (token: unknown): boolean =>
    typeof token === 'object' && token !== null && typeof (token as { idToken?: unknown }).idToken === 'string';
  const isRefreshToken = (token: unknown): boolean =>
    typeof token === 'object' && token !== null && typeof (token as { refreshToken?: unknown }).refreshToken === 'string';
  return { OktaAuth, isAccessToken, isIDToken, isRefreshToken };
});

const AUTH = createOktaAuth();

const ACCESS = {
  accessToken: 'okta-access-value',
  expiresAt: 2000000000,
  scopes: ['workspace:read'],
  claims: {
    iss: 'https://dev-1.okta.example/oauth2/default',
    sub: 'okta-sub-1',
    uid: 'okta-uid-1',
    email: 'okta.user@agentic-advantage.example',
    name: 'Okta Test User',
    groups: ['Workspace User'],
  },
};
const ID = { idToken: 'okta-id', expiresAt: 2000000000, scopes: ['openid'], claims: { sub: 'okta-sub-1' } };

beforeEach(async () => {
  setAppConfig({
    gatewayUrl: 'http://localhost:9080',
    providers: [
      {
        id: 'okta',
        name: 'Okta',
        clientId: 'okta-client-id',
        issuer: 'https://dev-1.okta.example/oauth2/default',
        scopes: ['workspace:read'],
      },
    ],
  });
  globalMock.__lastSignIn = undefined;
  globalMock.__oktaTokens = undefined;
  globalMock.__oktaPendingReject = undefined;
  globalMock.__oktaRenewReject = undefined;
  globalMock.__oktaCleared = false;
  globalMock.__oktaInitReject = undefined;
  log.clear();
  vi.spyOn(console, 'debug').mockImplementation(() => undefined);
  vi.spyOn(console, 'info').mockImplementation(() => undefined);
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  await AUTH.signOut();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Okta auth', () => {
  it('starts a PKCE redirect with the workspace scope (A1)', async () => {
    await AUTH.signIn();
    expect(globalMock.__lastSignIn?.scopes).toContain('workspace:read');
    expect(globalMock.__lastSignIn?.scopes).toContain('openid');
  });

  it('maps a redirect result into the in-memory session', async () => {
    globalMock.__oktaTokens = { accessToken: ACCESS, idToken: ID };
    const handled = await AUTH.handleRedirect(new URL('http://localhost:5173/?code=abc&state=xyz'));
    expect(handled).toBe('handled');
    const session = AUTH.session();
    expect(session?.accessToken.value).toBe('okta-access-value');
    expect(session?.account?.email).toBe('okta.user@agentic-advantage.example');
  });

  it('rejects a state error without surfacing the library text (A1, A8)', async () => {
    globalMock.__oktaPendingReject = new Error('error_description=state mismatch');
    const handled = await AUTH.handleRedirect(new URL('http://localhost:5173/?code=abc&state=xyz'));
    expect(handled).toBe('rejected');
    expect(AUTH.session()).toBeNull();
  });

  it('configures the Okta token manager with memory storage (A4, SD-3)', () => {
    expect(globalMock.__oktaOptions?.tokenManager?.storage).toBe('memory');
  });

  it('clears the in-memory token manager on sign-out (SD-5)', async () => {
    globalMock.__oktaTokens = { accessToken: ACCESS, idToken: ID };
    await AUTH.handleRedirect(new URL('http://localhost:5173/?code=abc&state=xyz'));
    await AUTH.signOut();
    expect(globalMock.__oktaCleared).toBe(true);
    expect(AUTH.session()).toBeNull();
  });

  it('logs a failed renewal at warn level', async () => {
    globalMock.__oktaRenewReject = new Error('renew failed');
    await expect(AUTH.renew()).resolves.toBe(false);
    const entry = log.recent().find(item => item.message === 'Token renewal failed');
    expect(entry?.level).toBe('warn');
    expect(entry?.scope).toBe('okta');
  });

  it('never writes a token to browser storage (A4)', async () => {
    const localSet = vi.spyOn(Storage.prototype, 'setItem');
    const sessionSet = vi.spyOn(window.sessionStorage, 'setItem');
    globalMock.__oktaTokens = { accessToken: ACCESS, idToken: ID };
    await AUTH.handleRedirect(new URL('http://localhost:5173/?code=abc&state=xyz'));
    await AUTH.getAccessToken();
    expect(localSet).not.toHaveBeenCalled();
    expect(sessionSet).not.toHaveBeenCalled();
  });

  it('ignores a callback when Okta is not configured (R5)', async () => {
    setAppConfig({
      gatewayUrl: 'http://localhost:9080',
      providers: [
        {
          id: 'entra',
          name: 'Microsoft Entra ID',
          clientId: 'spa-client-id',
          issuer: 'https://login.microsoftonline.com/tenant/v2.0',
        },
      ],
    });
    await expect(
      AUTH.handleRedirect(new URL('http://localhost:5173/?code=abc&state=xyz'))
    ).resolves.toBe('ignored');
  });

  it('reports a configured provider whose client fails to initialize (R5)', async () => {
    globalMock.__oktaInitReject = new Error('initialize failed');
    vi.resetModules();
    const config = await import('../../../core/config');
    config.setAppConfig({
      gatewayUrl: 'http://localhost:9080',
      providers: [
        {
          id: 'okta',
          name: 'Okta',
          clientId: 'okta-client-id',
          issuer: 'https://dev-1.okta.example/oauth2/default',
        },
      ],
    });
    const freshLog = await import('../../../core/lib/log');
    const { createOktaAuth } = await import('../auth');

    await expect(
      createOktaAuth().handleRedirect(new URL('http://localhost:5173/?code=abc&state=xyz'))
    ).resolves.toBe('rejected');
    expect(freshLog.log.recent().some(entry => entry.message === 'Redirect handling failed')).toBe(true);
  });
});
