import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installGlobalHandlers } from './global-handlers';
import { log } from './log';

let cleanup: (() => void) | null = null;

beforeEach(() => {
  log.clear();
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  cleanup = installGlobalHandlers(window);
});

afterEach(() => {
  cleanup?.();
  cleanup = null;
  vi.restoreAllMocks();
});

describe('global handlers', () => {
  it('logs an uncaught error at error level', () => {
    window.dispatchEvent(new ErrorEvent('error', { error: new Error('boom'), message: 'boom' }));
    const entry = log.recent()[0];
    expect(entry.level).toBe('error');
    expect(entry.scope).toBe('window');
    expect(entry.data).toMatchObject({ error: { name: 'Error', message: 'boom' } });
  });

  it('logs an unhandled rejection at error level', () => {
    const event = new Event('unhandledrejection') as PromiseRejectionEvent;
    Object.defineProperty(event, 'reason', { value: new Error('rejected') });
    window.dispatchEvent(event);
    const entry = log.recent()[0];
    expect(entry.level).toBe('error');
    expect(entry.data).toMatchObject({ error: { name: 'Error', message: 'rejected' } });
  });
});
