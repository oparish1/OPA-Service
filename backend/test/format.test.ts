import { describe, expect, it } from 'bun:test';
import { formatTimestamp, maskToken } from '../src/core/format';

describe('formatTimestamp', () => {
  it('renders the approved shape with seconds', () => {
    expect(formatTimestamp(Date.UTC(2026, 9, 10, 13, 30, 0))).toBe('10 Oct 2026 · 13:30:00 UTC');
  });

  it('keeps the seconds from the source instant', () => {
    expect(formatTimestamp(Date.UTC(2026, 0, 2, 3, 4, 5))).toBe('02 Jan 2026 · 03:04:05 UTC');
  });

  it('never emits a dangling colon', () => {
    expect(formatTimestamp(Date.now())).not.toMatch(/:\s+UTC$/);
  });
});

describe('maskToken', () => {
  it('keeps a recognisable head and tail without the full value', () => {
    const masked = maskToken('abcdefghijklmnopqrstuvwxyz');
    expect(masked.startsWith('abcdef')).toBe(true);
    expect(masked).toContain('…');
    expect(masked).not.toContain('ghijklmnopqrstuvwxy');
  });
});
