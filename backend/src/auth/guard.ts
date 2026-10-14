import type { FastifyReply, FastifyRequest } from 'fastify';
import type { AppConfig } from '../config';
import type { Store } from '../db';
import type { BearerValidator } from './bearer';
import { SESSION_IDLE_MS } from './session';
import type { SessionService } from './session';

export interface AuthContext {
  userId?: string;
  oid: string;
  tid: string;
  sessionId?: string;
  via: 'cookie' | 'bearer';
  scopes: string[];
}

declare module 'fastify' {
  interface FastifyRequest {
    auth?: AuthContext;
  }
  interface FastifyContextConfig {
    auth?: 'public' | 'required';
    scope?: string;
  }
}

/** Paths served by @fastify/static or otherwise public by construction. */
export function isStaticPath(url: string): boolean {
  const path = url.split('?')[0] ?? url;
  return (
    path === '/' ||
    path === '/favicon.ico' ||
    path === '/vite.svg' ||
    path.startsWith('/assets/')
  );
}

export function isStaticRoute(url: string): boolean {
  return url === '/*' || url.startsWith('/assets');
}

export class Guard {
  constructor(
    private readonly store: Store,
    private readonly session: SessionService,
    private readonly bearer: BearerValidator,
    private readonly config: AppConfig
  ) {}

  async onRequest(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const routeConfig = request.routeOptions.config;
    const staticRoute = request.routeOptions.url === '/*' || isStaticRoute(request.routeOptions.url ?? '');
    if (
      !this.config.authEnabled ||
      routeConfig?.auth === 'public' ||
      staticRoute ||
      isStaticPath(request.url)
    ) {
      return;
    }

    const sessionId = this.session.sessionIdFrom(request);
    if (sessionId) {
      const record = this.session.read(sessionId);
      if (record) {
        const user = this.store.getUserById(record.userId);
        request.auth = {
          userId: record.userId,
          oid: user?.oid ?? '',
          tid: user?.tid ?? '',
          sessionId: record.id,
          via: 'cookie',
          scopes: [],
        };
        // The server rolls lastSeenAt on every request; refresh the cookie's
        // Max-Age in step so the idle timeout is not a hard 30-minute deadline.
        reply.setCookie(
          this.session.cookieName(),
          record.id,
          this.session.cookieOptions(SESSION_IDLE_MS, true)
        );
        return;
      }
    }

    const header = request.headers.authorization;
    if (header?.startsWith('Bearer ')) {
      try {
        const identity = await this.bearer.validate(header.slice(7), routeConfig?.scope);
        const user = this.store.getUserByTidOid(identity.tid, identity.oid);
        request.auth = {
          userId: user?.id,
          oid: identity.oid,
          tid: identity.tid,
          via: 'bearer',
          scopes: identity.scopes,
        };
        return;
      } catch {
        // fall through to the generic 401
      }
    }

    await reply.code(401).send({ error: 'unauthorized' });
  }
}
