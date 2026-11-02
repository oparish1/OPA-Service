import { log } from '../lib/log';
import type { Session, TokenKind } from '../types';

/**
 * The only writer of tokens. Everything lives in module memory: nothing here
 * touches localStorage, cookies or IndexedDB, and nothing here makes a network
 * request. SD-9's 30-minute idle and 8-hour absolute limits are enforced here
 * as a courtesy; the gateway enforces the real token lifetime.
 */

export const IDLE_LIMIT_MS = 30 * 60 * 1000;
export const ABSOLUTE_LIMIT_MS = 8 * 60 * 60 * 1000;

export interface SessionStoreLimits {
  idleMs: number;
  absoluteMs: number;
}

const limits: SessionStoreLimits = { idleMs: IDLE_LIMIT_MS, absoluteMs: ABSOLUTE_LIMIT_MS };

let session: Session | null = null;
let idleTimer: ReturnType<typeof setTimeout> | null = null;
let absoluteTimer: ReturnType<typeof setTimeout> | null = null;
let onExpire: (() => void) | null = null;

function clearTimers(): void {
  if (idleTimer !== null) clearTimeout(idleTimer);
  if (absoluteTimer !== null) clearTimeout(absoluteTimer);
  idleTimer = null;
  absoluteTimer = null;
}

function expire(reason: 'idle' | 'absolute'): void {
  log.warn('session', 'Session expired', { reason });
  // The hook reads the provider id from the store to clear the provider
  // library's cache, so it must run before the store is emptied.
  onExpire?.();
  clearSession();
}

export function setSessionLimits(next: Partial<SessionStoreLimits>): void {
  Object.assign(limits, next);
}

export function setOnExpire(callback: (() => void) | null): void {
  onExpire = callback;
}

export function setSession(next: Session): void {
  session = next;
  clearTimers();
  idleTimer = setTimeout(() => expire('idle'), limits.idleMs);
  absoluteTimer = setTimeout(() => expire('absolute'), limits.absoluteMs);
}

/**
 * Replaces the stored session after a token renewal. Renewal is activity, so the
 * idle clock restarts, but the absolute deadline belongs to the original
 * authentication and must not (A7).
 */
export function updateSession(next: Session): void {
  session = next;
  if (absoluteTimer === null) absoluteTimer = setTimeout(() => expire('absolute'), limits.absoluteMs);
  if (idleTimer !== null) clearTimeout(idleTimer);
  idleTimer = setTimeout(() => expire('idle'), limits.idleMs);
}

/** Resets the idle timer; called on a request so activity keeps the session alive. */
export function touch(): void {
  if (!session) return;
  if (idleTimer !== null) clearTimeout(idleTimer);
  idleTimer = setTimeout(() => expire('idle'), limits.idleMs);
}

export function getSession(): Session | null {
  return session;
}

export function hasSession(): boolean {
  return session !== null;
}

export function clearSession(): void {
  session = null;
  clearTimers();
}

export function revealToken(kind: TokenKind): string | null {
  if (!session) return null;
  return kind === 'access' ? session.accessToken.value : session.refreshToken.value;
}
