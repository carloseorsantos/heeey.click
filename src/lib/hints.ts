import { supabase } from './supabase';

export type HintEvent = 'shown' | 'dismissed' | 'used';

export interface HintState {
  /** Different days (in the person's time zone) the hint was shown on */
  shownDays: number;
  /** YYYY-MM-DD */
  lastShownDay: string | null;
  dismissedAt: string | null;
  usedAt: string | null;
}

export type HintMap = Record<string, HintState>;

/** After being shown on this many different days, a hint stops for good */
export const MAX_HINT_DAYS = 3;

// Same limits as the database (supabase/migrations/20260928120000_user_hints.sql)
const HINT_KEY = /^[a-z0-9-]{1,64}$/;
const HINT_EVENTS: readonly string[] = ['shown', 'dismissed', 'used'];
const MAX_STORED_DAYS = 366;
const MAX_HINTS = 50;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

const GUEST_HINTS_KEY = 'heeey_hints';
const userCacheKey = (userId: string) => `heeey_hints_${userId}`;

export const EMPTY_HINT: HintState = { shownDays: 0, lastShownDay: null, dismissedAt: null, usedAt: null };

export function isHintKey(key: unknown): key is string {
  return typeof key === 'string' && HINT_KEY.test(key);
}

/** A hint's state from a map, ignoring inherited properties (a key like "constructor") */
export function getHint(hints: HintMap, hintKey: string): HintState | undefined {
  return Object.prototype.hasOwnProperty.call(hints, hintKey) ? hints[hintKey] : undefined;
}

/** Whether the hint may show today: not dismissed or used, not seen on 3 days yet, not seen today */
export function shouldShowHint(state: HintState | undefined, today: string): boolean {
  if (!state) return true;
  if (state.dismissedAt || state.usedAt) return false;
  if (state.shownDays >= MAX_HINT_DAYS) return false;
  // A day ahead of today (another time zone) also counts as already shown
  return !state.lastShownDay || state.lastShownDay < today;
}

/** Today in the browser's time zone, as YYYY-MM-DD */
export function localDay(date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** IANA time zone the server uses to count days (it never takes a date from the browser) */
export function localTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

/** The same rules the database applies, for guests and for the local cache */
export function applyHintEvent(state: HintState | undefined, event: HintEvent, today: string, now = new Date().toISOString()): HintState {
  const current = state ?? EMPTY_HINT;
  if (event === 'dismissed') return { ...current, dismissedAt: current.dismissedAt ?? now };
  if (event === 'used') return { ...current, usedAt: current.usedAt ?? now };
  if (current.lastShownDay && today <= current.lastShownDay) return current;
  return { ...current, shownDays: Math.min(current.shownDays + 1, MAX_STORED_DAYS), lastShownDay: today };
}

// ------------------------------------------------------------------------------
// Parsing: browser storage and server rows are not trusted
// ------------------------------------------------------------------------------
function isDay(v: unknown): v is string {
  if (typeof v !== 'string' || !DAY.test(v)) return false;
  // Round trip rejects days like 2026-02-31
  const parsed = new Date(`${v}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === v;
}

// Only whether it is set matters, so any short string counts (timestamp formats vary by engine)
const isStamp = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 40;

function parseState(value: unknown): HintState | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  if (!Number.isInteger(v.shownDays) || (v.shownDays as number) < 0 || (v.shownDays as number) > MAX_STORED_DAYS) return null;
  if (v.lastShownDay != null && !isDay(v.lastShownDay)) return null;
  if (v.dismissedAt != null && !isStamp(v.dismissedAt)) return null;
  if (v.usedAt != null && !isStamp(v.usedAt)) return null;
  return {
    shownDays: v.shownDays as number,
    lastShownDay: (v.lastShownDay as string | undefined) ?? null,
    dismissedAt: (v.dismissedAt as string | undefined) ?? null,
    usedAt: (v.usedAt as string | undefined) ?? null,
  };
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

/** A user_hints row (or the jsonb the functions return) as a HintState */
function fromRow(row: unknown): [string, HintState] | null {
  if (!row || typeof row !== 'object') return null;
  const r = row as Record<string, unknown>;
  if (!isHintKey(r.hint_key)) return null;
  const state = parseState({
    shownDays: r.shown_days,
    lastShownDay: r.last_shown_day,
    dismissedAt: r.dismissed_at,
    usedAt: r.used_at,
  });
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

/** Keeps the furthest progress of both: days seen, and dismissed/used once set */
function mergeHint(a: HintState | undefined, b: HintState | undefined): HintState {
  if (!a || !b) return (a ?? b)!;
  return {
    shownDays: Math.max(a.shownDays, b.shownDays),
    lastShownDay: [a.lastShownDay, b.lastShownDay].filter(Boolean).sort().pop() ?? null,
    dismissedAt: a.dismissedAt ?? b.dismissedAt,
    usedAt: a.usedAt ?? b.usedAt,
  };
}

function isValidCall(hintKey: string, event: string): boolean {
  if (isHintKey(hintKey) && HINT_EVENTS.includes(event)) return true;
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
      const state = applyHintEvent(getHint(hints, hintKey), event, localDay());
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
        .select('hint_key, shown_days, last_shown_day, dismissed_at, used_at')
        .eq('user_id', userId);
      if (error || !Array.isArray(data)) throw new Error(error?.message ?? 'resposta inválida');
      const account: HintMap = {};
      for (const row of data) {
        const entry = fromRow(row);
        if (entry) account[entry[0]] = entry[1];
      }
      // Stops that never reached the server (offline, or before the migration) and the guest's
      const withLocal = await sendMissingStops(account, readHints(cacheKey));
      const merged = await sendMissingStops(withLocal, readHints(GUEST_HINTS_KEY));
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
      let state = applyHintEvent(getHint(readHints(cacheKey), hintKey), event, localDay());
      save(hintKey, state);
      try {
        const { data, error } = await supabase.rpc('record_hint_event', {
          p_hint_key: hintKey,
          p_event: event,
          p_tz: localTimeZone(),
        });
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
 * Sends to the account what this browser knows and the server does not: hints the account has
 * no record of, and "dismissed/used" it lacks (the server only ever adds those). Used on sign-in
 * for the guest's state, whose copy stays in the browser so the hint does not come back after
 * signing out, and for events recorded here while the server was unavailable.
 */
async function sendMissingStops(account: HintMap, local: HintMap): Promise<HintMap> {
  const merged = { ...account };
  for (const [hintKey, mine] of Object.entries(local)) {
    const current = getHint(account, hintKey);
    const needed = current
      ? (!!mine.dismissedAt && !current.dismissedAt) || (!!mine.usedAt && !current.usedAt)
      : mine.shownDays > 0 || !!mine.lastShownDay || !!mine.dismissedAt || !!mine.usedAt;
    if (!needed) {
      if (!current) merged[hintKey] = mine;
      continue;
    }
    let entry: [string, HintState] | null = null;
    try {
      const { data, error } = await supabase.rpc('import_guest_hint', {
        p_hint_key: hintKey,
        p_shown_days: mine.shownDays,
        p_last_shown_day: mine.lastShownDay,
        p_dismissed: !!mine.dismissedAt,
        p_used: !!mine.usedAt,
      });
      if (error) throw new Error(error.message);
      entry = fromRow(data);
    } catch (e) {
      console.warn('Não foi possível levar a dica deste navegador para a conta:', e instanceof Error ? e.message : e);
    }
    // Kept on this device either way
    merged[hintKey] = mergeHint(entry?.[1] ?? current, mine);
  }
  return merged;
}
