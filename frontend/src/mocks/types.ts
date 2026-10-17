import type { ApiErrorKind } from '../types';

export * from '../types';

export interface MockConfig {
  /** Latency used by every mock call, in milliseconds. */
  latencyMs: number;
  signInFailure: boolean;
  resetPasswordFailure: boolean;
  changePasswordFailure: boolean;
  refreshTokenFailure: boolean;
  revealTokenFailure: boolean;
  getSessionFailure: boolean;
  getProvidersFailure: boolean;
  getIdentitiesFailure: boolean;
  runRequestFailure: ApiErrorKind | null;
  projectsEmpty: boolean;
  identitiesEmpty: boolean;
}
