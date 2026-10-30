import type { RunnerAuth, RunnerErrorCode } from '../../../shared/request-runner';
import type {
  SessionAccessToken,
  SessionMetadata,
  SessionRefreshToken,
} from '../../../shared/session';

export type Screen =
  | 'sign-in'
  | 'forgot-password'
  | 'change-password'
  | 'overview'
  | 'account'
  | 'profile-api'
  | 'projects-api';

/** The public provider list from `GET /auth/providers`; icons are a UI concern. */
export type { ProviderInfo } from '../../../shared/providers';
export type { AccountSummary } from '../../../shared/session';

export interface AccessToken extends SessionAccessToken {
  /** Full value revealed by the Reveal action. Empty until revealed by the real client. */
  value: string;
}

export interface RefreshToken extends SessionRefreshToken {
  /** Full value revealed by the Reveal action. Empty until revealed by the real client. */
  value: string;
}

export interface Session
  extends Omit<SessionMetadata, 'accessToken' | 'refreshToken' | 'csrfToken'> {
  accessToken: AccessToken;
  refreshToken: RefreshToken;
  /** True when the provider renews silently without exposing a refresh token. */
  renewable?: boolean;
}

export type ProviderStatus = 'primary' | 'connected' | 'not-connected';

export interface Identity {
  id: string;
  name: string;
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
