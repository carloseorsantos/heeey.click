import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createHintStore, getHint, localDay, shouldShowHint, HintEvent, HintMap } from '../lib/hints';

/** How long after the board opens a hint shows, whether or not the person is using it */
export const HINT_DELAY_MS = 10_000;
/** After the delay, how often to check again while something else is on screen */
const RETRY_MS = 1_000;

interface UseHintOptions {
  /** Signed-in user, or null for guests (the state lives in this browser) */
  userId: string | null | undefined;
  /** Something else is on screen (another notice, a dialog, an open menu): wait, and hide if showing */
  blocked: boolean;
  /** Checked when the delay ends (e.g. the board has content and the anchor is on screen) */
  canShow: () => boolean;
}

/**
 * One hint's lifecycle: shows it a few seconds after the board opens (as soon as nothing else is on
 * screen), at most once a day, and records what happens (lib/hints.ts). It shows at most once per
 * mount, even if the person signs in or out meanwhile.
 */
export function useHint(hintKey: string, { userId, blocked, canShow }: UseHintOptions) {
  const store = useMemo(() => createHintStore(userId), [userId]);
  const storeRef = useRef(store);
  storeRef.current = store;
  const [hints, setHints] = useState<HintMap | null>(null);
  const [visible, setVisible] = useState(false);
  const shownHere = useRef(false);
  const canShowRef = useRef(canShow);
  canShowRef.current = canShow;
  const blockedRef = useRef(blocked);
  blockedRef.current = blocked;

  useEffect(() => {
    let active = true;
    setHints(null);
    void store.load().then((loaded) => {
      if (active) setHints(loaded);
    });
    return () => {
      active = false;
    };
  }, [store]);

  const record = useCallback(
    (event: HintEvent) => {
      void store.record(hintKey, event).then((state) => {
        // A result from before a sign-in/out belongs to the other store
        if (storeRef.current === store) setHints((current) => current && { ...current, [hintKey]: state });
      });
    },
    [store, hintKey]
  );

  const eligible = hints !== null && !shownHere.current && shouldShowHint(getHint(hints, hintKey), localDay());

  // Fixed delay from when the board opens (not reset by using it); then waits for a free screen
  useEffect(() => {
    if (!eligible || visible) return;
    let retry: ReturnType<typeof setInterval> | undefined;
    const tryShow = () => {
      if (blockedRef.current || !canShowRef.current()) return false;
      shownHere.current = true;
      setVisible(true);
      record('shown');
      return true;
    };
    const timer = setTimeout(() => {
      if (!tryShow()) {
        retry = setInterval(() => {
          if (tryShow()) clearInterval(retry);
        }, RETRY_MS);
      }
    }, HINT_DELAY_MS);
    return () => {
      clearTimeout(timer);
      clearInterval(retry);
    };
  }, [eligible, visible, record]);

  // Something else took the screen: step aside (it already counted as shown today)
  useEffect(() => {
    if (blocked && visible) setVisible(false);
  }, [blocked, visible]);

  /** The person closed the hint: it stops for good */
  const dismiss = useCallback(() => {
    setVisible(false);
    record('dismissed');
  }, [record]);

  /** Out of the way for now, without counting as closed */
  const hide = useCallback(() => setVisible(false), []);

  /** The feature was used, from the hint or anywhere else: the hint stops for good */
  const markUsed = useCallback(() => {
    setVisible(false);
    if (!getHint(hints ?? {}, hintKey)?.usedAt) record('used');
  }, [record, hints, hintKey]);

  // Hidden in the same render something else shows up, not a frame later
  return { visible: visible && !blocked, dismiss, hide, markUsed };
}
