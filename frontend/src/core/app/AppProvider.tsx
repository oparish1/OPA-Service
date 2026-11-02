import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { bootstrapSession, signOut as endSession } from '../api';
import { Notice } from '../components/Notice';
import { TextLink } from '../components/TextLink';
import { describeError, log } from '../lib/log';
import type { Screen } from '../mocks/types';
import { setOnExpire } from '../session/store';
import { AppContext } from './app-context';
import type { AppContextValue } from './app-context';

export function AppProvider({
  children,
  initialScreen = 'sign-in',
  bootstrap = bootstrapSession,
  signOut: performSignOut = endSession,
}: {
  children: ReactNode;
  initialScreen?: Screen;
  bootstrap?: () => Promise<boolean>;
  signOut?: () => Promise<void>;
}) {
  const [screen, setScreen] = useState<Screen>(initialScreen);
  const [signOutError, setSignOutError] = useState(false);
  const [signOutReference, setSignOutReference] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void bootstrap()
      .then(signedIn => {
        if (active && signedIn) setScreen('overview');
      })
      .catch(error => {
        log.error('app', 'Session bootstrap failed', { error: describeError(error) });
      });
    return () => {
      active = false;
    };
  }, [bootstrap]);

  const navigate = useCallback((next: Screen) => setScreen(next), []);
  const dismissSignOutError = useCallback(() => {
    setSignOutError(false);
    setSignOutReference(null);
  }, []);

  const signOut = useCallback(async () => {
    setSignOutError(false);
    setSignOutReference(null);
    try {
      await performSignOut();
      setScreen('sign-in');
    } catch (error) {
      const reference = log.error('app', 'Sign-out failed', { error: describeError(error) });
      setSignOutReference(reference);
      setSignOutError(true);
    }
  }, [performSignOut]);

  // The idle/absolute timers live in the store; routing them here makes an
  // expired session clear the provider library and return to sign-in (A7).
  useEffect(() => {
    setOnExpire(() => {
      void signOut();
    });
    return () => setOnExpire(null);
  }, [signOut]);

  const value = useMemo<AppContextValue>(
    () => ({ screen, navigate, signOut, signOutError, dismissSignOutError }),
    [screen, navigate, signOut, signOutError, dismissSignOutError]
  );

  return (
    <AppContext.Provider value={value}>
      {signOutError ? (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 10, padding: 16 }}>
          <Notice
            tone="error"
            heading="We couldn’t sign you out. Try again."
            action={<TextLink onClick={dismissSignOutError}>Dismiss</TextLink>}
            reference={signOutReference ?? undefined}
          />
        </div>
      ) : null}
      {children}
    </AppContext.Provider>
  );
}
