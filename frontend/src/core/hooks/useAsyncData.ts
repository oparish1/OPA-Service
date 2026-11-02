import { useCallback, useEffect, useRef, useState } from 'react';
import { describeError, log } from '../lib/log';

const MIN_LOADING_MS = 400;

export type AsyncState<T> =
  | { status: 'loading'; data: null }
  | { status: 'ready'; data: T }
  | { status: 'error'; data: null; reference: string };

/**
 * Loads data on mount and keeps the loading state up for at least
 * MIN_LOADING_MS so the skeleton is perceivable. `reload` retries a failed load.
 */
export function useAsyncData<T>(loader: () => Promise<T>): {
  state: AsyncState<T>;
  reload: () => void;
} {
  const loaderRef = useRef(loader);
  loaderRef.current = loader;
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<AsyncState<T>>({ status: 'loading', data: null });

  useEffect(() => {
    let active = true;
    const started = Date.now();
    setState({ status: 'loading', data: null });
    function settle(next: AsyncState<T>) {
      const wait = Math.max(0, MIN_LOADING_MS - (Date.now() - started));
      setTimeout(() => {
        if (active) setState(next);
      }, wait);
    }
    loaderRef.current().then(
      data => settle({ status: 'ready', data }),
      error => {
        const reference = log.error('data', 'Data load failed', { error: describeError(error) });
        settle({ status: 'error', data: null, reference });
      }
    );
    return () => {
      active = false;
    };
  }, [attempt]);

  const reload = useCallback(() => setAttempt(current => current + 1), []);

  return { state, reload };
}
