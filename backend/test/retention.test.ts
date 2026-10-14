import { describe, expect, it } from 'bun:test';
import { runRetention } from '../src/retention';

describe('retention job error boundary', () => {
  it('runs the login-transaction purge even when the audit purge throws', () => {
    const calls: string[] = [];
    const errors: unknown[] = [];
    expect(() =>
      runRetention(
        {
          audit: {
            purge: () => {
              calls.push('audit');
              throw new Error('audit store unavailable');
            },
          },
          store: {
            purgeExpiredLoginTransactions: () => {
              calls.push('login-transactions');
              return 0;
            },
          },
        },
        { auditRetentionDays: 90 },
        { error: (_payload, message) => errors.push(message) },
        1_000
      )
    ).not.toThrow();
    expect(calls).toEqual(['audit', 'login-transactions']);
    expect(errors).toEqual(['audit retention purge failed']);
  });

  it('runs the audit purge even when the login-transaction purge throws', () => {
    const calls: string[] = [];
    const errors: unknown[] = [];
    expect(() =>
      runRetention(
        {
          audit: {
            purge: () => {
              calls.push('audit');
              return 0;
            },
          },
          store: {
            purgeExpiredLoginTransactions: () => {
              calls.push('login-transactions');
              throw new Error('login store unavailable');
            },
          },
        },
        { auditRetentionDays: 90 },
        { error: (_payload, message) => errors.push(message) },
        1_000
      )
    ).not.toThrow();
    expect(calls).toEqual(['audit', 'login-transactions']);
    expect(errors).toEqual(['login transaction purge failed']);
  });
});
