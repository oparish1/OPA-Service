import { createHash } from 'node:crypto';
import type { Store } from './db';

export type AuditEventName =
  | 'login.start'
  | 'login.success'
  | 'login.refused'
  | 'session.refresh'
  | 'session.refresh.failed'
  | 'token.reveal'
  | 'logout'
  | 'csrf.refused'
  | 'rate_limited';

export interface AuditEvent {
  event: AuditEventName;
  outcome: 'success' | 'failure';
  actorOid?: string | null;
  actorTid?: string | null;
  sessionId?: string | null;
  reason?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, string | number | boolean>;
}

/** A stable, non-reversible handle for a session id so audit rows never carry the id. */
export function hashSessionId(id: string): string {
  return createHash('sha256').update(id).digest('hex');
}

export class AuditLogger {
  constructor(private readonly store: Store) {}

  record(event: AuditEvent): void {
    this.store.insertAudit({
      actorOid: event.actorOid ?? null,
      actorTid: event.actorTid ?? null,
      sessionHash: event.sessionId ? hashSessionId(event.sessionId) : null,
      event: event.event,
      outcome: event.outcome,
      reason: event.reason ?? null,
      ip: event.ip ?? null,
      userAgent: event.userAgent ?? null,
      createdAt: Date.now(),
      metadata: event.metadata ? JSON.stringify(event.metadata) : null,
    });
  }

  /** Removes audit rows older than the configured retention window. */
  purge(retentionDays: number, now = Date.now()): number {
    return this.store.purgeAudit(now - retentionDays * 24 * 60 * 60 * 1000);
  }
}
