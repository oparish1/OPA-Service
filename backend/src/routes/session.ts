import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { withSessionRefreshLock } from '../auth/refresh-lock';
import type { ProviderDefinition } from '../auth/providers';
import type { TokenRecord } from '../db';
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

/** B15: never invent a refresh lifetime the provider has not published. */
function refreshExpiryLabel(provider: ProviderDefinition | undefined, tokens: TokenRecord | null): string {
  switch (provider?.refreshExpiry) {
    case 'policy':
      return 'Per provider policy';
    case 'none':
      return 'No fixed expiry';
    default:
      return formatTimestamp(tokens?.refreshExpiresAt ?? Date.now());
  }
}

function sessionMetadata(services: Services, sessionId: string, userId: string): SessionMetadata {
  const { store, session, cipher, config, providers } = services;
  const record = session.peek(sessionId);
  const user = store.getUserById(userId);
  const provider = providers.get(user?.provider ?? 'entra');
  const tokens = store.getTokens(sessionId);
  // Decryption failures propagate: corruption or a key mismatch must not be reported
  // as a legitimately absent token. An absent refresh token is stored as an empty string.
  const accessValue = tokens ? cipher.open(tokens.accessTokenEnc) : '';
  const refreshValue = tokens?.refreshTokenEnc ? cipher.open(tokens.refreshTokenEnc) : '';
  const hasRefresh = refreshValue.length > 0;
  return {
    provider: provider?.name ?? 'Microsoft Entra ID',
    account: user ? toAccountSummary(user) : null,
    accessToken: {
      masked: tokens ? maskToken(accessValue) : '',
      expiresAt: formatTimestamp(tokens?.accessExpiresAt ?? Date.now()),
      scopes: tokens?.scopes ?? '',
    },
    refreshToken: {
      masked: hasRefresh ? maskToken(refreshValue) : '',
      expiresAt: refreshExpiryLabel(provider, tokens),
      grant: hasRefresh ? (provider?.refreshGrant ?? 'Not issued') : 'Not issued',
    },
    issuer: provider?.issuer ?? config.issuer,
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
  const { config, store, cipher, audit, providers, session } = services;

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
      const sessionId = auth.sessionId;
      const userId = auth.userId;
      const providerId = auth.provider;
      const subject = auth.subject;
      const actorOid = auth.oid || null;
      const actorTid = auth.tid || null;
      const provider = providers.get(providerId);
      if (!provider) return reply.code(401).send({ error: 'unauthorized' });
      const metadata = await withSessionRefreshLock(sessionId, async () => {
        // Re-read inside the lock so a concurrent refresh uses the rotated token.
        const tokens = store.getTokens(sessionId);
        if (!tokens || !tokens.refreshTokenEnc) return { kind: 'no_refresh' as const };
        try {
          // A stored token that cannot be opened is corruption, not an unissued token:
          // it falls through to the failure branch and is logged and audited.
          const refreshValue = cipher.open(tokens.refreshTokenEnc);
          if (!refreshValue) return { kind: 'no_refresh' as const };
          const refreshed = await provider.oidc.refresh(refreshValue);
          store.saveTokens({
            sessionId,
            accessTokenEnc: cipher.seal(refreshed.accessToken),
            refreshTokenEnc: refreshed.refreshToken ? cipher.seal(refreshed.refreshToken) : '',
            accessExpiresAt: refreshed.accessExpiresAt,
            refreshExpiresAt: refreshed.refreshExpiresAt,
            scopes: refreshed.scopes || tokens.scopes,
          });
          audit.record({
            event: 'session.refresh',
            outcome: 'success',
            actorOid,
            actorTid,
            provider: providerId,
            subject,
            sessionId,
            ip: request.ip,
            userAgent: request.headers['user-agent'] ?? null,
          });
          return { kind: 'ok' as const };
        } catch (err) {
          const e = err as { code?: string; error?: string; error_description?: string; message?: string };
          request.log.warn(
            { code: e.code, error: e.error, description: e.error_description ?? e.message },
            'session refresh failed'
          );
          audit.record({
            event: 'session.refresh.failed',
            outcome: 'failure',
            actorOid,
            actorTid,
            provider: providerId,
            subject,
            sessionId,
            ip: request.ip,
            userAgent: request.headers['user-agent'] ?? null,
          });
          const invalidGrant = e.error === 'invalid_grant' || e.code === 'invalid_grant';
          return invalidGrant ? { kind: 'invalid_grant' as const } : { kind: 'failed' as const };
        }
      });
      if (metadata.kind === 'no_refresh') return reply.code(401).send({ error: 'no_refresh_token' });
      if (metadata.kind === 'invalid_grant') {
        await session.destroy(sessionId);
        reply.clearCookie(session.cookieName(), {
          path: '/',
          secure: config.cookieSecure,
          sameSite: 'lax',
        });
        return reply.code(401).send({ error: 'refresh_failed' });
      }
      if (metadata.kind === 'failed') return reply.code(401).send({ error: 'refresh_failed' });
      return sessionMetadata(services, sessionId, userId);
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
      const refreshTokenEnc = tokens.refreshTokenEnc;
      const value =
        body.kind === 'access'
          ? cipher.open(tokens.accessTokenEnc)
          : refreshTokenEnc
            ? cipher.open(refreshTokenEnc)
            : '';
      audit.record({
        event: 'token.reveal',
        outcome: 'success',
        actorOid: auth.oid || null,
        actorTid: auth.tid || null,
        provider: auth.provider,
        subject: auth.subject,
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
