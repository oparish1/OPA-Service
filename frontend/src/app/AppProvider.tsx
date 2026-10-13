import { useCallback, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { signOut as clearSession } from '../mocks/api';
import type { Screen } from '../mocks/types';
import { AppContext } from './app-context';
import type { AppContextValue } from './app-context';

export function AppProvider({
  children,
  initialScreen = 'sign-in',
}: {
  children: ReactNode;
  initialScreen?: Screen;
}) {
  const [screen, setScreen] = useState<Screen>(initialScreen);

  const navigate = useCallback((next: Screen) => setScreen(next), []);

  const signOut = useCallback(() => {
    clearSession();
    setScreen('sign-in');
  }, []);

  const value = useMemo<AppContextValue>(
    () => ({ screen, navigate, signOut }),
    [screen, navigate, signOut]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
