import { useEffect, useRef } from 'react';

/**
 * Shared listbox behavior: while open, Escape closes it and returns focus to the
 * trigger, and a mousedown outside the wrapper closes it. Owns the two refs the
 * markup needs so callers only provide their open state and close action.
 */
export function useListbox(open: boolean, close: () => void) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef(close);
  closeRef.current = close;

  useEffect(() => {
    if (!open) return;
    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        closeRef.current();
        triggerRef.current?.focus();
      }
    }
    function handlePointer(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        closeRef.current();
      }
    }
    document.addEventListener('keydown', handleKey);
    document.addEventListener('mousedown', handlePointer);
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.removeEventListener('mousedown', handlePointer);
    };
  }, [open]);

  return { wrapperRef, triggerRef };
}
