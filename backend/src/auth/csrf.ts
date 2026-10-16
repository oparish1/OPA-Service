import type { FastifyReply, FastifyRequest } from 'fastify';
import type { AuditLogger } from '../audit';
import type { AppConfig } from '../config';
import type { SessionService } from './session';

function firstHeader(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Synchronizer-token CSRF check for state-changing cookie routes, paired with an
 * Origin check. The token is issued with the session and echoed by the SPA.
 */
export function createCsrfPreHandler(
  config: AppConfig,
  session: SessionService,
  audit: AuditLogger
) {
  return async function csrfPreHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const auth = request.auth;
    if (!auth?.sessionId) {
      await reply.code(403).send({ error: 'forbidden' });
      return;
    }

    const origin = firstHeader(request.headers.origin);
    if (origin && origin !== config.allowedOrigin) {
      audit.record({
        event: 'csrf.refused',
        outcome: 'failure',
        reason: 'csrf_origin',
        actorOid: auth.oid || null,
        actorTid: auth.tid || null,
        provider: auth.provider,
        subject: auth.subject,
        sessionId: auth.sessionId,
        ip: request.ip,
        userAgent: request.headers['user-agent'],
      });
      await reply.code(403).send({ error: 'forbidden' });
      return;
    }

    const record = session.peek(auth.sessionId);
    if (!record || !session.csrfMatches(record, firstHeader(request.headers['x-csrf-token']))) {
      audit.record({
        event: 'csrf.refused',
        outcome: 'failure',
        reason: 'csrf_token',
        actorOid: auth.oid || null,
        actorTid: auth.tid || null,
        provider: auth.provider,
        subject: auth.subject,
        sessionId: auth.sessionId,
        ip: request.ip,
        userAgent: request.headers['user-agent'],
      });
      await reply.code(403).send({ error: 'forbidden' });
    }
  };
}
