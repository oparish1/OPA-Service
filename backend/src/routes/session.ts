import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { formatTimestamp, maskToken, toAccountSummary } from '../format';
import type { AccountSummary } from '../format';
import type { Services } from '../services';

type PreHandler = (request: FastifyRequest, reply: FastifyReply) => Promise<void>;

export interface SessionMetadata {
  provider: string;
  account: AccountSummary | null;
  accessToken: { masked: string; expiresAt: string; scopes: string };
  refreshToken: { masked: string; expiresAt: string; grant: string };
  issuer: string;
  issuedAt: string;
  snapshot: string;
  csrfToken: string;
}

function sessionMetadata(services: Services, sessionId: string, userId: string): SessionMetadata {
  const { store, session, cipher, config } = services;
  const record = session.peek(sessionId);
  const user = store.getUserById(userId);
  const tokens = store.getTokens(sessionId);
  const accessValue = tokens ? cipher.open(tokens.accessTokenEnc) : '';
  const refreshValue = tokens ? cipher.open(tokens.refreshTokenEnc) : '';
  return {
    provider: 'Microsoft Entra ID',
    account: user ? toAccountSummary(user) : null,
    accessToken: {
      masked: tokens ? maskToken(accessValue) : '',
      expiresAt: formatTimestamp(tokens?.accessExpiresAt ?? Date.now()),
      scopes: tokens?.scopes ?? '',
    },
    refreshToken: {
      masked: tokens ? maskToken(refreshValue) : '',
      expiresAt: formatTimestamp(tokens?.refreshExpiresAt ?? Date.now()),
      grant: 'offline_access · rotating refresh token',
    },
    issuer: config.issuer,
    issuedAt: formatTimestamp(record?.createdAt ?? Date.now()),
    snapshot: formatTimestamp(Date.now()),
    csrfToken: record?.csrfToken ?? '',
  };
}

export function registerSessionRoutes(
  app: FastifyInstance,
  services: Services,
  csrf: PreHandler
): void {
  const { config, store, cipher, audit, oidc } = services;

  app.get('/api/session', { config: { auth: 'required' } }, async (request, reply) => {
    const auth = request.auth;
    if (!auth?.sessionId || !auth.userId) {
      return reply.code(401).send({ error: 'unauthorized' });
    }
    return sessionMetadata(services, auth.sessionId, auth.userId);
  });

  app.post(
    '/api/session/refresh',
    {
      config: {
        auth: 'required',
        rateLimit: { max: config.rateLimitRefresh, timeWindow: '1 minute' },
      },
      preHandler: csrf,
    },
    async (request, reply) => {
      const auth = request.auth;
      if (!auth?.sessionId || !auth.userId) {
        return reply.code(401).send({ error: 'unauthorized' });
      }
      const tokens = store.getTokens(auth.sessionId);
      if (!tokens?.refreshTokenEnc) {
        return reply.code(401).send({ error: 'no_refresh_token' });
      }
      try {
        const refreshed = await oidc.refresh(cipher.open(tokens.refreshTokenEnc));
        store.saveTokens({
          sessionId: auth.sessionId,
          accessTokenEnc: cipher.seal(refreshed.accessToken),
          refreshTokenEnc: cipher.seal(refreshed.refreshToken),
          accessExpiresAt: refreshed.accessExpiresAt,
          refreshExpiresAt: refreshed.refreshExpiresAt,
          scopes: refreshed.scopes || tokens.scopes,
        });
        audit.record({
          event: 'session.refresh',
          outcome: 'success',
          actorOid: auth.oid || null,
          actorTid: auth.tid || null,
          sessionId: auth.sessionId,
          ip: request.ip,
          userAgent: request.headers['user-agent'] ?? null,
        });
        return sessionMetadata(services, auth.sessionId, auth.userId);
      } catch {
        audit.record({
          event: 'session.refresh.failed',
          outcome: 'failure',
          actorOid: auth.oid || null,
          actorTid: auth.tid || null,
          sessionId: auth.sessionId,
          ip: request.ip,
          userAgent: request.headers['user-agent'] ?? null,
        });
        return reply.code(401).send({ error: 'refresh_failed' });
      }
    }
  );

  app.post(
    '/api/session/tokens/reveal',
    {
      config: {
        auth: 'required',
        rateLimit: { max: config.rateLimitReveal, timeWindow: '1 minute' },
      },
      preHandler: csrf,
    },
    async (request, reply) => {
      const auth = request.auth;
      if (!auth?.sessionId) {
        return reply.code(401).send({ error: 'unauthorized' });
      }
      const body = (request.body ?? {}) as { kind?: string };
      if (body.kind !== 'access' && body.kind !== 'refresh') {
        return reply.code(400).send({ error: 'invalid_kind' });
      }
      const tokens = store.getTokens(auth.sessionId);
      if (!tokens) return reply.code(401).send({ error: 'unauthorized' });
      const value =
        body.kind === 'access'
          ? cipher.open(tokens.accessTokenEnc)
          : cipher.open(tokens.refreshTokenEnc);
      audit.record({
        event: 'token.reveal',
        outcome: 'success',
        actorOid: auth.oid || null,
        actorTid: auth.tid || null,
        sessionId: auth.sessionId,
        ip: request.ip,
        userAgent: request.headers['user-agent'] ?? null,
        metadata: { kind: body.kind },
      });
      reply.header('cache-control', 'no-store');
      return reply.send({ kind: body.kind, value });
    }
  );
}
