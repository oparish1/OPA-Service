import type { AuditLogger } from './audit';
import type { ProviderRegistry } from './provider';
import type { SessionService } from './auth/session';
import type { AppConfig } from './config';
import type { TokenCipher } from './crypto';
import type { Store } from './db';

export interface Services {
  config: AppConfig;
  store: Store;
  cipher: TokenCipher;
  audit: AuditLogger;
  session: SessionService;
  providers: ProviderRegistry;
}
