import type { ProviderId } from '../../shared/providers';
import type { RunnerAuth, RunnerErrorCode } from '../../shared/request-runner';

export type Screen =
  | 'sign-in'
  | 'forgot-password'
  | 'change-password'
  | 'overview'
  | 'account'
  | 'profile-api'
  | 'projects-api';

export interface ProviderConfig {
  id: ProviderId;
  name: string;
  icon: string;
  ssoDomain: string;
}

/** The public provider list from `GET /auth/providers`; icons are a UI concern. */
export interface ProviderInfo {
  id: string;
  name: string;
  forgotPasswordUrl?: string;
  changePasswordUrl?: string;
  manageAccountUrl?: string;
}

export interface AccountSummary {
  displayName: string;
  email: string;
  organisation: string;
  role: string;
  accountId: string;
  createdAt: string;
}

export interface AccessToken {
  /** Masked value shown by default in the token card. */
  masked: string;
  /** Full value revealed by the Reveal action. Empty until revealed by the real client. */
  value: string;
  expiresAt: string;
  scopes: string;
}

export interface RefreshToken {
  masked: string;
  value: string;
  expiresAt: string;
  grant: string;
}

export interface Session {
  provider: string;
  account: AccountSummary | null;
  accessToken: AccessToken;
  refreshToken: RefreshToken;
  issuer: string;
  issuedAt: string;
  snapshot: string;
}

export type ProviderStatus = 'primary' | 'connected' | 'not-connected';

export interface Identity {
  id: string;
  name: string;
  icon: string;
  subtitle: string;
  status: ProviderStatus;
  /** Absent when the provider has no configured account-management destination. */
  manageUrl?: string;
}

export type BodyKind = 'json' | 'text' | 'empty' | 'binary';

export type { RunnerAuth, RunnerErrorCode };

export interface ApiResponse {
  status: number;
  statusLabel: string;
  duration: string;
  size: string;
  timestamp: string;
  body: unknown;
  headers: string[];
  bodyKind?: BodyKind;
  sizeBytes?: number;
  errorCode?: RunnerErrorCode;
}

export type ApiErrorKind = 'unauthorized' | 'forbidden' | 'notFound' | 'server' | 'timeout';

export type TokenKind = 'access' | 'refresh';
