import { describe, expect, it } from 'vitest';
import {
  INVALID_URL_MESSAGE,
  appUrl,
  runnerAuthOptions,
  validateRunnerUrl,
} from './runner-url';

describe('validateRunnerUrl', () => {
  it('accepts http and https URLs', () => {
    expect(validateRunnerUrl('http://localhost:3000/v1/me')).toBeNull();
    expect(validateRunnerUrl('https://api.example/v1/projects?page=1')).toBeNull();
  });

  it('rejects a non-http scheme', () => {
    expect(validateRunnerUrl('ftp://localhost:3000/v1/me')).toBe(INVALID_URL_MESSAGE);
  });

  it('rejects a URL carrying credentials', () => {
    expect(validateRunnerUrl('http://user:pass@localhost:3000/v1/me')).toBe(INVALID_URL_MESSAGE);
  });

  it('rejects text that is not a URL', () => {
    expect(validateRunnerUrl('not a url')).toBe(INVALID_URL_MESSAGE);
  });

  it('rejects a URL longer than the relay limit', () => {
    expect(validateRunnerUrl(`http://localhost:3000/v1/me?x=${'a'.repeat(2100)}`)).toBe(
      INVALID_URL_MESSAGE
    );
  });
});

describe('appUrl', () => {
  it('combines the app origin with a path', () => {
    expect(appUrl('/v1/me')).toBe(`${window.location.origin}/v1/me`);
  });
});

describe('runnerAuthOptions', () => {
  it('lists the four options in the fixed order with the session entry first', () => {
    const options = runnerAuthOptions('at…1234');
    expect(options.map(option => option.value)).toEqual([
      'session',
      'valid-token-123',
      'expired-token',
      'none',
    ]);
    expect(options[0]?.label).toBe('Bearer · at…1234');
    expect(options[1]?.label).toBe('Bearer valid-token-123');
    expect(options[2]?.label).toBe('Bearer expired-token');
    expect(options[3]?.label).toBe('no-token');
  });
});
