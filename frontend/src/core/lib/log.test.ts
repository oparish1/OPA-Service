import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { describeError, installLogBuffer, log, setLogLevel } from './log';

const JWT = 'eyJhbGciOiJub25lIn0.eyJzdWIiOiIxMjM0NTY3ODkwIn0.signature123';

beforeEach(() => {
  log.clear();
  setLogLevel('debug');
  installLogBuffer(true);
  vi.spyOn(console, 'debug').mockImplementation(() => undefined);
  vi.spyOn(console, 'info').mockImplementation(() => undefined);
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  installLogBuffer(false);
  vi.restoreAllMocks();
});

describe('log scrubber', () => {
  it('redacts sensitive keys in the console and the buffer', () => {
    log.error('test', 'payload', {
      access_token: 'token-value',
      Authorization: 'Bearer secret-value',
      code: 'code-value',
      state: 'state-value',
      nonce: 'nonce-value',
      safe: 'visible',
    });

    const entry = log.recent()[0];
    expect(entry.data).toMatchObject({
      access_token: '[redacted]',
      Authorization: '[redacted]',
      code: '[redacted]',
      state: '[redacted]',
      nonce: '[redacted]',
      safe: 'visible',
    });
    const output = JSON.stringify(vi.mocked(console.error).mock.calls[0]);
    expect(output).not.toContain('token-value');
    expect(output).not.toContain('secret-value');
    expect(output).not.toContain('code-value');
    expect(output).not.toContain('state-value');
    expect(output).not.toContain('nonce-value');
  });

  it('redacts a JWT-shaped string', () => {
    log.error('test', 'jwt', { value: JWT });
    expect(log.recent()[0].data).toEqual({ value: '[redacted]' });
  });

  it('redacts code and state query parameters in a URL', () => {
    log.error('test', 'url', { url: 'https://x.test/cb?code=abc&state=def' });
    const data = log.recent()[0].data as { url: string };
    expect(data.url).toBe('https://x.test/cb?code=[redacted]&state=[redacted]');
  });

  it('redacts a PEM private key block', () => {
    log.error('test', 'pem', {
      value: '-----BEGIN PRIVATE KEY-----\nMIIBVwIBADANBgkqhkiG9w0BAQEFAASCAUEwggE9\n-----END PRIVATE KEY-----',
    });
    expect(log.recent()[0].data).toEqual({ value: '[redacted]' });
  });

  it('keeps a describeError provider code in the buffer and console output', () => {
    const error = Object.assign(new Error('login failed'), {
      name: 'AuthApiError',
      errorCode: 'E0000004',
      errorSummary: 'Authentication failed',
    });
    log.error('okta', 'Sign-in failed', { error: describeError(error) });
    const entry = log.recent()[0];
    expect(entry.data).toMatchObject({
      error: { name: 'AuthApiError', code: 'E0000004', summary: 'Authentication failed' },
    });
    expect(JSON.stringify(vi.mocked(console.error).mock.calls[0])).toContain('E0000004');
  });

  it('truncates strings to 300 characters and arrays to 20 items', () => {
    log.error('test', 'limits', {
      text: 'a'.repeat(400),
      items: Array.from({ length: 25 }, (_, index) => index),
    });
    const data = log.recent()[0].data as { text: string; items: number[] };
    expect(data.text).toHaveLength(300);
    expect(data.items).toHaveLength(20);
  });
});

describe('describeError', () => {
  it('describes a plain string', () => {
    expect(describeError('offline')).toEqual({ message: 'offline' });
  });

  it('describes a standard Error', () => {
    expect(describeError(new TypeError('Failed to fetch'))).toEqual({
      name: 'TypeError',
      message: 'Failed to fetch',
    });
  });

  it('describes an MSAL-style error with a code and sub-error', () => {
    const error = Object.assign(new Error('interaction required'), {
      name: 'InteractionRequiredAuthError',
      errorCode: 'interaction_required',
      subError: 'consent_required',
    });
    expect(describeError(error)).toEqual({
      name: 'InteractionRequiredAuthError',
      code: 'interaction_required',
      summary: 'consent_required',
      message: 'interaction required',
    });
  });

  it('describes an Okta-style error with a code and summary', () => {
    const error = Object.assign(new Error('login failed'), {
      name: 'AuthApiError',
      errorCode: 'E0000004',
      errorSummary: 'Authentication failed',
    });
    expect(describeError(error)).toEqual({
      name: 'AuthApiError',
      code: 'E0000004',
      summary: 'Authentication failed',
      message: 'login failed',
    });
  });

  it('describes a fetch failure with its HTTP status', () => {
    const error = Object.assign(new Error('Not Found'), { status: 404 });
    expect(describeError(error)).toEqual({ name: 'Error', message: 'Not Found', status: 404 });
  });
});

describe('log levels and buffer', () => {
  it('suppresses console output below the configured level but keeps every entry', () => {
    setLogLevel('warn');
    log.debug('test', 'debug');
    log.info('test', 'info');
    const reference = log.warn('test', 'warn');
    log.error('test', 'error');

    expect(console.debug).not.toHaveBeenCalled();
    expect(console.info).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalledTimes(1);
    expect(console.error).toHaveBeenCalledTimes(1);

    // A suppressed entry is still buffered, so a returned reference stays resolvable.
    expect(log.recent().map(entry => entry.level)).toEqual(['debug', 'info', 'warn', 'error']);
    expect(log.recent().some(entry => entry.reference === reference)).toBe(true);
  });

  it('keeps only the last 200 entries', () => {
    for (let index = 0; index < 205; index += 1) log.error('test', `entry ${index}`);
    const recent = log.recent();
    expect(recent).toHaveLength(200);
    expect(recent[0].message).toBe('entry 5');
    expect(recent[199].message).toBe('entry 204');
  });

  it('returns a six-hex reference that is also in the entry', () => {
    const reference = log.error('test', 'failure');
    expect(reference).toMatch(/^[0-9a-f]{6}$/);
    expect(log.recent()[0].reference).toBe(reference);
  });

  it('exposes window.__logs only for a development build', () => {
    log.error('test', 'visible');
    expect(window.__logs).toHaveLength(1);
    installLogBuffer(false);
    expect(window.__logs).toBeUndefined();
  });
});
