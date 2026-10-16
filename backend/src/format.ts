import type { UserRecord } from './db';

/** Non-sensitive token summary: enough to recognise a token, never enough to use it. */
export function maskToken(value: string): string {
  if (value.length <= 10) return '••••';
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

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
export function formatTimestamp(ms: number): string {
  const date = new Date(ms);
  const day = String(date.getUTCDate()).padStart(2, '0');
  const month = MONTHS[date.getUTCMonth()];
  const year = date.getUTCFullYear();
  const hh = String(date.getUTCHours()).padStart(2, '0');
  const mm = String(date.getUTCMinutes()).padStart(2, '0');
  const ss = String(date.getUTCSeconds()).padStart(2, '0');
  return `${day} ${month} ${year} · ${hh}:${mm}:${ss} UTC`;
}

export interface AccountSummary {
  displayName: string;
  email: string;
  organisation: string;
  role: string;
  accountId: string;
  createdAt: string;
}

export function toAccountSummary(user: UserRecord): AccountSummary {
  return {
    displayName: user.displayName || user.email,
    email: user.email,
    organisation: user.organisation || 'Agentic Advantage',
    role: 'User',
    accountId:
      user.provider === 'entra' ? `acct_${user.oid}` : `acct_${user.provider}_${user.subject}`,
    createdAt: formatTimestamp(user.createdAt),
  };
}
