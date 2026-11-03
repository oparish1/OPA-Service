import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setAppConfig } from '../../../core/config';
import { log } from '../../../core/lib/log';
import { createGoogleAuth } from '../auth';

interface IdConfiguration {
  client_id: string;
  callback: (response: { credential: string }) => void;
  nonce?: string;
}

const AUTH = createGoogleAuth();

function encode(value: unknown): string {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function idToken(payload: Record<string, unknown>): string {
  return `${encode({ alg: 'none', typ: 'JWT' })}.${encode(payload)}.`;
}

let issuedNonce = '';

function installGis(
  credential: () => string,
  behavior: 'credential' | 'dismissed' = 'credential'
): { disableAutoSelect: ReturnType<typeof vi.fn> } {
  const disableAutoSelect = vi.fn();
  window.google = {
    accounts: {
      id: {
        initialize(config: IdConfiguration) {
          issuedNonce = config.nonce ?? '';
          capturedCallback = config.callback;
        },
        prompt(momentListener?: (moment: { isDismissedMoment?: () => boolean }) => void) {
          if (behavior === 'dismissed') {
            momentListener?.({ isDismissedMoment: () => true });
            return;
          }
          capturedCallback({ credential: credential() });
        },
        disableAutoSelect,
      },
    },
  };
  return { disableAutoSelect };
}

let capturedCallback: (response: { credential: string }) => void = () => undefined;

function claims(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    nonce: issuedNonce,
    aud: 'google-client-id',
    iss: 'https://accounts.google.com',
    exp: Math.floor(Date.now() / 1000) + 300,
    hd: 'agentic-advantage.com',
    email_verified: true,
    sub: 'google-sub-1',
    email: 'google.user@agentic-advantage.com',
    name: 'Google Test User',
    ...overrides,
  };
}

beforeEach(async () => {
  setAppConfig({
    gatewayUrl: 'https://localhost:9080',
    providers: [
      {
        id: 'google',
        name: 'Google Workspace / Cloud Identity',
        clientId: 'google-client-id',
        issuer: 'https://accounts.google.com',
        hostedDomain: 'agentic-advantage.com',
        scopes: ['openid', 'email', 'profile'],
      },
    ],
  });
  log.clear();
  vi.spyOn(console, 'debug').mockImplementation(() => undefined);
  vi.spyOn(console, 'info').mockImplementation(() => undefined);
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  await AUTH.signOut();
});

afterEach(() => {
  delete window.google;
  vi.restoreAllMocks();
});

describe('Google auth', () => {
  it('accepts an ID token whose nonce and claims match (A2, A3)', async () => {
    installGis(() => idToken(claims()));
    await AUTH.signIn();
    const session = AUTH.session();
    expect(session?.accessToken.value).toBeTruthy();
    expect(session?.issuer).toBe('https://accounts.google.com');
    expect(session?.renewable).toBe(false);
  });

  it('rejects a wrong nonce (A2)', async () => {
    installGis(() => idToken(claims({ nonce: 'wrong-nonce' })));
    await expect(AUTH.signIn()).rejects.toThrow('We couldn’t sign you in');
  });

  it('settles with the generic error when the prompt is dismissed (FE-7)', async () => {
    installGis(() => idToken(claims()), 'dismissed');
    await expect(AUTH.signIn()).rejects.toThrow('We couldn’t sign you in');
  });

  it('logs a dismissed prompt without the credential', async () => {
    installGis(() => idToken(claims()), 'dismissed');
    await expect(AUTH.signIn()).rejects.toThrow('We couldn’t sign you in');
    const entry = log.recent().find(item => item.message === 'Google prompt was dismissed or suppressed');
    expect(entry?.level).toBe('warn');
    expect(entry?.scope).toBe('google');
    expect(JSON.stringify(entry)).not.toContain('eyJ');
  });

  it('logs a failed claim check without the credential', async () => {
    const credential = idToken(claims({ nonce: 'wrong-nonce' }));
    installGis(() => credential);
    await expect(AUTH.signIn()).rejects.toThrow('We couldn’t sign you in');
    const entry = log.recent().find(item => item.message === 'Credential claim check failed');
    expect(entry?.level).toBe('warn');
    expect(entry?.scope).toBe('google');
    expect(JSON.stringify(entry)).not.toContain(credential);
  });

  it('rejects a wrong audience (A2)', async () => {
    installGis(() => idToken(claims({ aud: 'other-client' })));
    await expect(AUTH.signIn()).rejects.toThrow();
  });

  it('rejects a wrong issuer (A2)', async () => {
    installGis(() => idToken(claims({ iss: 'https://example.com' })));
    await expect(AUTH.signIn()).rejects.toThrow();
  });

  it('rejects a wrong or missing hosted domain (A2)', async () => {
    installGis(() => idToken(claims({ hd: 'other.example' })));
    await expect(AUTH.signIn()).rejects.toThrow();
    installGis(() => {
      const value = claims();
      delete value.hd;
      return idToken(value);
    });
    await expect(AUTH.signIn()).rejects.toThrow();
  });

  it('rejects an unverified email (A2)', async () => {
    installGis(() => idToken(claims({ email_verified: false })));
    await expect(AUTH.signIn()).rejects.toThrow();
  });

  it('never renews and clears memory on sign-out (SD-4, SD-5)', async () => {
    const { disableAutoSelect } = installGis(() => idToken(claims()));
    await AUTH.signIn();
    await expect(AUTH.renew()).resolves.toBe(false);
    await AUTH.signOut();
    expect(AUTH.session()).toBeNull();
    expect(disableAutoSelect).toHaveBeenCalled();
  });
});
