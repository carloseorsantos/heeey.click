import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  createHintStore,
  getHint,
  pickHint,
  shouldShowHint,
  trackHint,
  HINT_QUEUE,
  HintEvent,
  HintKey,
  HintMap,
  HintStore,
  HintUseSource,
} from '../lib/hints';

/** How long the screen must be free (after the board opens or the previous hint goes away) before a hint shows */
export const HINT_DELAY_MS = 10_000;
/** After the delay, how often to check again while no hint fits the screen yet */
const RETRY_MS = 1_000;

interface UseHintQueueOptions {
  /** Signed-in user, or null for guests (the state lives in this browser) */
  userId: string | null | undefined;
  /** Something of this page is on screen (another notice, one of its dialogs): wait, and hide if showing */
  blocked: boolean;
  /** The same for what only the page's DOM knows (an open menu, a dialog from elsewhere); rechecked as it changes */
  isBusy: () => boolean;
  /** Whether this hint fits the screen right now (e.g. the board has content and its anchor is visible) */
  canShow: (hintKey: HintKey) => boolean;
}

/**
 * The board hints (lib/hints.ts), one at a time: each shows after the screen has been free of
 * anything else for a few seconds, counted from when the board opens or the previous hint goes
 * away. Each hint shows only once, and each shows at most once per mount, even if the person
 * signs in or out meanwhile.
 */
export function useHintQueue({ userId, blocked, isBusy, canShow }: UseHintQueueOptions) {
  const store = useMemo(() => createHintStore(userId), [userId]);
  const storeRef = useRef(store);
  storeRef.current = store;
  const [hints, setHints] = useState<HintMap | null>(null);
  const hintsRef = useRef(hints);
  hintsRef.current = hints;
  const [current, setCurrent] = useState<HintKey | null>(null);
  const shownHere = useRef(new Set<HintKey>());
  const usedHere = useRef<{ store: HintStore; keys: Set<HintKey> } | null>(null);
  const canShowRef = useRef(canShow);
  canShowRef.current = canShow;
  const isBusyRef = useRef(isBusy);
  isBusyRef.current = isBusy;
  const [busy, setBusy] = useState(false);
  const screenTaken = blocked || busy;

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
    (hintKey: HintKey, event: HintEvent) => {
      void store.record(hintKey, event).then((state) => {
        // A result from before a sign-in/out belongs to the other store
        if (storeRef.current === store) setHints((latest) => latest && { ...latest, [hintKey]: state });
      });
    },
    [store]
  );

  const loaded = hints !== null;
  const pending = (hintKey: HintKey) => !shownHere.current.has(hintKey) && shouldShowHint(getHint(hintsRef.current ?? {}, hintKey));
  const anyLeft = loaded && HINT_QUEUE.some(pending);

  // Menus and dialogs open and close through the DOM, so it is watched while a hint is showing or left
  const watching = anyLeft || current !== null;
  useEffect(() => {
    if (!watching) return;
    const check = () => setBusy(isBusyRef.current());
    check();
    const observer = new MutationObserver(check);
    observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['aria-expanded', 'aria-modal'] });
    return () => observer.disconnect();
  }, [watching]);

  // Starts over whenever the screen is taken, so a hint never pops up right as a dialog closes
  useEffect(() => {
    if (!anyLeft || current || screenTaken) return;
    let retry: ReturnType<typeof setInterval> | undefined;
    /** true when the queue is done for now: a hint showed, or none is left */
    const tryShow = () => {
      if (!HINT_QUEUE.some(pending)) return true;
      const next = pickHint(hintsRef.current ?? {}, (hintKey) => pending(hintKey) && canShowRef.current(hintKey));
      if (!next) return false;
      shownHere.current.add(next);
      setCurrent(next);
      record(next, 'shown');
      trackHint(next, 'shown');
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
  }, [anyLeft, current, screenTaken, record]);

  // Something else took the screen: step aside (it already counted as shown) and let the next one wait
  useEffect(() => {
    if (screenTaken && current) setCurrent(null);
  }, [screenTaken, current]);

  /** The person closed the hint (X, or Esc from inside it) */
  const dismiss = useCallback(() => {
    if (!current) return;
    setCurrent(null);
    record(current, 'dismissed');
    trackHint(current, 'dismissed');
  }, [current, record]);

  /** Out of the way (Esc meant for something else); it already counted as shown */
  const hide = useCallback(() => setCurrent(null), []);

  /** The hint's feature was used, from the hint or from its usual control: that hint never shows again */
  const markUsed = useCallback(
    (hintKey: HintKey, source: HintUseSource) => {
      setCurrent((showing) => (showing === hintKey ? null : showing));
      // Only the first use counts: once per store, since a second use can come before the state updates
      if (usedHere.current?.store !== store) usedHere.current = { store, keys: new Set() };
      if (usedHere.current.keys.has(hintKey) || (hints && getHint(hints, hintKey)?.usedAt)) return;
      usedHere.current.keys.add(hintKey);
      // Taken before recording, so it tells whether this is the first use. While a signed-in
      // user's state is still loading it already includes this use, and it is not tracked
      const before = store.load();
      // Recorded right away (repeating it is harmless), so the hint stops even if the page closes soon after
      record(hintKey, 'used');
      void before.then((state) => {
        if (!getHint(state, hintKey)?.usedAt) trackHint(hintKey, 'used', source);
      });
    },
    [store, hints, record]
  );

  // Hidden in the same render something else shows up, not a frame later
  return {
    current: screenTaken ? null : current,
    /** Hints that may still show on this board, once loaded (e.g. to skip work for a finished hint) */
    remaining: loaded ? HINT_QUEUE.filter(pending) : [],
    dismiss,
    hide,
    markUsed,
  };
}
