import type { BodyKind } from '../types';

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
    return { body: text, bodyKind: 'text' };
  }
}
