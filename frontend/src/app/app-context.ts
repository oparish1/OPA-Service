import { createContext, useContext } from 'react';
import type { Screen } from '../mocks/types';

export interface AppContextValue {
  screen: Screen;
  navigate: (screen: Screen) => void;
  signOut: () => void;
}

export const AppContext = createContext<AppContextValue | null>(null);

export function useApp(): AppContextValue {
  const value = useContext(AppContext);
  if (!value) throw new Error('useApp must be used inside AppProvider');
  return value;
}
