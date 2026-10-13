import { useCallback, useEffect, useRef, useState } from 'react';

const COPIED_FEEDBACK_MS = 2000;

export type CopyStatus = 'idle' | 'copied' | 'failed';

/** Swaps a copy control to its "Copied" affordance for two seconds, or to a failure state. */
export function useCopyFeedback(): { status: CopyStatus; copy: (text: string) => void } {
  const [status, setStatus] = useState<CopyStatus>('idle');
  const timer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    []
  );

  const copy = useCallback((text: string) => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    const clipboard = navigator.clipboard;
    if (!clipboard?.writeText) {
      setStatus('failed');
      return;
    }
    clipboard.writeText(text).then(
      () => {
        setStatus('copied');
        timer.current = window.setTimeout(() => setStatus('idle'), COPIED_FEEDBACK_MS);
      },
      () => setStatus('failed')
    );
  }, []);

  return { status, copy };
}
