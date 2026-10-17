import { randomBytes } from 'node:crypto';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { OidcError } from '../auth/oidc';
import type { OidcTokenSet } from '../auth/oidc';
import type { ProviderDefinition } from '../auth/providers';
import { hashCookieValue, SESSION_IDLE_MS } from '../auth/session';
import type { Services } from '../services';

type PreHandler = (request: FastifyRequest, reply: FastifyReply) => Promise<void>;

function userAgent(request: FastifyRequest): string | null {
  return request.headers['user-agent'] ?? null;
}

function amrFromClaims(claims: Record<string, unknown>): string {
  const value = claims.amr;
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string').join(',')
    : '';
}

function registerLoginRoute(
  app: FastifyInstance,
  services: Services,
  provider: ProviderDefinition,
  url: string
): void {
  const { config, store, session, audit, cipher } = services;

  app.get(
    url,
    {
      config: {
        auth: 'public',
        rateLimit: { max: config.rateLimitLogin, timeWindow: '1 minute' },
      },
    },
    async (request, reply) => {
      const start = await provider.oidc.loginStart();
      const ltxCookie = randomBytes(32).toString('base64url');
      const now = Date.now();
      store.createLoginTransaction({
        state: start.state,
        cookieHash: hashCookieValue(ltxCookie),
        nonce: start.nonce,
        codeVerifierEnc: cipher.seal(start.codeVerifier),
        returnTo: '/',
        provider: provider.id,
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
        provider: provider.id,
        ip: request.ip,
        userAgent: userAgent(request),
      });
      return reply.redirect(start.url);
    }
  );
}

function registerCallbackRoute(
  app: FastifyInstance,
  services: Services,
  provider: ProviderDefinition
): void {
  const { config, store, session, audit, cipher } = services;

  app.get(
    provider.callbackPath,
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
          provider: provider.id,
          ip: request.ip,
          userAgent: userAgent(request),
        });
        reply.clearCookie(session.loginTransactionCookieName(), { path: '/' });
        return reply.redirect(errorRedirect);
      }

      if (!state || !code) return refuse('missing_code_or_state');

      const transaction = store.consumeLoginTransaction(state);
      if (!transaction) return refuse('invalid_state');
      if (transaction.provider !== provider.id) return refuse('provider_mismatch');
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

      let tokens: OidcTokenSet;
      try {
        tokens = await provider.oidc.exchange(new URL(request.url, config.publicBaseUrl), {
          state,
          nonce: transaction.nonce,
          codeVerifier,
        });
        provider.gate(tokens.claims);
      } catch (error) {
        const reason = error instanceof OidcError ? error.reason : 'token_exchange_failed';
        request.log.warn({ reason }, 'sign-in refused');
        return refuse(reason);
      }

      const subject = provider.subject(tokens.claims);
      const profile = provider.profile(tokens.claims);
      const user = store.upsertUserByIdentity(
        { provider: provider.id, issuer: provider.issuer, subject },
        profile
      );
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
        actorOid: profile.oid ?? null,
        actorTid: profile.tid ?? null,
        provider: provider.id,
        subject,
        sessionId: record.id,
        ip: request.ip,
        userAgent: userAgent(request),
        metadata: { amr: amrFromClaims(tokens.claims) },
      });
      return reply.redirect(transaction.returnTo || '/');
    }
  );
}

export function registerAuthRoutes(
  app: FastifyInstance,
  services: Services,
  csrf: PreHandler
): void {
  const { config, session, audit, providers } = services;

  app.get('/auth/providers', { config: { auth: 'public' } }, async () => ({
    providers: providers.all.map(provider => ({
      id: provider.id,
      name: provider.name,
      ...config.providerLinks[provider.id],
    })),
  }));

  for (const provider of providers.all) {
    registerLoginRoute(app, services, provider, provider.loginPath);
    registerCallbackRoute(app, services, provider);
  }

  app.post(
    '/auth/logout',
    { config: { auth: 'required' }, preHandler: csrf },
    async (request, reply) => {
      const auth = request.auth;
      if (auth?.sessionId) await session.destroy(auth.sessionId);
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
        provider: auth?.provider,
        subject: auth?.subject,
        sessionId: auth?.sessionId ?? null,
        ip: request.ip,
        userAgent: userAgent(request),
      });
      const endSession = auth ? providers.get(auth.provider)?.oidc.endSessionUrl() : null;
      if (endSession) return reply.redirect(endSession);
      return reply.code(204).send();
    }
  );
}
