import { describe, expect, it } from 'bun:test';
import { RUNNER_ACCEPT, RUNNER_BODY_CAP, relayRequest } from '../src/request-runner';
import type { RelayOptions, RelaySuccess } from '../src/request-runner';

const OWN_ORIGIN = 'http://localhost:3000';
const OWN_HOST = 'localhost:3000';

type FetchArgs = Parameters<typeof fetch>;

function stubFetch(response: Response | (() => Promise<Response>)) {
  const calls: Array<{ input: string; init: RequestInit }> = [];
  const fetchImpl = (async (...args: FetchArgs) => {
    calls.push({ input: String(args[0]), init: args[1] ?? {} });
    return typeof response === 'function' ? response() : response;
  }) as typeof fetch;
  return { calls, fetchImpl };
}

function options(overrides: Partial<RelayOptions> = {}): RelayOptions {
  return {
    url: `${OWN_ORIGIN}/v1/me`,
    auth: 'session',
    sessionToken: 'real-session-token',
    allowedHosts: [OWN_HOST],
    ownOrigin: OWN_ORIGIN,
    ...overrides,
  };
}

function authorization(init: RequestInit): string | undefined {
  return (init.headers as Record<string, string> | undefined)?.authorization;
}

function asSuccess(outcome: Awaited<ReturnType<typeof relayRequest>>): RelaySuccess {
  if ('error' in outcome) throw new Error(`expected success, got ${outcome.error}`);
  return outcome;
}

describe('relayRequest validation', () => {
  it('rejects a non-http scheme without sending anything', async () => {
    const { calls, fetchImpl } = stubFetch(new Response(''));
    const outcome = await relayRequest(options({ url: 'ftp://localhost:3000/v1/me', fetchImpl }));
    expect(outcome).toEqual({ error: 'invalid_url', receivedAt: expect.any(String) });
    expect(calls).toHaveLength(0);
  });

  it('rejects a URL carrying credentials without sending anything', async () => {
    const { calls, fetchImpl } = stubFetch(new Response(''));
    const outcome = await relayRequest(
      options({ url: 'http://user:pass@localhost:3000/v1/me', fetchImpl })
    );
    expect(outcome).toEqual({ error: 'invalid_url', receivedAt: expect.any(String) });
    expect(calls).toHaveLength(0);
  });

  it('rejects a URL longer than the limit without sending anything', async () => {
    const { calls, fetchImpl } = stubFetch(new Response(''));
    const longUrl = `${OWN_ORIGIN}/v1/me?x=${'a'.repeat(2100)}`;
    const outcome = await relayRequest(options({ url: longUrl, fetchImpl }));
    expect(outcome).toEqual({ error: 'invalid_url', receivedAt: expect.any(String) });
    expect(calls).toHaveLength(0);
  });

  it('rejects a host outside the allowlist without sending anything', async () => {
    const { calls, fetchImpl } = stubFetch(new Response(''));
    const outcome = await relayRequest(
      options({ url: 'http://blocked.example/v1/me', fetchImpl })
    );
    expect(outcome).toEqual({ error: 'blocked_host', receivedAt: expect.any(String) });
    expect(calls).toHaveLength(0);
  });

  it('refuses the session token for an allowed non-own-origin host', async () => {
    const { calls, fetchImpl } = stubFetch(new Response(''));
    const outcome = await relayRequest(
      options({
        url: 'http://other.example/v1/me',
        allowedHosts: [OWN_HOST, 'other.example'],
        fetchImpl,
      })
    );
    expect(outcome).toEqual({
      error: 'session_token_not_allowed_for_host',
      receivedAt: expect.any(String),
    });
    expect(calls).toHaveLength(0);
  });
});

describe('relayRequest authorization', () => {
  it('attaches the session token to the own origin with GET and the exact Accept', async () => {
    const { calls, fetchImpl } = stubFetch(new Response('{}', { headers: { 'content-type': 'application/json' } }));
    await relayRequest(options({ fetchImpl }));
    expect(calls).toHaveLength(1);
    expect(calls[0].init.method).toBe('GET');
    expect(calls[0].init.redirect).toBe('manual');
    expect(authorization(calls[0].init)).toBe('Bearer real-session-token');
    expect((calls[0].init.headers as Record<string, string>).accept).toBe(RUNNER_ACCEPT);
  });

  it('sends the literal valid token', async () => {
    const { calls, fetchImpl } = stubFetch(new Response('{}'));
    await relayRequest(options({ auth: 'valid-token-123', fetchImpl }));
    expect(authorization(calls[0].init)).toBe('Bearer valid-token-123');
  });

  it('sends the literal expired token', async () => {
    const { calls, fetchImpl } = stubFetch(new Response('{}'));
    await relayRequest(options({ auth: 'expired-token', fetchImpl }));
    expect(authorization(calls[0].init)).toBe('Bearer expired-token');
  });

  it('sends no Authorization header for the none option', async () => {
    const { calls, fetchImpl } = stubFetch(new Response('{}'));
    await relayRequest(options({ auth: 'none', fetchImpl }));
    expect(authorization(calls[0].init)).toBeUndefined();
  });

  it('fails when the session option has no server-side token', async () => {
    const { calls, fetchImpl } = stubFetch(new Response('{}'));
    const outcome = await relayRequest(options({ sessionToken: undefined, fetchImpl }));
    expect(outcome).toEqual({ error: 'request_failed', receivedAt: expect.any(String) });
    expect(calls).toHaveLength(0);
  });
});

describe('relayRequest response handling', () => {
  it('returns a 3xx without following it and filters the location header', async () => {
    const { fetchImpl } = stubFetch(
      new Response('', { status: 302, headers: { location: 'http://blocked.example/' } })
    );
    const result = asSuccess(await relayRequest(options({ fetchImpl })));
    expect(result.status).toBe(302);
    expect(result.headers).not.toContain('location: http://blocked.example/');
  });

  it('strips set-cookie and unknown headers but keeps allowlisted ones', async () => {
    const { fetchImpl } = stubFetch(
      new Response('{}', {
        headers: {
          'content-type': 'application/json',
          'set-cookie': 'aa_session=secret',
          'x-secret': 'hidden',
          etag: '"v1"',
        },
      })
    );
    const result = asSuccess(await relayRequest(options({ fetchImpl })));
    expect(result.headers).toContain('content-type: application/json');
    expect(result.headers).toContain('etag: "v1"');
    expect(result.headers.some(header => header.startsWith('set-cookie'))).toBe(false);
    expect(result.headers.some(header => header.startsWith('x-secret'))).toBe(false);
  });

  it('falls back to the standard reason phrase when statusText is empty', async () => {
    const { fetchImpl } = stubFetch(new Response('', { status: 404 }));
    const result = asSuccess(await relayRequest(options({ fetchImpl })));
    expect(result.statusText).toBe('Not Found');
  });

  it('truncates a body over the cap and reports the cap as its size', async () => {
    const oversized = 'a'.repeat(RUNNER_BODY_CAP + 512);
    const { fetchImpl } = stubFetch(
      new Response(oversized, { headers: { 'content-type': 'text/plain' } })
    );
    const result = asSuccess(await relayRequest(options({ fetchImpl })));
    expect(result.truncated).toBe(true);
    expect(result.size).toBe(RUNNER_BODY_CAP);
    expect(result.body.length).toBe(RUNNER_BODY_CAP);
  });

  it('does not decode a binary body', async () => {
    const { fetchImpl } = stubFetch(
      new Response(new Uint8Array([0, 1, 2, 3]), {
        headers: { 'content-type': 'application/octet-stream' },
      })
    );
    const result = asSuccess(await relayRequest(options({ fetchImpl })));
    expect(result.body).toBe('');
    expect(result.contentType).toBe('application/octet-stream');
  });

  it('samples receivedAt after the body is read, not at the request start', async () => {
    let bodyReadAt = 0;
    const fetchImpl = (async () => {
      await new Promise(resolve => setTimeout(resolve, 20));
      bodyReadAt = Date.now();
      return new Response('{}', { headers: { 'content-type': 'application/json' } });
    }) as unknown as typeof fetch;
    const result = asSuccess(await relayRequest(options({ fetchImpl })));
    expect(Date.parse(result.receivedAt)).toBeGreaterThanOrEqual(bodyReadAt);
  });
});

describe('relayRequest failures', () => {
  it('maps an aborted request to request_timeout with the elapsed time', async () => {
    const fetchImpl = ((_input: string, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
      })) as typeof fetch;
    const outcome = await relayRequest(options({ fetchImpl, timeoutMs: 10 }));
    expect(outcome).toEqual({
      error: 'request_timeout',
      durationMs: expect.any(Number),
      receivedAt: expect.any(String),
    });
  });

  it('maps a connection failure to request_failed', async () => {
    const fetchImpl = (() => Promise.reject(new TypeError('fetch failed'))) as unknown as typeof fetch;
    const outcome = await relayRequest(options({ fetchImpl }));
    expect(outcome).toEqual({
      error: 'request_failed',
      durationMs: expect.any(Number),
      receivedAt: expect.any(String),
    });
  });

  it('samples receivedAt when the request fails, not at the request start', async () => {
    let abortedAt = 0;
    const fetchImpl = ((_input: string, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          abortedAt = Date.now();
          reject(new DOMException('aborted', 'AbortError'));
        });
      })) as typeof fetch;
    const outcome = await relayRequest(options({ fetchImpl, timeoutMs: 10 }));
    if (!('error' in outcome)) throw new Error('expected failure');
    expect(Date.parse(outcome.receivedAt)).toBeGreaterThanOrEqual(abortedAt);
  });
});
