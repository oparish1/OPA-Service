import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setAppConfig } from '../../../core/config';
import { log } from '../../../core/lib/log';
import { createEntraAuth } from '../auth';

interface MockGlobal {
  __lastLogin?: { scopes: string[] };
  __handleRedirect?: (hash: string) => unknown;
  __silentResult?: unknown;
  __cleared?: boolean;
  __pendingReject?: Error;
  __silentReject?: Error;
  __initReject?: Error;
  __msalOptions?: {
    cache?: { cacheLocation?: string };
    system?: {
      loggerOptions?: {
        logLevel?: number;
        piiLoggingEnabled?: boolean;
        loggerCallback?: (level: number, message: string, containsPii: boolean) => void;
      };
    };
  };
}

const globalMock = globalThis as unknown as MockGlobal;

vi.mock('@azure/msal-browser', () => {
  const account = {
    homeAccountId: 'home',
    environment: 'login.microsoftonline.com',
    tenantId: 'tenant',
    username: 'orlando.parish@agentic-advantage.example',
    localAccountId: 'acct-1',
  };
  class PublicClientApplication {
    constructor(options: unknown) {
      (globalThis as unknown as MockGlobal).__msalOptions = options as MockGlobal['__msalOptions'];
    }
    async initialize(): Promise<void> {
      const pending = (globalThis as unknown as MockGlobal).__initReject;
      if (pending) throw pending;
    }
    async loginRedirect(request: { scopes: string[] }): Promise<void> {
      (globalThis as unknown as MockGlobal).__lastLogin = request;
    }
    async handleRedirectPromise(hash: string): Promise<unknown> {
      const pending = (globalThis as unknown as MockGlobal).__pendingReject;
      if (pending) throw pending;
      const handler = (globalThis as unknown as MockGlobal).__handleRedirect;
      return handler ? handler(hash) : null;
    }
    getActiveAccount(): unknown {
      return account;
    }
    getAllAccounts(): unknown[] {
      return [account];
    }
    setActiveAccount(): void {}
    async acquireTokenSilent(): Promise<unknown> {
      const pending = (globalThis as unknown as MockGlobal).__silentReject;
      if (pending) throw pending;
      return (globalThis as unknown as MockGlobal).__silentResult ?? null;
    }
    async clearCache(): Promise<void> {
      (globalThis as unknown as MockGlobal).__cleared = true;
    }
  }
  class InteractionRequiredAuthError extends Error {}
  const LogLevel = { Error: 0, Warning: 1, Info: 2, Verbose: 3 };
  return { PublicClientApplication, InteractionRequiredAuthError, LogLevel };
});

const AUTH = createEntraAuth();

const RESULT = {
  account: {
    name: 'Orlando Parish',
    username: 'orlando.parish@agentic-advantage.example',
    localAccountId: 'acct-1',
    idTokenClaims: { iss: 'https://login.microsoftonline.com/tenant/v2.0', tid: 'tenant', roles: ['Workspace.User'] },
  },
  accessToken: 'access-token-value',
  expiresOn: new Date('2026-10-10T14:00:00Z'),
  scopes: ['api://api-client/workspace:read'],
};

beforeEach(async () => {
  setAppConfig({
    gatewayUrl: 'http://localhost:9080',
    providers: [
      {
        id: 'entra',
        name: 'Microsoft Entra ID',
        clientId: 'spa-client-id',
        issuer: 'https://login.microsoftonline.com/tenant/v2.0',
        apiResource: 'api://api-client',
        scopes: ['workspace:read'],
      },
    ],
  });
  globalMock.__lastLogin = undefined;
  globalMock.__handleRedirect = undefined;
  globalMock.__silentResult = undefined;
  globalMock.__cleared = false;
  globalMock.__pendingReject = undefined;
  globalMock.__silentReject = undefined;
  globalMock.__initReject = undefined;
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

describe('Entra auth', () => {
  it('starts a code + PKCE redirect with the composed resource scope (A1, A3)', async () => {
    await AUTH.signIn();
    expect(globalMock.__lastLogin?.scopes).toContain('api://api-client/workspace:read');
    expect(globalMock.__lastLogin?.scopes).toContain('offline_access');
  });

  it('maps a redirect result into the in-memory session', async () => {
    globalMock.__handleRedirect = () => RESULT;
    const handled = await AUTH.handleRedirect(new URL('http://localhost:5173/#code=abc&state=xyz'));
    expect(handled).toBe('handled');
    const session = AUTH.session();
    expect(session?.accessToken.value).toBe('access-token-value');
    expect(session?.accessToken.scopes).toContain('workspace:read');
    expect(session?.renewable).toBe(true);
  });

  it('rejects a state error without surfacing the library text (A1, A8)', async () => {
    globalMock.__pendingReject = new Error(
      'AADSTS50011 error_description=state mismatch; the raw provider text'
    );
    const handled = await AUTH.handleRedirect(new URL('http://localhost:5173/#code=abc&state=xyz'));
    expect(handled).toBe('rejected');
    expect(AUTH.session()).toBeNull();
  });

  it('configures MSAL with the allowed sessionStorage cache (A4, SD-3)', () => {
    expect(globalMock.__msalOptions?.cache?.cacheLocation).toBe('sessionStorage');
  });

  it('routes MSAL diagnostics at warning level and drops PII entries (R3)', () => {
    const loggerOptions = globalMock.__msalOptions?.system?.loggerOptions;
    expect(loggerOptions?.logLevel).toBe(1);
    expect(loggerOptions?.piiLoggingEnabled).toBe(false);

    loggerOptions?.loggerCallback?.(1, 'msal warning', false);
    loggerOptions?.loggerCallback?.(0, 'msal error', false);
    loggerOptions?.loggerCallback?.(1, 'msal pii', true);

    const messages = log.recent().map(entry => entry.message);
    expect(messages).toContain('msal warning');
    expect(messages).toContain('msal error');
    expect(messages).not.toContain('msal pii');
  });

  it('clears memory and the library cache on sign-out (SD-5)', async () => {
    globalMock.__handleRedirect = () => RESULT;
    await AUTH.handleRedirect(new URL('http://localhost:5173/#code=abc'));
    await AUTH.signOut();
    expect(globalMock.__cleared).toBe(true);
    expect(AUTH.session()).toBeNull();
  });

  it('logs a failed silent acquisition at warn level', async () => {
    globalMock.__silentReject = new Error('silent failed');
    await expect(AUTH.getAccessToken()).resolves.toBeNull();
    const entry = log.recent().find(item => item.message === 'Silent token acquisition failed');
    expect(entry?.level).toBe('warn');
    expect(entry?.scope).toBe('entra');
  });

  it('renews silently and updates the session (A3)', async () => {
    globalMock.__silentResult = RESULT;
    await expect(AUTH.renew()).resolves.toBe(true);
    expect(AUTH.session()?.accessToken.value).toBe('access-token-value');
  });

  it('never writes a token to browser storage (A4)', async () => {
    const localSet = vi.spyOn(Storage.prototype, 'setItem');
    const sessionSet = vi.spyOn(window.sessionStorage, 'setItem');
    const indexedDBMock = typeof indexedDB === 'undefined' ? null : vi.spyOn(indexedDB, 'open');
    globalMock.__handleRedirect = () => RESULT;
    await AUTH.handleRedirect(new URL('http://localhost:5173/#code=abc'));
    await AUTH.getAccessToken();
    expect(localSet).not.toHaveBeenCalled();
    expect(sessionSet).not.toHaveBeenCalled();
    expect(indexedDBMock?.mock.calls ?? []).toHaveLength(0);
  });

  it('ignores a callback when Entra is not configured (R5)', async () => {
    setAppConfig({
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
    await expect(
      AUTH.handleRedirect(new URL('http://localhost:5173/#code=abc&state=xyz'))
    ).resolves.toBe('ignored');
  });

  it('reports a configured provider whose client fails to initialize (R5)', async () => {
    globalMock.__initReject = new Error('initialize failed');
    vi.resetModules();
    const config = await import('../../../core/config');
    config.setAppConfig({
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
    const freshLog = await import('../../../core/lib/log');
    const { createEntraAuth } = await import('../auth');

    await expect(
      createEntraAuth().handleRedirect(new URL('http://localhost:5173/#code=abc&state=xyz'))
    ).resolves.toBe('rejected');
    expect(freshLog.log.recent().some(entry => entry.message === 'Redirect handling failed')).toBe(true);
  });
});
