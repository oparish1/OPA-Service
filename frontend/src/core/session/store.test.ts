import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Session } from '../types';
import {
  ABSOLUTE_LIMIT_MS,
  IDLE_LIMIT_MS,
  clearSession,
  getSession,
  hasSession,
  revealToken,
  setOnExpire,
  setSession,
  setSessionLimits,
  updateSession,
} from './store';

const SESSION: Session = {
  provider: 'Microsoft Entra ID',
  providerId: 'entra',
  account: null,
  accessToken: { value: 'access-value', masked: 'ac…ue', expiresAt: 'soon', scopes: 'workspace:read' },
  refreshToken: { value: 'refresh-value', masked: 're…ue', expiresAt: 'later', grant: 'offline_access' },
  issuer: 'https://login.microsoftonline.com/tenant/v2.0',
  issuedAt: 'now',
  snapshot: 'entra · now',
};

beforeEach(() => {
  clearSession();
  setOnExpire(null);
  setSessionLimits({ idleMs: IDLE_LIMIT_MS, absoluteMs: ABSOLUTE_LIMIT_MS });
});

afterEach(() => {
  clearSession();
  setOnExpire(null);
  setSessionLimits({ idleMs: IDLE_LIMIT_MS, absoluteMs: ABSOLUTE_LIMIT_MS });
  vi.useRealTimers();
});

describe('session store', () => {
  it('keeps the session in memory and reveals tokens from it (A6)', () => {
    setSession(SESSION);
    expect(hasSession()).toBe(true);
    expect(getSession()).toEqual(SESSION);
    expect(revealToken('access')).toBe('access-value');
    expect(revealToken('refresh')).toBe('refresh-value');
  });

  it('clears the session on sign-out', () => {
    setSession(SESSION);
    clearSession();
    expect(hasSession()).toBe(false);
    expect(revealToken('access')).toBeNull();
  });

  it('expires after the idle limit and notifies the sign-out hook (A7)', () => {
    vi.useFakeTimers();
    const onExpire = vi.fn();
    setOnExpire(onExpire);
    setSession(SESSION);

    vi.advanceTimersByTime(IDLE_LIMIT_MS - 1);
    expect(hasSession()).toBe(true);
    vi.advanceTimersByTime(1);
    expect(hasSession()).toBe(false);
    expect(onExpire).toHaveBeenCalledOnce();
  });

  it('expires after the absolute limit even with activity (A7)', () => {
    vi.useFakeTimers();
    setSessionLimits({ idleMs: 1000, absoluteMs: 5000 });
    setSession(SESSION);

    for (let i = 0; i < 10; i += 1) vi.advanceTimersByTime(600);
    expect(hasSession()).toBe(false);
  });

  it('keeps the original absolute deadline across a token renewal (A7)', () => {
    vi.useFakeTimers();
    setSessionLimits({ idleMs: 4000, absoluteMs: 5000 });
    const onExpire = vi.fn();
    setOnExpire(onExpire);
    setSession(SESSION);

    vi.advanceTimersByTime(3000);
    updateSession({ ...SESSION, accessToken: { ...SESSION.accessToken, value: 'renewed' } });

    vi.advanceTimersByTime(1999);
    expect(hasSession()).toBe(true);
    vi.advanceTimersByTime(1);
    expect(hasSession()).toBe(false);
    expect(onExpire).toHaveBeenCalledOnce();
  });
});
