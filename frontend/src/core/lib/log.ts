export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  time: string;
  level: LogLevel;
  scope: string;
  message: string;
  data?: unknown;
  reference: string;
}

export interface ErrorDescription {
  name?: string;
  code?: string;
  summary?: string;
  message?: string;
  status?: number;
}

const LEVEL_ORDER: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };
const BUFFER_LIMIT = 200;
const STRING_LIMIT = 300;
const ARRAY_LIMIT = 20;
const DEPTH_LIMIT = 6;

const SENSITIVE_KEY = /^(token|secret|password|authorization|credential|code|state|nonce|verifier|assertion|cookie)$/i;
const JWT = /[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g;
const PEM = /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g;
const SENSITIVE_PARAM = /([?&#](?:code|state|id_token|access_token|refresh_token)=)[^&#\s]+/gi;
const BEARER = /\bBearer\s+[A-Za-z0-9._~+/-]+=*/gi;

const buffer: LogEntry[] = [];
let currentLevel: LogLevel = defaultLogLevel();

declare global {
  interface Window {
    __logs?: LogEntry[];
  }
}

export function defaultLogLevel(): LogLevel {
  return import.meta.env.DEV ? 'debug' : 'warn';
}

export function setLogLevel(level: LogLevel): void {
  currentLevel = level;
}

export function getLogLevel(): LogLevel {
  return currentLevel;
}

/** Exposes the live in-memory buffer only when the caller says this is a development build. */
export function installLogBuffer(development: boolean): void {
  if (development) window.__logs = buffer;
  else delete window.__logs;
}

function reference(): string {
  const bytes = new Uint8Array(3);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}

function isSensitiveKey(key: string): boolean {
  const normalized = key.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
  return normalized.split(/[^a-z0-9]+/).some(part => SENSITIVE_KEY.test(part));
}

function scrubString(value: string): string {
  const redacted = value
    .replace(PEM, '[redacted]')
    .replace(JWT, '[redacted]')
    .replace(SENSITIVE_PARAM, '$1[redacted]')
    .replace(BEARER, 'Bearer [redacted]');
  return redacted.length > STRING_LIMIT ? `${redacted.slice(0, STRING_LIMIT - 1)}…` : redacted;
}

function scrub(value: unknown, depth = 0, seen = new WeakSet<object>()): unknown {
  if (typeof value === 'string') return scrubString(value);
  if (value === null || typeof value !== 'object') return value;
  if (depth >= DEPTH_LIMIT) return '[truncated]';
  if (seen.has(value)) return '[circular]';
  seen.add(value);

  if (Array.isArray(value)) {
    return value.slice(0, ARRAY_LIMIT).map(item => scrub(item, depth + 1, seen));
  }

  if (value instanceof Error) return describeError(value);

  const result: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    result[key] = isSensitiveKey(key) ? '[redacted]' : scrub(entry, depth + 1, seen);
  }
  return result;
}

function stringField(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  return typeof value === 'string' ? scrubString(value) : undefined;
}

/** Extracts only the fields a log or notice may carry from any provider or fetch error. */
export function describeError(error: unknown): ErrorDescription {
  if (typeof error === 'string') return { message: scrubString(error) };
  if (!error || typeof error !== 'object') return { message: String(error) };

  const record = error as Record<string, unknown>;
  const description: ErrorDescription = {};
  const name = stringField(record, 'name');
  if (name) description.name = name;

  const code = stringField(record, 'errorCode') ?? stringField(record, 'code');
  if (code) description.code = code;

  const summary =
    stringField(record, 'errorSummary') ??
    stringField(record, 'subError') ??
    stringField(record, 'summary');
  if (summary) description.summary = summary;

  const message = stringField(record, 'message');
  if (message) description.message = message;

  const response = record.response;
  const status =
    typeof record.status === 'number'
      ? record.status
      : response && typeof response === 'object' && typeof (response as { status?: unknown }).status === 'number'
        ? (response as { status: number }).status
        : undefined;
  if (status !== undefined) description.status = status;

  return description;
}

function write(level: LogLevel, scope: string, message: string, data?: unknown): string {
  const code = reference();
  if (LEVEL_ORDER[level] < LEVEL_ORDER[currentLevel]) return code;

  const entry: LogEntry = {
    time: new Date().toISOString(),
    level,
    scope,
    message: scrubString(message),
    data: data === undefined ? undefined : scrub(data),
    reference: code,
  };
  buffer.push(entry);
  if (buffer.length > BUFFER_LIMIT) buffer.shift();

  const output = [`[${level}] ${entry.scope}: ${entry.message}`, entry.data ?? '', `Reference: ${code}`];
  if (level === 'error') console.error(...output);
  else if (level === 'warn') console.warn(...output);
  else if (level === 'info') console.info(...output);
  else console.debug(...output);

  return code;
}

export const log = {
  debug(scope: string, message: string, data?: unknown): string {
    return write('debug', scope, message, data);
  },
  info(scope: string, message: string, data?: unknown): string {
    return write('info', scope, message, data);
  },
  warn(scope: string, message: string, data?: unknown): string {
    return write('warn', scope, message, data);
  },
  error(scope: string, message: string, data?: unknown): string {
    return write('error', scope, message, data);
  },
  recent(): LogEntry[] {
    return [...buffer];
  },
  clear(): void {
    buffer.length = 0;
  },
};
