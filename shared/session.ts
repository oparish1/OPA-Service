/** Provider-neutral account summary shown on the session card; one owner across the wire. */
export interface AccountSummary {
  displayName: string;
  email: string;
  organisation: string;
  role: string;
  accountId: string;
  createdAt: string;
}

export interface SessionAccessToken {
  masked: string;
  expiresAt: string;
  scopes: string;
}

export interface SessionRefreshToken {
  masked: string;
  expiresAt: string;
  grant: string;
}

/** The session metadata shape the mock layer produces and the frontend consumes. */
export interface SessionMetadata {
  provider: string;
  providerId: string;
  account: AccountSummary | null;
  accessToken: SessionAccessToken;
  refreshToken: SessionRefreshToken;
  issuer: string;
  issuedAt: string;
  snapshot: string;
  csrfToken: string;
}
