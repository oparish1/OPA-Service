import type { FastifyReply, FastifyRequest } from 'fastify';
import type { AppConfig } from '../config';
import type { Store } from '../db';
import { isProviderId } from './providers';
import type { ProviderId, ProviderRegistry } from './providers';
import { SESSION_IDLE_MS } from './session';
import type { SessionService } from './session';

export interface AuthContext {
  userId?: string;
  provider: ProviderId;
  subject: string;
  issuer: string;
  /** Entra-derived, retained so existing audit and account-format call sites keep working. */
  oid?: string;
  tid?: string;
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
    private readonly providers: ProviderRegistry,
    private readonly config: AppConfig
  ) {}

  async onRequest(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const routeConfig = request.routeOptions.config;
    const routeUrl = request.routeOptions.url;
    const staticRoute = routeUrl === '/*' || isStaticRoute(routeUrl ?? '');
    if (
      // An unmatched route has no config to protect; let the not-found handler answer.
      !routeUrl ||
      !this.config.authEnabled ||
      routeConfig?.auth === 'public' ||
      staticRoute ||
      isStaticPath(request.url)
    ) {
      return;
    }

    const sessionId = this.session.sessionIdFrom(request);
    if (sessionId) {
      const record = await this.session.read(sessionId);
      if (record) {
        const user = this.store.getUserById(record.userId);
        request.auth = {
          userId: record.userId,
          provider: user && isProviderId(user.provider) ? user.provider : 'entra',
          subject: user?.subject ?? '',
          issuer: user?.issuer ?? this.config.issuer,
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
      const token = header.slice(7);
      for (const provider of this.providers.all) {
        if (!provider.bearer) continue;
        try {
          const identity = await provider.bearer.validate(token, routeConfig?.scope);
          const user = this.store.getUserByIdentity(provider.id, provider.issuer, identity.subject);
          request.auth = {
            userId: user?.id,
            provider: provider.id,
            subject: identity.subject,
            issuer: provider.issuer,
            oid: provider.id === 'entra' ? identity.subject : undefined,
            tid: provider.id === 'entra' ? identity.tid : undefined,
            via: 'bearer',
            scopes: identity.scopes,
          };
          return;
        } catch {
          // A token that fails one provider's strict iss/aud check may still be valid for the next.
        }
      }
    }

    await reply.code(401).send({ error: 'unauthorized' });
  }
}
