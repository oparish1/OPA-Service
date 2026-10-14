import type { AuditLogger } from './audit';
import type { BearerValidator } from './auth/bearer';
import type { OidcService } from './auth/oidc';
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
  oidc: OidcService;
  bearer: BearerValidator;
}
