import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setAppConfig } from '../../../core/config';
import { createEntraAuth } from '../auth';

interface MockGlobal {
  __lastLogin?: { scopes: string[] };
  __handleRedirect?: (hash: string) => unknown;
  __silentResult?: unknown;
  __cleared?: boolean;
  __pendingReject?: Error;
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
    async initialize(): Promise<void> {}
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
      return (globalThis as unknown as MockGlobal).__silentResult ?? null;
    }
    async clearCache(): Promise<void> {
      (globalThis as unknown as MockGlobal).__cleared = true;
    }
  }
  class InteractionRequiredAuthError extends Error {}
  return { PublicClientApplication, InteractionRequiredAuthError };
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
    expect(handled).toBe(true);
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
    expect(handled).toBe(false);
    expect(AUTH.session()).toBeNull();
  });

  it('clears memory and the library cache on sign-out (SD-5)', async () => {
    globalMock.__handleRedirect = () => RESULT;
    await AUTH.handleRedirect(new URL('http://localhost:5173/#code=abc'));
    await AUTH.signOut();
    expect(globalMock.__cleared).toBe(true);
    expect(AUTH.session()).toBeNull();
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
});
