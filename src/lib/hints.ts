import { supabase } from './supabase';
import { track } from './analytics';

export type HintEvent = 'shown' | 'dismissed' | 'used';
/** Where a hint's feature was used from: the hint's own button, or the feature's usual control */
export type HintUseSource = 'bubble' | 'direct';

/** When each thing happened (ISO timestamps); a hint shows only while all are null */
export interface HintState {
  shownAt: string | null;
  dismissedAt: string | null;
  usedAt: string | null;
}

export type HintMap = Record<string, HintState>;

/** The hints, in the order they show: one at a time, each only once */
export const HINT_QUEUE = ['export-ai', 'share-board', 'board-search', 'version-history'] as const;
export type HintKey = (typeof HINT_QUEUE)[number];

// Same limits as the database (supabase/migrations/20260928120000_user_hints.sql)
const HINT_KEY = /^[a-z0-9-]{1,64}$/;
const MAX_HINTS = 50;
const EVENT_FIELD: Record<HintEvent, keyof HintState> = { shown: 'shownAt', dismissed: 'dismissedAt', used: 'usedAt' };
const HINT_EVENTS = Object.keys(EVENT_FIELD) as HintEvent[];

const GUEST_HINTS_KEY = 'heeey_hints';
const userCacheKey = (userId: string) => `heeey_hints_${userId}`;

export const EMPTY_HINT: HintState = { shownAt: null, dismissedAt: null, usedAt: null };

export function isHintKey(key: unknown): key is string {
  return typeof key === 'string' && HINT_KEY.test(key);
}

/** A hint's state from a map, ignoring inherited properties (a key like "constructor") */
export function getHint(hints: HintMap, hintKey: string): HintState | undefined {
  return Object.prototype.hasOwnProperty.call(hints, hintKey) ? hints[hintKey] : undefined;
}

/** Whether the hint may still show: never shown, dismissed or used */
export function shouldShowHint(state: HintState | undefined): boolean {
  return !state || (!state.shownAt && !state.dismissedAt && !state.usedAt);
}

/** The next hint to show: the first in the queue that may still show and fits the screen now */
export function pickHint(hints: HintMap, canShow: (hintKey: HintKey) => boolean): HintKey | null {
  return HINT_QUEUE.find((hintKey) => shouldShowHint(getHint(hints, hintKey)) && canShow(hintKey)) ?? null;
}

/** The same rule the database applies, for guests and for the local cache: the first time is kept */
export function applyHintEvent(state: HintState | undefined, event: HintEvent, now = new Date().toISOString()): HintState {
  const current = state ?? EMPTY_HINT;
  const field = EVENT_FIELD[event];
  return current[field] ? current : { ...current, [field]: now };
}

/**
 * Product analytics (PostHog, only when configured): the hint key and, for "used", where from.
 * Never board or user ids, titles or content.
 */
export function trackHint(hintKey: string, event: 'shown' | 'dismissed'): void;
export function trackHint(hintKey: string, event: 'used', source: HintUseSource): void;
export function trackHint(hintKey: string, event: HintEvent, source?: HintUseSource) {
  track(`hint_${event}`, event === 'used' ? { hint: hintKey, source } : { hint: hintKey });
}

// ------------------------------------------------------------------------------
// Parsing: browser storage and server rows are not trusted
// ------------------------------------------------------------------------------
// Only whether it is set matters, so any short string counts (timestamp formats vary by engine)
const isStamp = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 40;

function parseState(value: unknown): HintState | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  const state = { ...EMPTY_HINT };
  for (const field of Object.values(EVENT_FIELD)) {
    const stamp = v[field];
    if (stamp == null) continue;
    if (!isStamp(stamp)) return null;
    state[field] = stamp;
  }
  return state;
}

/** Invalid entries are dropped; anything that is not a map becomes an empty map */
export function parseHints(value: unknown): HintMap {
  const hints: HintMap = {};
  if (!value || typeof value !== 'object' || Array.isArray(value)) return hints;
  for (const [key, entry] of Object.entries(value).slice(0, MAX_HINTS)) {
    const state = isHintKey(key) ? parseState(entry) : null;
    if (state) hints[key] = state;
  }
  return hints;
}

/** A user_hints row (or the jsonb the function returns) as a HintState */
function fromRow(row: unknown): [string, HintState] | null {
  if (!row || typeof row !== 'object') return null;
  const r = row as Record<string, unknown>;
  if (!isHintKey(r.hint_key)) return null;
  const state = parseState({ shownAt: r.shown_at, dismissedAt: r.dismissed_at, usedAt: r.used_at });
  return state ? [r.hint_key, state] : null;
}

function readHints(key: string): HintMap {
  try {
    const raw = localStorage.getItem(key);
    return raw ? parseHints(JSON.parse(raw)) : {};
  } catch {
    return {};
  }
}

function writeHints(key: string, hints: HintMap): void {
  try {
    localStorage.setItem(key, JSON.stringify(hints));
  } catch {
    // Storage blocked or full: the hint just may show again
  }
}

/** Everything either side has recorded */
function mergeHint(a: HintState | undefined, b: HintState | undefined): HintState {
  if (!a || !b) return (a ?? b)!;
  return { shownAt: a.shownAt ?? b.shownAt, dismissedAt: a.dismissedAt ?? b.dismissedAt, usedAt: a.usedAt ?? b.usedAt };
}

function isValidCall(hintKey: string, event: string): boolean {
  if (isHintKey(hintKey) && (HINT_EVENTS as string[]).includes(event)) return true;
  console.warn('Dica inválida ignorada:', hintKey, event);
  return false;
}

// ------------------------------------------------------------------------------
// Stores
// ------------------------------------------------------------------------------
export interface HintStore {
  /** The hints state, read once per store (later calls reuse it). Never rejects */
  load(): Promise<HintMap>;
  /** Records an event and returns the new state of that hint. Never rejects */
  record(hintKey: string, event: HintEvent): Promise<HintState>;
}

/**
 * Where the hints state lives: this browser for guests, the account (user_hints) for signed-in
 * users, with a local cache that keeps the hint's rules on this device when the server is
 * unavailable. Create a new store when the signed-in user changes.
 */
export function createHintStore(userId: string | null | undefined): HintStore {
  return userId ? createAccountHintStore(userId) : createGuestHintStore();
}

function createGuestHintStore(): HintStore {
  return {
    load: async () => readHints(GUEST_HINTS_KEY),
    async record(hintKey, event) {
      const hints = readHints(GUEST_HINTS_KEY);
      if (!isValidCall(hintKey, event)) return getHint(hints, hintKey) ?? EMPTY_HINT;
      const state = applyHintEvent(getHint(hints, hintKey), event);
      writeHints(GUEST_HINTS_KEY, { ...hints, [hintKey]: state });
      return state;
    },
  };
}

function createAccountHintStore(userId: string): HintStore {
  const cacheKey = userCacheKey(userId);
  let loaded: Promise<HintMap> | null = null;

  const save = (hintKey: string, state: HintState) => writeHints(cacheKey, { ...readHints(cacheKey), [hintKey]: state });

  async function fetchHints(): Promise<HintMap> {
    try {
      const { data, error } = await supabase
        .from('user_hints')
        .select('hint_key, shown_at, dismissed_at, used_at')
        .eq('user_id', userId);
      if (error || !Array.isArray(data)) throw new Error(error?.message ?? 'resposta inválida');
      const account: HintMap = {};
      for (const row of data) {
        const entry = fromRow(row);
        if (entry) account[entry[0]] = entry[1];
      }
      // Events that never reached the server (offline, or before the migration) and the guest's
      const withLocal = await sendMissingEvents(account, readHints(cacheKey));
      const merged = await sendMissingEvents(withLocal, readHints(GUEST_HINTS_KEY));
      // Re-read: an event recorded while this was loading must not be lost
      const latest = readHints(cacheKey);
      for (const hintKey of Object.keys(latest)) merged[hintKey] = mergeHint(getHint(merged, hintKey), latest[hintKey]);
      writeHints(cacheKey, merged);
      return merged;
    } catch (e) {
      console.warn('Dicas da conta indisponíveis, usando a cópia local:', e instanceof Error ? e.message : e);
      const local = readHints(cacheKey);
      for (const [hintKey, guest] of Object.entries(readHints(GUEST_HINTS_KEY))) local[hintKey] = mergeHint(getHint(local, hintKey), guest);
      return local;
    }
  }

  return {
    load() {
      loaded ??= fetchHints();
      return loaded;
    },
    async record(hintKey, event) {
      if (!isValidCall(hintKey, event)) return getHint(readHints(cacheKey), hintKey) ?? EMPTY_HINT;
      // Saved locally first, so the hint does not come back if the server is unavailable
      let state = applyHintEvent(getHint(readHints(cacheKey), hintKey), event);
      save(hintKey, state);
      try {
        const { data, error } = await supabase.rpc('record_hint_event', { p_hint_key: hintKey, p_event: event });
        if (error) throw new Error(error.message);
        const entry = fromRow(data);
        if (entry) {
          state = mergeHint(entry[1], state);
          save(hintKey, state);
        }
      } catch (e) {
        console.warn('Não foi possível registrar a dica na conta:', e instanceof Error ? e.message : e);
      }
      const recorded = state;
      if (loaded) loaded = loaded.then((hints) => ({ ...hints, [hintKey]: recorded }));
      return state;
    },
  };
}

/**
 * Sends to the account what this browser recorded and the server did not (the server only ever
 * adds): on sign-in, the guest's state, whose copy stays in the browser so the hints do not come
 * back after signing out; and events recorded here while the server was unavailable.
 */
async function sendMissingEvents(account: HintMap, local: HintMap): Promise<HintMap> {
  const merged = { ...account };
  for (const [hintKey, mine] of Object.entries(local)) {
    const current = getHint(account, hintKey);
    let entry: [string, HintState] | null = null;
    for (const event of HINT_EVENTS) {
      const field = EVENT_FIELD[event];
      if (!mine[field] || current?.[field]) continue;
      try {
        const { data, error } = await supabase.rpc('record_hint_event', { p_hint_key: hintKey, p_event: event });
        if (error) throw new Error(error.message);
        entry = fromRow(data) ?? entry;
      } catch (e) {
        console.warn('Não foi possível levar a dica deste navegador para a conta:', e instanceof Error ? e.message : e);
      }
    }
    // Kept on this device either way
    merged[hintKey] = mergeHint(entry?.[1] ?? current, mine);
  }
  return merged;
}
