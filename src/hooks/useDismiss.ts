import { useEffect, useRef } from 'react';

/**
 * Closes a popover (menu, dropdown) on outside click or Escape.
 * Returns a ref to attach to the popover's wrapper element.
 */
export function useDismiss<T extends HTMLElement>(isOpen: boolean, onDismiss: () => void) {
  const ref = useRef<T>(null);
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  useEffect(() => {
    if (!isOpen) return;

    function handlePointerDown(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        onDismissRef.current();
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onDismissRef.current();
      }
    }

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  return ref;
}
