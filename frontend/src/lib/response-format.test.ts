import { describe, expect, it } from 'vitest';
import { decodeBody, formatDuration, formatSize } from './response-format';

describe('formatDuration', () => {
  it('shows whole milliseconds below one second', () => {
    expect(formatDuration(55)).toBe('55 ms');
    expect(formatDuration(999)).toBe('999 ms');
  });

  it('shows seconds with one decimal from one second', () => {
    expect(formatDuration(1000)).toBe('1.0 s');
    expect(formatDuration(1200)).toBe('1.2 s');
  });
});

describe('formatSize', () => {
  it('shows bytes below 1 KB', () => {
    expect(formatSize(164)).toBe('164 B');
    expect(formatSize(0)).toBe('0 B');
  });

  it('shows KB and MB with one decimal', () => {
    expect(formatSize(1234)).toBe('1.2 KB');
    expect(formatSize(1024 * 1024)).toBe('1.0 MB');
  });

  it('marks a truncated body with the cap plus and the truncation text', () => {
    expect(formatSize(1024 * 1024, true)).toBe('1.0 MB+ · truncated');
  });
});

describe('decodeBody', () => {
  it('returns the parsed value and the json label for parseable JSON', () => {
    expect(decodeBody('application/json; charset=utf-8', '{"a":1}', 7)).toEqual({
      body: { a: 1 },
      bodyKind: 'json',
    });
  });

  it('labels non-JSON text without parsing it', () => {
    expect(decodeBody('text/plain', 'hello', 5)).toEqual({ body: 'hello', bodyKind: 'text' });
    expect(decodeBody(null, 'hello', 5)).toEqual({ body: 'hello', bodyKind: 'text' });
  });

  it('shows a JSON media type whose body does not parse as text', () => {
    expect(decodeBody('application/json', 'not json at all', 15)).toEqual({
      body: 'not json at all',
      bodyKind: 'text',
    });
  });

  it('does not treat a json parameter on a non-JSON media type as JSON', () => {
    expect(decodeBody('text/plain; charset=json', 'hello', 5)).toEqual({
      body: 'hello',
      bodyKind: 'text',
    });
  });

  it('labels an empty body', () => {
    expect(decodeBody('application/json', '', 0)).toEqual({ body: null, bodyKind: 'empty' });
  });

  it('labels a binary body that was not decoded', () => {
    expect(decodeBody('application/octet-stream', '', 25)).toEqual({
      body: null,
      bodyKind: 'binary',
    });
  });

  it('treats a zero-byte non-textual response as empty, not binary', () => {
    expect(decodeBody('application/octet-stream', '', 0)).toEqual({
      body: null,
      bodyKind: 'empty',
    });
  });
});
