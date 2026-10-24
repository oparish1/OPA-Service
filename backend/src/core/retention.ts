import type { AppConfig } from './config';
import type { Services } from './services';

export interface RetentionDeps {
  audit: Pick<Services['audit'], 'purge'>;
  store: Pick<Services['store'], 'purgeExpiredLoginTransactions'>;
}

export interface RetentionLogger {
  error(payload: unknown, message?: string): void;
}

/**
 * Runs the best-effort retention purges independently so a transient storage
 * error in one does not kill the process or skip the other.
 */
export function runRetention(
  services: RetentionDeps,
  config: Pick<AppConfig, 'auditRetentionDays'>,
  logger: RetentionLogger,
  now = Date.now()
): void {
  try {
    services.audit.purge(config.auditRetentionDays, now);
  } catch (error) {
    logger.error({ err: error }, 'audit retention purge failed');
  }
  try {
    services.store.purgeExpiredLoginTransactions(now);
  } catch (error) {
    logger.error({ err: error }, 'login transaction purge failed');
  }
}
