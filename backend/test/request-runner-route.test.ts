import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import type { FastifyInstance } from 'fastify';
import {
  completeLogin,
  createTestHarness,
  sessionCookie,
  sessionCsrf,
  sessionIdOf,
} from './helpers/harness';
import type { Harness } from './helpers/harness';
import { createTestIdp } from '../src/core/testing';
import type { TestIdp } from '../src/core/testing';

interface SignedIn {
  name: string;
  value: string;
  csrf: string;
}

let idp: TestIdp;
let harness: Harness;
let port: number;
const logs: string[] = [];

function reservePort(): number {
  const probe = Bun.serve({ port: 0, fetch: () => new Response('') });
  const reserved = probe.port;
  probe.stop(true);
  if (reserved === undefined) throw new Error('no ephemeral port');
  return reserved;
}

async function signIn(): Promise<SignedIn> {
  const { response } = await completeLogin(harness.app, idp);
  const cookie = sessionCookie(response);
  const csrf = await sessionCsrf(harness.app, cookie);
  return { ...cookie, csrf };
}

function runVia(
  app: FastifyInstance,
  config: Harness['config'],
  cookie: SignedIn,
  payload: { url: string; auth: string },
  headers: Record<string, string> = {},
  withCsrf = true
) {
  return app.inject({
    method: 'POST',
    url: '/api/request-runner',
    cookies: { [cookie.name]: cookie.value },
    headers: {
      origin: config.allowedOrigin,
      ...(withCsrf ? { 'x-csrf-token': cookie.csrf } : {}),
      ...headers,
    },
    payload,
  });
}

async function listen(app: FastifyInstance, onPort: number): Promise<void> {
  await app.listen({ port: onPort, host: '127.0.0.1' });
}

beforeEach(async () => {
  idp = createTestIdp();
  await idp.start();
  port = reservePort();
  logs.length = 0;
  harness = await createTestHarness({
    idp,
    loggerStream: { write: message => logs.push(message) },
    env: {
      PUBLIC_BASE_URL: `http://127.0.0.1:${port}`,
      REQUEST_RUNNER_ALLOWED_HOSTS: 'other.example',
    },
  });
  await listen(harness.app, port);
});

afterEach(async () => {
  await harness.app.close();
  harness.store.close();
  idp.stop();
});

describe('request-runner route', () => {
  it('relays the session token to the own origin and returns a real 200', async () => {
    const cookie = await signIn();
    const response = await runVia(harness.app, harness.config, cookie, {
      url: `${harness.config.publicBaseUrl}/v1/me`,
      auth: 'session',
    });
    expect(response.statusCode).toBe(200);
    const payload = response.json() as { status: number; body: string; durationMs: number };
    expect(payload.status).toBe(200);
    expect(payload.body).toContain('orlando.parish@agentic-advantage.example');
    expect(payload.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('relays the session token to the projects endpoint', async () => {
    const cookie = await signIn();
    const response = await runVia(harness.app, harness.config, cookie, {
      url: `${harness.config.publicBaseUrl}/v1/projects`,
      auth: 'session',
    });
    expect(response.statusCode).toBe(200);
    const payload = response.json() as { status: number; body: string };
    expect(payload.status).toBe(200);
    expect(payload.body).toContain('prj_01');
  });

  it('never returns the stored access token to the browser', async () => {
    const cookie = await signIn();
    const sessionId = sessionIdOf(harness.app, cookie);
    const tokens = harness.store.getTokens(sessionId);
    if (!tokens) throw new Error('tokens missing');
    const accessToken = harness.services.cipher.open(tokens.accessTokenEnc);

    const response = await runVia(harness.app, harness.config, cookie, {
      url: `${harness.config.publicBaseUrl}/v1/me`,
      auth: 'session',
    });
    expect(response.body).not.toContain(accessToken);
    expect(JSON.stringify(response.headers)).not.toContain(accessToken);
    expect(logs.join('')).not.toContain(accessToken);
  });

  for (const auth of ['valid-token-123', 'expired-token', 'none'] as const) {
    it(`returns the upstream 401 for the ${auth} option`, async () => {
      const cookie = await signIn();
      const response = await runVia(harness.app, harness.config, cookie, {
        url: `${harness.config.publicBaseUrl}/v1/me`,
        auth,
      });
      expect(response.statusCode).toBe(200);
      const payload = response.json() as { status: number; body: string };
      expect(payload.status).toBe(401);
      expect(payload.body).toContain('unauthorized');
    });
  }

  it('refuses the session option for an allowed non-own-origin host without sending', async () => {
    const cookie = await signIn();
    const response = await runVia(harness.app, harness.config, cookie, {
      url: 'http://other.example/v1/me',
      auth: 'session',
    });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: 'session_token_not_allowed_for_host' });
  });

  it('rejects a request without the CSRF token', async () => {
    const cookie = await signIn();
    const response = await runVia(
      harness.app,
      harness.config,
      cookie,
      { url: `${harness.config.publicBaseUrl}/v1/me`, auth: 'session' },
      {},
      false
    );
    expect(response.statusCode).toBe(403);
  });

  it('rejects a request with a foreign Origin', async () => {
    const cookie = await signIn();
    const response = await runVia(
      harness.app,
      harness.config,
      cookie,
      { url: `${harness.config.publicBaseUrl}/v1/me`, auth: 'session' },
      { origin: 'https://attacker.example' }
    );
    expect(response.statusCode).toBe(403);
  });

  it('rejects a malformed body', async () => {
    const cookie = await signIn();
    const response = await harness.app.inject({
      method: 'POST',
      url: '/api/request-runner',
      cookies: { [cookie.name]: cookie.value },
      headers: { origin: harness.config.allowedOrigin, 'x-csrf-token': cookie.csrf },
      payload: { url: 'http://localhost:3000/v1/me', auth: 'not-an-option' },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: 'invalid_request' });
  });

  it('requests without a session are rejected before reaching the relay', async () => {
    const response = await harness.app.inject({
      method: 'POST',
      url: '/api/request-runner',
      payload: { url: 'http://127.0.0.1/v1/me', auth: 'session' },
    });
    expect(response.statusCode).toBe(401);
  });

  it('audits host, path, auth, status and duration without the query or token', async () => {
    const cookie = await signIn();
    const sessionId = sessionIdOf(harness.app, cookie);
    const tokens = harness.store.getTokens(sessionId);
    if (!tokens) throw new Error('tokens missing');
    const accessToken = harness.services.cipher.open(tokens.accessTokenEnc);

    await runVia(harness.app, harness.config, cookie, {
      url: `${harness.config.publicBaseUrl}/v1/me?secret=leak-me`,
      auth: 'session',
    });
    const event = harness.store.listAuditEvents().find(row => row.event === 'request.runner');
    expect(event?.outcome).toBe('success');
    expect(event?.metadata).not.toContain('leak-me');
    expect(event?.metadata).not.toContain(accessToken);
    expect(event?.metadata).toContain('127.0.0.1');
    expect(event?.metadata).toContain('"path":"/v1/me"');
    expect(event?.metadata).toContain('"auth":"session"');
  });
});

describe('request-runner rate limiting', () => {
  it('returns 429 and audits once the request-runner limit is exceeded', async () => {
    const limitedIdp = createTestIdp();
    await limitedIdp.start();
    const limitedPort = reservePort();
    const limited = await createTestHarness({
      idp: limitedIdp,
      loggerStream: { write: () => undefined },
      env: { PUBLIC_BASE_URL: `http://127.0.0.1:${limitedPort}`, RATE_LIMIT_REQUEST_RUNNER: '2' },
    });
    await listen(limited.app, limitedPort);
    try {
      const { response } = await completeLogin(limited.app, limitedIdp);
      const cookie = sessionCookie(response);
      const csrf = await sessionCsrf(limited.app, cookie);
      const signedIn: SignedIn = { ...cookie, csrf };
      const payload = { url: `${limited.config.publicBaseUrl}/v1/me`, auth: 'session' };
      const first = await runVia(limited.app, limited.config, signedIn, payload);
      const second = await runVia(limited.app, limited.config, signedIn, payload);
      const third = await runVia(limited.app, limited.config, signedIn, payload);
      expect(first.statusCode).toBe(200);
      expect(second.statusCode).toBe(200);
      expect(third.statusCode).toBe(429);
      expect(limited.store.listAuditEvents().some(event => event.event === 'rate_limited')).toBe(
        true
      );
    } finally {
      await limited.app.close();
      limited.store.close();
      limitedIdp.stop();
    }
  });
});
