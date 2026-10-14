import { createHash, randomBytes } from 'node:crypto';
import type { CookieSerializeOptions } from '@fastify/cookie';
import type { FastifyRequest } from 'fastify';
import type { AppConfig } from '../config';
import { constantTimeEqual } from '../crypto';
import type { SessionRecord, Store } from '../db';

export const SESSION_IDLE_MS = 30 * 60 * 1000;
export const SESSION_ABSOLUTE_MS = 8 * 60 * 60 * 1000;

function token(): string {
  return randomBytes(32).toString('base64url');
}

export function hashCookieValue(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export class SessionService {
  constructor(
    private readonly store: Store,
    private readonly config: AppConfig
  ) {}

  cookieName(): string {
    return `${this.config.cookieSecure ? '__Host-' : ''}aa_session`;
  }

  loginTransactionCookieName(): string {
    return `${this.config.cookieSecure ? '__Host-' : ''}aa_ltx`;
  }

  cookieOptions(maxAgeMs: number, signed = false): CookieSerializeOptions {
    return {
      httpOnly: true,
      secure: this.config.cookieSecure,
      sameSite: 'lax',
      path: '/',
      maxAge: Math.floor(maxAgeMs / 1000),
      signed,
    };
  }

  /**
   * Reads the session cookie id, verifying the signature added at sign-in so a
   * rotated SESSION_SECRET invalidates browser sessions.
   */
  sessionIdFrom(request: FastifyRequest): string | null {
    const raw = request.cookies[this.cookieName()];
    if (!raw) return null;
    const unsigned = request.unsignCookie(raw);
    return unsigned.valid ? unsigned.value : null;
  }

  create(userId: string): SessionRecord {
    const now = Date.now();
    const record: SessionRecord = {
      id: token(),
      userId,
      csrfToken: token(),
      createdAt: now,
      lastSeenAt: now,
    };
    this.store.createSession(record);
    return record;
  }

  /** Enforces idle and absolute timeouts server-side, and rolls the idle clock. */
  read(id: string, now = Date.now()): SessionRecord | null {
    const record = this.store.getSession(id);
    if (!record) return null;
    if (now - record.lastSeenAt > SESSION_IDLE_MS || now - record.createdAt > SESSION_ABSOLUTE_MS) {
      this.store.deleteSession(id);
      return null;
    }
    this.store.touchSession(id, now);
    return record;
  }

  /** Reads a session without rolling its idle clock (the guard already did that). */
  peek(id: string): SessionRecord | null {
    return this.store.getSession(id);
  }

  destroy(id: string): void {
    this.store.deleteSession(id);
  }

  csrfMatches(record: SessionRecord, candidate: string | undefined): boolean {
    return typeof candidate === 'string' && constantTimeEqual(record.csrfToken, candidate);
  }
}
