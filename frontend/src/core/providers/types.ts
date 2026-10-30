import type { ReactNode } from 'react';
import type { ProviderLinks } from '../../../../shared/providers';
import type { AccountSummary } from '../../../../shared/session';

/** The tokens and identity one provider's auth facet has in memory. */
export interface ProviderSession {
  providerId: string;
  providerName: string;
  issuer: string;
  account: AccountSummary | null;
  accessToken: {
    value: string;
    expiresAt: string;
    scopes: string;
  };
  refreshToken?: {
    value: string;
    expiresAt: string;
    grant: string;
  };
}

/**
 * The one browser auth interface each provider folder implements (FE-2). The
 * gateway repeats every check and is the authority; these methods only drive
 * the user experience and hold tokens in memory.
 */
export interface ProviderAuth {
  /** Starts the library's code + PKCE (Entra, Okta) or identity flow (Google). */
  signIn(): Promise<void>;
  /** Handles a provider redirect callback; returns false when it is not one. */
  handleRedirect(url: URL): Promise<boolean>;
  /** The current access token (or Google ID token), or null. */
  getAccessToken(): Promise<string | null>;
  /** Silent renewal where the provider supports it; false when it does not. */
  renew(): Promise<boolean>;
  /** Local-only sign-out: clears memory and the library cache. */
  signOut(): Promise<void>;
  /** The current session, or null. */
  session(): ProviderSession | null;
}

/** One provider's self-contained frontend slice: UI, links and its auth facet. */
export interface FrontendProviderModule {
  readonly id: string;
  readonly name: string;
  readonly ssoDomain: string;
  readonly links: ProviderLinks;
  renderIcon(size: number): ReactNode;
  readonly auth?: ProviderAuth;
}

export interface ProviderRegistry {
  readonly all: readonly FrontendProviderModule[];
  get(id: string): FrontendProviderModule | undefined;
}
