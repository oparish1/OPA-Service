import { existsSync } from 'node:fs';
import cookie from '@fastify/cookie';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import Fastify from 'fastify';
import type { FastifyError, FastifyInstance } from 'fastify';
import { AuditLogger } from './audit';
import { createCsrfPreHandler } from './auth/csrf';
import { Guard } from './auth/guard';
import { buildProviderRegistry } from './auth/providers';
import { SessionService } from './auth/session';
import type { AppConfig } from './config';
import { TokenCipher } from './crypto';
import type { Store } from './db';
import { registerAuthRoutes } from './routes/auth';
import { createRouteInventory } from './routes/inventory';
import type { RouteInventory } from './routes/inventory';
import { registerRequestRunnerRoutes } from './routes/request-runner';
import { registerSessionRoutes } from './routes/session';
import { registerV1Routes } from './routes/v1';
import type { Services } from './services';

export interface BuildAppOptions {
  config: AppConfig;
  store: Store;
  frontendDist?: string;
  loggerStream?: { write(message: string): void };
}

export interface BuiltApp {
  app: FastifyInstance;
  services: Services;
  inventory: RouteInventory;
}

function isApiPath(url: string): boolean {
  const path = url.split('?')[0] ?? url;
  return (
    path === '/healthz' ||
    path.startsWith('/auth') ||
    path.startsWith('/api') ||
    path.startsWith('/v1')
  );
}

export async function buildApp(options: BuildAppOptions): Promise<BuiltApp> {
  const { config, store } = options;
  const app = Fastify({
    logger: options.loggerStream
      ? { level: config.logLevel, stream: options.loggerStream }
      : { level: config.logLevel },
    // Only the immediate peer is trusted. Fastify treats a numeric/always-false
    // trust setting as fail-closed, so request.ip cannot be set from
    // X-Forwarded-For by a client. Replace with the load balancer's CIDR once
    // one is known.
    trustProxy: () => false,
  });

  const cipher = new TokenCipher(config.tokenEncryptionKey, config.tokenEncryptionKeyPrevious);
  const audit = new AuditLogger(store);
  const providers = await buildProviderRegistry(config);
  const session = new SessionService(store, config, async record => {
    const user = store.getUserById(record.userId);
    const provider = user ? providers.get(user.provider) : undefined;
    if (!provider?.revokeRefresh) return;
    const tokens = store.getTokens(record.id);
    if (!tokens) return;
    let refreshToken = '';
    try {
      refreshToken = cipher.open(tokens.refreshTokenEnc);
    } catch {
      return;
    }
    if (!refreshToken) return;
    try {
      await provider.revokeRefresh(refreshToken);
      audit.record({
        event: 'token.revoke',
        outcome: 'success',
        provider: user?.provider ?? null,
        subject: user?.subject ?? null,
        sessionId: record.id,
      });
    } catch (error) {
      audit.record({
        event: 'token.revoke',
        outcome: 'failure',
        reason: error instanceof Error ? error.message : 'revoke_failed',
        provider: user?.provider ?? null,
        subject: user?.subject ?? null,
        sessionId: record.id,
      });
    }
  });

  const services: Services = { config, store, cipher, audit, session, providers };
  const csrf = createCsrfPreHandler(config, session, audit);
  const inventory = createRouteInventory();
  app.addHook('onRoute', inventory.onRoute);

  await app.register(cookie, { secret: config.sessionSecret });
  await app.register(helmet, {
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        frameAncestors: ["'none'"],
      },
    },
    hsts:
      config.nodeEnv === 'production'
        ? { maxAge: 31536000, includeSubDomains: true }
        : false,
  });

  const guard = new Guard(store, session, providers, config);
  app.addHook('onRequest', (request, reply) => guard.onRequest(request, reply));

  await app.register(rateLimit, {
    global: false,
    keyGenerator: request => request.auth?.sessionId ?? request.ip,
    onExceeded: request => {
      audit.record({
        event: 'rate_limited',
        outcome: 'failure',
        actorOid: request.auth?.oid || null,
        actorTid: request.auth?.tid || null,
        provider: request.auth?.provider,
        subject: request.auth?.subject,
        sessionId: request.auth?.sessionId ?? null,
        ip: request.ip,
        userAgent: request.headers['user-agent'] ?? null,
      });
    },
  });

  app.get('/healthz', { config: { auth: 'public' } }, async () => ({ status: 'ok' }));

  registerAuthRoutes(app, services, csrf);
  registerSessionRoutes(app, services, csrf);
  registerRequestRunnerRoutes(app, services, csrf);
  registerV1Routes(app, services);

  if (options.frontendDist && existsSync(options.frontendDist)) {
    await app.register(fastifyStatic, { root: options.frontendDist });
    app.setNotFoundHandler((request, reply) => {
      if (isApiPath(request.url)) return reply.code(404).send({ error: 'not_found' });
      return reply.sendFile('index.html');
    });
  } else {
    app.setNotFoundHandler((_request, reply) => reply.code(404).send({ error: 'not_found' }));
  }

  app.setErrorHandler((error: FastifyError, request, reply) => {
    request.log.error({ err: error }, 'request failed');
    if (reply.sent) return;
    const status = error.statusCode && error.statusCode >= 400 ? error.statusCode : 500;
    reply.code(status).send({ error: status === 500 ? 'server_error' : 'request_error' });
  });

  return { app, services, inventory };
}
