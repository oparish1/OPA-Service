import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setAppConfig } from '../config';
import { clearSession, setSession } from '../session/store';
import type { Session } from '../types';
import { runRequest } from './runner';

const GATEWAY = 'http://gateway.example';

const SESSION: Session = {
  provider: 'Microsoft Entra ID',
  providerId: 'entra',
  account: null,
  accessToken: { value: 'access-value', masked: 'ac…ue', expiresAt: 'soon', scopes: 'workspace:read' },
  refreshToken: { value: 'refresh-value', masked: 're…ue', expiresAt: 'later', grant: 'offline_access' },
  issuer: 'https://login.microsoftonline.com/tenant/v2.0',
  issuedAt: 'now',
  snapshot: 'entra · now',
};

beforeEach(() => {
  setAppConfig({
    gatewayUrl: GATEWAY,
    providers: [{ id: 'entra', name: 'Microsoft Entra ID', clientId: 'client', issuer: 'https://login.example' }],
  });
  setSession(SESSION);
});

afterEach(() => {
  clearSession();
  vi.restoreAllMocks();
});

describe('direct runner', () => {
  it('sends the session token only to the configured gateway origin (A5)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'application/json' },
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    const response = await runRequest('session', `${GATEWAY}/entra/v1/me`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true });
    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers.authorization).toBe('Bearer access-value');
  });

  it('refuses any other origin and sends nothing', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const response = await runRequest('session', 'http://elsewhere.example/v1/me');

    expect(response.errorCode).toBe('blocked_host');
    expect(response.status).toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects an unusable URL before reaching the network', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const response = await runRequest('none', 'not-a-url');

    expect(response.errorCode).toBe('invalid_url');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends no Authorization header for the no-token option', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response('{}', { status: 200, statusText: 'OK', headers: { 'content-type': 'application/json' } })
    );
    vi.stubGlobal('fetch', fetchMock);

    await runRequest('none', `${GATEWAY}/entra/v1/me`);

    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers.authorization).toBeUndefined();
  });
});
