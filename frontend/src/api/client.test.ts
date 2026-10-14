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

  it('sends a bearer token only when one is held and maps the response', async () => {
    const fetchMock = vi.fn().mockResolvedValue(fakeResponse({ body: { projects: [] } }));
    vi.stubGlobal('fetch', fetchMock);

    const response = await runRequest('held-token', 'https://api.agadv.example/v1/projects');

    expect(fetchMock).toHaveBeenCalledWith('/v1/projects', {
      credentials: 'same-origin',
      headers: { Authorization: 'Bearer held-token' },
    });
    expect(response.status).toBe(200);
    expect(response.timestamp).toMatch(/^\d{2} [A-Z][a-z]{2} \d{4} · \d{2}:\d{2}:\d{2} UTC$/);
  });

  it('falls back to the session cookie when no bearer token is held', async () => {
    const fetchMock = vi.fn().mockResolvedValue(fakeResponse({ body: {} }));
    vi.stubGlobal('fetch', fetchMock);

    await runRequest('', 'https://api.agadv.example/v1/me');

    expect(fetchMock).toHaveBeenCalledWith('/v1/me', {
      credentials: 'same-origin',
      headers: {},
    });
  });
});
