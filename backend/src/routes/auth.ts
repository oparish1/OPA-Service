import { randomBytes } from 'node:crypto';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { OidcError } from '../auth/oidc';
import { hashCookieValue, SESSION_IDLE_MS } from '../auth/session';
import type { Services } from '../services';

type PreHandler = (request: FastifyRequest, reply: FastifyReply) => Promise<void>;

function userAgent(request: FastifyRequest): string | null {
  return request.headers['user-agent'] ?? null;
}

export function registerAuthRoutes(
  app: FastifyInstance,
  services: Services,
  csrf: PreHandler
): void {
  const { config, store, session, audit, oidc, cipher } = services;

  app.get(
    '/auth/login',
    {
      config: {
        auth: 'public',
        rateLimit: { max: config.rateLimitLogin, timeWindow: '1 minute' },
      },
    },
    async (request, reply) => {
    const start = await oidc.loginStart();
    const ltxCookie = randomBytes(32).toString('base64url');
    const now = Date.now();
    store.createLoginTransaction({
      state: start.state,
      cookieHash: hashCookieValue(ltxCookie),
      nonce: start.nonce,
      codeVerifierEnc: cipher.seal(start.codeVerifier),
      returnTo: '/',
      createdAt: now,
      expiresAt: now + config.loginTransactionTtlSeconds * 1000,
    });
    reply.setCookie(
      session.loginTransactionCookieName(),
      ltxCookie,
      session.cookieOptions(config.loginTransactionTtlSeconds * 1000)
    );
    audit.record({
      event: 'login.start',
      outcome: 'success',
      ip: request.ip,
      userAgent: userAgent(request),
    });
    return reply.redirect(start.url);
  });

  app.get(
    '/auth/callback',
    {
      config: {
        auth: 'public',
        rateLimit: { max: config.rateLimitLogin, timeWindow: '1 minute' },
      },
    },
    async (request, reply) => {
    const query = request.query as Record<string, string | undefined>;
    const state = query.state;
    const code = query.code;
    const errorRedirect = `${config.publicBaseUrl}/?error=signin`;

    function refuse(reason: string): FastifyReply {
      audit.record({
        event: 'login.refused',
        outcome: 'failure',
        reason,
        ip: request.ip,
        userAgent: userAgent(request),
      });
      reply.clearCookie(session.loginTransactionCookieName(), { path: '/' });
      return reply.redirect(errorRedirect);
    }

    if (!state || !code) return refuse('missing_code_or_state');

    const transaction = store.consumeLoginTransaction(state);
    if (!transaction) return refuse('invalid_state');
    if (transaction.expiresAt < Date.now()) return refuse('expired_transaction');
    if (!transaction.codeVerifierEnc) return refuse('missing_pkce');

    const ltxCookie = request.cookies[session.loginTransactionCookieName()];
    if (!ltxCookie || hashCookieValue(ltxCookie) !== transaction.cookieHash) {
      return refuse('state_mismatch');
    }

    let codeVerifier: string;
    try {
      codeVerifier = cipher.open(transaction.codeVerifierEnc);
    } catch {
      return refuse('missing_pkce');
    }

    let tokens;
    try {
      tokens = await oidc.exchange(new URL(request.url, config.publicBaseUrl), {
        state,
        nonce: transaction.nonce,
        codeVerifier,
      });
    } catch (error) {
      const reason = error instanceof OidcError ? error.reason : 'token_exchange_failed';
      request.log.warn({ reason }, 'Entra sign-in refused');
      return refuse(reason);
    }

    const user = store.upsertUser({
      tid: tokens.identity.tid,
      oid: tokens.identity.oid,
      email: tokens.identity.email,
      displayName: tokens.identity.displayName,
      organisation: tokens.identity.organisation,
    });
    const record = session.create(user.id);
    store.saveTokens({
      sessionId: record.id,
      accessTokenEnc: cipher.seal(tokens.accessToken),
      refreshTokenEnc: cipher.seal(tokens.refreshToken),
      accessExpiresAt: tokens.accessExpiresAt,
      refreshExpiresAt: tokens.refreshExpiresAt,
      scopes: tokens.scopes,
    });
    reply.setCookie(
      session.cookieName(),
      record.id,
      session.cookieOptions(SESSION_IDLE_MS, true)
    );
    reply.clearCookie(session.loginTransactionCookieName(), { path: '/' });
    audit.record({
      event: 'login.success',
      outcome: 'success',
      actorOid: tokens.identity.oid,
      actorTid: tokens.identity.tid,
      sessionId: record.id,
      ip: request.ip,
      userAgent: userAgent(request),
      metadata: { amr: tokens.identity.amr.join(',') },
    });
    return reply.redirect(transaction.returnTo || '/');
  });

  app.post(
    '/auth/logout',
    { config: { auth: 'required' }, preHandler: csrf },
    async (request, reply) => {
      const auth = request.auth;
      if (auth?.sessionId) session.destroy(auth.sessionId);
      reply.clearCookie(session.cookieName(), {
        path: '/',
        secure: config.cookieSecure,
        sameSite: 'lax',
      });
      audit.record({
        event: 'logout',
        outcome: 'success',
        actorOid: auth?.oid || null,
        actorTid: auth?.tid || null,
        sessionId: auth?.sessionId ?? null,
        ip: request.ip,
        userAgent: userAgent(request),
      });
      const endSession = oidc.endSessionUrl();
      if (endSession) return reply.redirect(endSession);
      return reply.code(204).send();
    }
  );
}
