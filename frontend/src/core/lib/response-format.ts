import type { BodyKind } from '../types';

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

/** Approved display format: `10 Oct 2026 · 13:30:00 UTC`. */
export function formatTimestamp(date = new Date()): string {
  const day = String(date.getUTCDate()).padStart(2, '0');
  const month = MONTHS[date.getUTCMonth()];
  const year = date.getUTCFullYear();
  const hh = String(date.getUTCHours()).padStart(2, '0');
  const mm = String(date.getUTCMinutes()).padStart(2, '0');
  const ss = String(date.getUTCSeconds()).padStart(2, '0');
  return `${day} ${month} ${year} · ${hh}:${mm}:${ss} UTC`;
}

/** Whole milliseconds below one second, otherwise seconds with one decimal. */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}

/** Bytes below 1 KB, then KB/MB with one decimal; the cap carries a `+ · truncated`. */
export function formatSize(bytes: number, truncated = false): string {
  let value: string;
  if (bytes < 1024) value = `${bytes} B`;
  else if (bytes < 1024 * 1024) value = `${(bytes / 1024).toFixed(1)} KB`;
  else value = `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return truncated ? `${value}+ · truncated` : value;
}

/** The media type without parameters; a JSON base type is the only JSON signal. */
function isJsonContentType(contentType: string | null): boolean {
  const type = contentType?.split(';')[0]?.trim().toLowerCase() ?? '';
  return type.includes('json');
}

/**
 * Names the body treatment and its value from one decision. An empty retained
 * body is binary when bytes arrived and empty otherwise; a JSON media type is
 * labelled JSON only when the text parses, so a non-parsing or mislabelled body
 * is shown as text rather than under a JSON label.
 */
export function decodeBody(
  contentType: string | null,
  text: string,
  size: number
): { body: unknown; bodyKind: BodyKind } {
  if (!text) return { body: null, bodyKind: size > 0 ? 'binary' : 'empty' };
  if (!isJsonContentType(contentType)) return { body: text, bodyKind: 'text' };
  try {
    return { body: JSON.parse(text), bodyKind: 'json' };
  } catch {
    // log-exempt: a non-JSON body is a display fallback, not a failure.
    return { body: text, bodyKind: 'text' };
  }
}
