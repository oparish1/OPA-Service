import type { ProviderConfig } from '../../../../shared/app-config';
import { getProviderConfig } from '../../core/config';
import { claimString } from '../../core/lib/claims';
import { describeError, log } from '../../core/lib/log';
import { formatTimestamp } from '../../core/lib/response-format';
import type { ProviderAuth, ProviderSession } from '../../core/providers/types';

/**
 * Google's auth facet. Google Identity Services returns an ID token through a
 * callback; this module generates and verifies the `nonce` and checks `aud`,
 * `iss`, `exp`, `hd` and `email_verified` for the user experience only. The
 * gateway repeats every check and is the authority (FE-3, A2). Google has no
 * renewal, so `renew()` is always false (SD-4).
 */

const PROVIDER_ID = 'google';
const PROVIDER_NAME = 'Google Workspace / Cloud Identity';
const GOOGLE_ISSUER = 'https://accounts.google.com';
const GIS_SRC = 'https://accounts.google.com/gsi/client';
const GENERIC_ERROR = 'We couldn’t sign you in. Try again.';

interface GoogleCredentialResponse {
  credential: string;
}

interface GoogleIdConfiguration {
  client_id: string;
  callback: (response: GoogleCredentialResponse) => void;
  nonce?: string;
  auto_select?: boolean;
  use_fedcm_for_prompt?: boolean;
}

/** The subset of GIS's `PromptMomentNotification` the dismissal check reads. */
interface GooglePromptMoment {
  isNotDisplayed?(): boolean;
  isSkippedMoment?(): boolean;
  isDismissedMoment?(): boolean;
}

interface GoogleAccountsId {
  initialize(config: GoogleIdConfiguration): void;
  prompt(momentListener?: (moment: GooglePromptMoment) => void): void;
  disableAutoSelect(): void;
}

declare global {
  interface Window {
    google?: { accounts?: { id?: GoogleAccountsId } };
  }
}

let current: ProviderSession | null = null;
let pendingNonce: string | null = null;
let scriptPromise: Promise<GoogleAccountsId> | null = null;

function config(): ProviderConfig {
  const value = getProviderConfig(PROVIDER_ID);
  if (!value) throw new Error('Google is not configured');
  return value;
}

function loadGis(): Promise<GoogleAccountsId> {
  const existing = window.google?.accounts?.id;
  if (existing) return Promise.resolve(existing);
  if (!scriptPromise) {
    scriptPromise = new Promise<GoogleAccountsId>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = GIS_SRC;
      script.async = true;
      script.onload = () => {
        const id = window.google?.accounts?.id;
        if (id) resolve(id);
        else reject(new Error(GENERIC_ERROR));
      };
      script.onerror = () => {
        log.error(PROVIDER_ID, 'Google Identity Services script failed to load');
        reject(new Error(GENERIC_ERROR));
      };
      document.head.appendChild(script);
    });
  }
  return scriptPromise;
}

function base64url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function randomNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return base64url(bytes);
}

function decodePayload(token: string): Record<string, unknown> {
  const part = token.split('.')[1] ?? '';
  const padded = part.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(part.length / 4) * 4, '=');
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, character => character.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes)) as Record<string, unknown>;
}

function assertCredential(token: string): ProviderSession {
  const provider = config();
  const claims = decodePayload(token);
  const now = Math.floor(Date.now() / 1000);
  const exp = typeof claims.exp === 'number' ? claims.exp : 0;
  const valid =
    pendingNonce !== null &&
    claims.nonce === pendingNonce &&
    claims.aud === provider.clientId &&
    claims.iss === GOOGLE_ISSUER &&
    exp > now &&
    claims.email_verified === true &&
    provider.hostedDomain !== undefined &&
    claims.hd === provider.hostedDomain;
  if (!valid) throw new Error(GENERIC_ERROR);
  const email = claimString(claims.email);
  return {
    providerId: PROVIDER_ID,
    providerName: PROVIDER_NAME,
    issuer: GOOGLE_ISSUER,
    rawClaims: claims,
    account: {
      displayName: claimString(claims.name) || email,
      email,
      organisation: claimString(claims.hd),
      role: '',
      accountId: claimString(claims.sub),
      createdAt: '—',
    },
    accessToken: {
      value: token,
      expiresAt: formatTimestamp(new Date(exp * 1000)),
      scopes: '',
    },
    // An ID token lasts about an hour and Google has no renewal (SD-4).
    renewable: false,
  };
}

export function createGoogleAuth(): ProviderAuth {
  return {
    async signIn() {
      const gis = await loadGis();
      pendingNonce = randomNonce();
      await new Promise<void>((resolve, reject) => {
        try {
          gis.initialize({
            client_id: config().clientId,
            nonce: pendingNonce ?? undefined,
            callback: response => {
              try {
                current = assertCredential(response.credential);
                resolve();
              } catch (error) {
                log.warn(PROVIDER_ID, 'Credential claim check failed', {
                  error: describeError(error),
                });
                reject(new Error(GENERIC_ERROR));
              }
            },
          });
        } catch (error) {
          log.error(PROVIDER_ID, 'Google Identity Services initialization failed', {
            error: describeError(error),
          });
          reject(new Error(GENERIC_ERROR));
          return;
        }
        // A dismissed or undisplayed prompt never fires the credential
        // callback, so settle the promise here instead of hanging (FE-7).
        gis.prompt(moment => {
          if (
            moment.isNotDisplayed?.() ||
            moment.isSkippedMoment?.() ||
            moment.isDismissedMoment?.()
          ) {
            log.warn(PROVIDER_ID, 'Google prompt was dismissed or suppressed', {
              notDisplayed: moment.isNotDisplayed?.() ?? false,
              skipped: moment.isSkippedMoment?.() ?? false,
              dismissed: moment.isDismissedMoment?.() ?? false,
            });
            reject(new Error(GENERIC_ERROR));
          }
        });
      });
    },

    // Google Identity Services returns a credential through a callback, never
    // through a navigation, so there is no redirect to handle.
    async handleRedirect() {
      return 'ignored';
    },

    async getAccessToken() {
      return current?.accessToken.value ?? null;
    },

    async renew() {
      return false;
    },

    async signOut() {
      current = null;
      pendingNonce = null;
      window.google?.accounts?.id?.disableAutoSelect();
    },

    session() {
      return current;
    },
  };
}
