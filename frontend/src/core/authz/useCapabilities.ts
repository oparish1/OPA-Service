import { useSyncExternalStore } from 'react';
import { getSnapshot, subscribe } from './store';
import type { AuthzState } from './types';

/** Subscribes a component to the one cached capabilities map. */
export function useCapabilities(): AuthzState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
