import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RUNNER_TIMEOUT_MS } from '../../../../shared/request-runner';
import { setAppConfig } from '../config';
import { log } from '../lib/log';
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
  log.clear();
  vi.spyOn(console, 'debug').mockImplementation(() => undefined);
  vi.spyOn(console, 'info').mockImplementation(() => undefined);
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  setAppConfig({
    gatewayUrl: GATEWAY,
    providers: [{ id: 'entra', name: 'Microsoft Entra ID', clientId: 'client', issuer: 'https://login.example' }],
  });
  setSession(SESSION);
});

afterEach(() => {
  clearSession();
  vi.useRealTimers();
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

describe('direct runner logging', () => {
  it('logs a network failure with host and path only, never the query string', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    const response = await runRequest('none', `${GATEWAY}/entra/v1/me?code=secret-code&state=secret-state`);
    expect(response.errorCode).toBe('request_failed');
    const entry = log.recent().at(-1);
    expect(entry?.level).toBe('error');
    expect(entry?.data).toMatchObject({ host: 'gateway.example', path: '/entra/v1/me' });
    expect(JSON.stringify(entry)).not.toContain('secret-code');
    expect(JSON.stringify(entry)).not.toContain('secret-state');
    expect(response.reference).toBe(entry?.reference);
  });

  it('logs a timeout with host and path only', async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      'fetch',
      vi.fn((_url: string, init: RequestInit) => {
        return new Promise((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
        });
      })
    );
    const pending = runRequest('none', `${GATEWAY}/entra/v1/me?code=secret-code`);
    await vi.advanceTimersByTimeAsync(RUNNER_TIMEOUT_MS);
    const response = await pending;
    vi.useRealTimers();
    expect(response.errorCode).toBe('request_timeout');
    const entry = log.recent().at(-1);
    expect(entry?.level).toBe('error');
    expect(entry?.data).toMatchObject({ host: 'gateway.example', path: '/entra/v1/me' });
    expect(JSON.stringify(entry)).not.toContain('secret-code');
  });

  it('logs a blocked origin with host and path only', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const response = await runRequest('none', 'http://elsewhere.example/v1/me?code=secret-code');
    expect(response.errorCode).toBe('blocked_host');
    const entry = log.recent().at(-1);
    expect(entry?.level).toBe('error');
    expect(entry?.data).toMatchObject({ host: 'elsewhere.example', path: '/v1/me' });
    expect(JSON.stringify(entry)).not.toContain('secret-code');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('logs a 4xx at warn and a 5xx at error with host and path only', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response('{}', { status: 404, statusText: 'Not Found', headers: { 'content-type': 'application/json' } })
      )
    );
    const notFound = await runRequest('none', `${GATEWAY}/entra/v1/me?code=secret-code`);
    const warnEntry = log.recent().at(-1);
    expect(warnEntry?.level).toBe('warn');
    expect(warnEntry?.data).toMatchObject({ host: 'gateway.example', path: '/entra/v1/me', status: 404 });
    expect(JSON.stringify(warnEntry)).not.toContain('secret-code');
    expect(notFound.reference).toBe(warnEntry?.reference);

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response('{}', { status: 500, statusText: 'Server Error', headers: { 'content-type': 'application/json' } })
      )
    );
    const serverError = await runRequest('none', `${GATEWAY}/entra/v1/me?code=secret-code`);
    const errorEntry = log.recent().at(-1);
    expect(errorEntry?.level).toBe('error');
    expect(errorEntry?.data).toMatchObject({ host: 'gateway.example', path: '/entra/v1/me', status: 500 });
    expect(JSON.stringify(errorEntry)).not.toContain('secret-code');
    expect(serverError.reference).toBe(errorEntry?.reference);
  });
});
