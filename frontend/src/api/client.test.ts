import { afterEach, describe, expect, it, vi } from 'vitest';
import { getSession, revealToken, runRequest, signOut } from './client';

interface FakeInit {
  status?: number;
  statusText?: string;
  body?: unknown;
  headers?: Record<string, string>;
}

function fakeResponse({ status = 200, statusText = 'OK', body = {}, headers = {} }: FakeInit) {
  const entries = Object.entries({ 'content-type': 'application/json', ...headers });
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText,
    headers: { forEach: (cb: (value: string, key: string) => void) => entries.forEach(([k, v]) => cb(v, k)) },
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

const RAW_SESSION = {
  provider: 'Microsoft Entra ID',
  account: {
    displayName: 'Orlando Parish',
    email: 'orlando.parish@agentic-advantage.example',
    organisation: 'Agentic Advantage',
    role: 'User',
    accountId: 'acct_oid-default',
    createdAt: '10 Oct 2026 · 13:30:00 UTC',
  },
  accessToken: { masked: 'at…1234', expiresAt: '10 Oct 2026', scopes: 'profile.read' },
  refreshToken: { masked: 'rt…5678', expiresAt: '11 Oct 2026', grant: 'offline_access' },
  issuer: 'https://login.microsoftonline.com/tenant/v2.0',
  issuedAt: '10 Oct 2026',
  snapshot: '10 Oct 2026',
  csrfToken: 'csrf-token-1',
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('real API client', () => {
  it('loads session metadata same-origin and strips token values', async () => {
    const fetchMock = vi.fn().mockResolvedValue(fakeResponse({ body: RAW_SESSION }));
    vi.stubGlobal('fetch', fetchMock);

    const session = await getSession();

    expect(fetchMock).toHaveBeenCalledWith('/api/session', { credentials: 'same-origin' });
    expect(session.accessToken.value).toBe('');
    expect(session.refreshToken.value).toBe('');
    expect(session.account?.displayName).toBe('Orlando Parish');
  });

  it('rejects sign-out when the server refuses to end the session', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(fakeResponse({ status: 403, statusText: 'Forbidden' }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(signOut()).rejects.toThrow('Sign-out failed');
    const [url, init] = fetchMock.mock.calls.at(-1)!;
    expect(url).toBe('/auth/logout');
    expect(init.method).toBe('POST');
  });

  it('reveals a token with the CSRF header', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(fakeResponse({ body: RAW_SESSION }))
      .mockResolvedValueOnce(fakeResponse({ body: { value: 'real-token' } }));
    vi.stubGlobal('fetch', fetchMock);

    await getSession();
    await expect(revealToken('access')).resolves.toBe('real-token');

    const [url, init] = fetchMock.mock.calls[1];
    expect(url).toBe('/api/session/tokens/reveal');
    expect(init.method).toBe('POST');
    expect(init.credentials).toBe('same-origin');
    expect(init.headers['x-csrf-token']).toBe('csrf-token-1');
    expect(init.body).toBe(JSON.stringify({ kind: 'access' }));
  });

  it('posts the relay request with the CSRF header and maps the success envelope', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(fakeResponse({ body: RAW_SESSION }))
      .mockResolvedValueOnce(
        fakeResponse({
          body: {
            status: 200,
            statusText: 'OK',
            headers: ['content-type: application/json'],
            contentType: 'application/json',
            body: '{"projects":[]}',
            truncated: false,
            size: 14,
            durationMs: 55,
            receivedAt: '2026-10-15T04:29:40.000Z',
          },
        })
      );
    vi.stubGlobal('fetch', fetchMock);

    await getSession();
    const response = await runRequest('session', 'http://localhost:3000/v1/projects');

    const [url, init] = fetchMock.mock.calls[1];
    expect(url).toBe('/api/request-runner');
    expect(init.method).toBe('POST');
    expect(init.credentials).toBe('same-origin');
    expect(init.headers['x-csrf-token']).toBe('csrf-token-1');
    expect(init.headers.Authorization).toBeUndefined();
    expect(init.body).toBe(
      JSON.stringify({ url: 'http://localhost:3000/v1/projects', auth: 'session' })
    );
    expect(response.status).toBe(200);
    expect(response.statusLabel).toBe('200 OK');
    expect(response.body).toEqual({ projects: [] });
    expect(response.bodyKind).toBe('json');
    expect(response.duration).toBe('55 ms');
    expect(response.size).toBe('14 B');
    expect(response.timestamp).toBe('15 Oct 2026 · 04:29:40 UTC');
  });

  it('labels a JSON media type whose body does not parse as text', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(fakeResponse({ body: RAW_SESSION }))
      .mockResolvedValueOnce(
        fakeResponse({
          body: {
            status: 200,
            statusText: 'OK',
            headers: ['content-type: application/json'],
            contentType: 'application/json',
            body: 'not json',
            truncated: false,
            size: 8,
            durationMs: 12,
            receivedAt: '2026-10-15T04:29:40.000Z',
          },
        })
      );
    vi.stubGlobal('fetch', fetchMock);

    await getSession();
    const response = await runRequest('session', 'http://localhost:3000/v1/me');

    expect(response.bodyKind).toBe('text');
    expect(response.body).toBe('not json');
  });

  it('shows the upstream 401 without a relay error', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(fakeResponse({ body: RAW_SESSION }))
      .mockResolvedValueOnce(
        fakeResponse({
          body: {
            status: 401,
            statusText: 'Unauthorized',
            headers: [],
            contentType: 'application/json',
            body: '{"error":"invalid_token"}',
            truncated: false,
            size: 26,
            durationMs: 84,
            receivedAt: '2026-10-15T04:30:00.000Z',
          },
        })
      );
    vi.stubGlobal('fetch', fetchMock);

    await getSession();
    const response = await runRequest('valid-token-123', 'http://localhost:3000/v1/me');

    expect(response.status).toBe(401);
    expect(response.statusLabel).toBe('401 Unauthorized');
    expect(response.errorCode).toBeUndefined();
  });

  it('maps a blocked host to a no-request failure with dashes', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(fakeResponse({ body: RAW_SESSION }))
      .mockResolvedValueOnce(
        fakeResponse({
          status: 400,
          statusText: 'Bad Request',
          body: { error: 'blocked_host', receivedAt: '2026-10-15T04:31:00.000Z' },
        })
      );
    vi.stubGlobal('fetch', fetchMock);

    await getSession();
    const response = await runRequest('session', 'http://elsewhere.example/v1/me');

    expect(response.status).toBe(0);
    expect(response.statusLabel).toBe('Blocked host');
    expect(response.duration).toBe('—');
    expect(response.size).toBe('—');
    expect(response.timestamp).toBe('—');
    expect(response.errorCode).toBe('blocked_host');
  });

  it('maps a timeout to a network-error response with the elapsed time', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(fakeResponse({ body: RAW_SESSION }))
      .mockResolvedValueOnce(
        fakeResponse({
          status: 504,
          statusText: 'Gateway Timeout',
          body: { error: 'request_timeout', durationMs: 10000, receivedAt: '2026-10-15T04:32:00.000Z' },
        })
      );
    vi.stubGlobal('fetch', fetchMock);

    await getSession();
    const response = await runRequest('session', 'http://localhost:3000/v1/me');

    expect(response.status).toBe(0);
    expect(response.statusLabel).toBe('Network error');
    expect(response.duration).toBe('10.0 s');
    expect(response.size).toBe('—');
    expect(response.timestamp).toBe('15 Oct 2026 · 04:32:00 UTC');
    expect(response.body).toEqual({ error: 'request_timeout' });
  });

  it('maps a dropped connection to request_failed', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(fakeResponse({ body: RAW_SESSION }))
      .mockRejectedValueOnce(new TypeError('fetch failed'));
    vi.stubGlobal('fetch', fetchMock);

    await getSession();
    const response = await runRequest('session', 'http://localhost:3000/v1/me');

    expect(response.status).toBe(0);
    expect(response.statusLabel).toBe('Network error');
    expect(response.body).toEqual({ error: 'request_failed' });
  });
});
