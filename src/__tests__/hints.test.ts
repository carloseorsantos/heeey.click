import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { supabase } from '../lib/supabase';
import {
  shouldShowHint,
  applyHintEvent,
  parseHints,
  localDay,
  localTimeZone,
  createHintStore,
  getHint,
  EMPTY_HINT,
  HintState,
} from '../lib/hints';

const store = new Map<string, string>();
let storageBlocked = false;
globalThis.localStorage = {
  getItem: (key: string) => {
    if (storageBlocked) throw new Error('SecurityError');
    return store.get(key) ?? null;
  },
  setItem: (key: string, value: string) => {
    if (storageBlocked) throw new Error('SecurityError');
    store.set(key, value);
  },
  removeItem: (key: string) => store.delete(key),
  clear: () => store.clear(),
  get length() {
    return store.size;
  },
  key: (i: number) => Array.from(store.keys())[i] ?? null,
} as any;

const state = (s: Partial<HintState>): HintState => ({ ...EMPTY_HINT, ...s });
const TODAY = '2026-09-26';
const YESTERDAY = '2026-09-25';
const row = (hint_key: string, s: Partial<{ shown_days: number; last_shown_day: string | null; dismissed_at: string | null; used_at: string | null }> = {}) => ({
  hint_key,
  shown_days: 0,
  last_shown_day: null,
  dismissed_at: null,
  used_at: null,
  ...s,
});

/** Mocks `from('user_hints').select().eq()` */
function mockHintsTable(result: { data: any; error: any }) {
  const chain: any = { select: vi.fn(() => chain), eq: vi.fn().mockResolvedValue(result) };
  const from = vi.spyOn(supabase, 'from').mockReturnValue(chain);
  return { from, chain };
}

function mockRpc(impl: (fn: string, args: any) => { data: any; error: any }) {
  return vi.spyOn(supabase, 'rpc').mockImplementation(((fn: string, args: any) => Promise.resolve(impl(fn, args))) as any);
}

describe('hint rules', () => {
  it('shows a hint at most once a day and stops for good', () => {
    expect(shouldShowHint(undefined, TODAY)).toBe(true);
    expect(shouldShowHint(EMPTY_HINT, TODAY)).toBe(true);
    expect(shouldShowHint(state({ shownDays: 1, lastShownDay: TODAY }), TODAY)).toBe(false);
    expect(shouldShowHint(state({ shownDays: 1, lastShownDay: YESTERDAY }), TODAY)).toBe(true);
    expect(shouldShowHint(state({ shownDays: 2, lastShownDay: YESTERDAY }), TODAY)).toBe(true);
    expect(shouldShowHint(state({ shownDays: 3, lastShownDay: YESTERDAY }), TODAY)).toBe(false);
    expect(shouldShowHint(state({ dismissedAt: '2026-09-20T10:00:00Z' }), TODAY)).toBe(false);
    expect(shouldShowHint(state({ usedAt: '2026-09-20T10:00:00Z' }), TODAY)).toBe(false);
    // A day ahead (another time zone) counts as already shown today
    expect(shouldShowHint(state({ shownDays: 1, lastShownDay: '2026-09-27' }), TODAY)).toBe(false);
  });

  it('applies events like the database does', () => {
    const shown = applyHintEvent(undefined, 'shown', TODAY);
    expect(shown).toEqual(state({ shownDays: 1, lastShownDay: TODAY }));
    expect(applyHintEvent(shown, 'shown', TODAY)).toEqual(shown);
    expect(applyHintEvent(state({ shownDays: 1, lastShownDay: '2026-09-27' }), 'shown', TODAY).shownDays).toBe(1);
    expect(applyHintEvent(shown, 'shown', '2026-09-27')).toEqual(state({ shownDays: 2, lastShownDay: '2026-09-27' }));

    const dismissed = applyHintEvent(shown, 'dismissed', TODAY, '2026-09-26T10:00:00.000Z');
    expect(applyHintEvent(dismissed, 'dismissed', TODAY, '2026-09-26T11:00:00.000Z').dismissedAt).toBe('2026-09-26T10:00:00.000Z');
    expect(applyHintEvent(dismissed, 'used', TODAY, 'x').usedAt).toBe('x');
    expect(applyHintEvent(state({ shownDays: 366, lastShownDay: YESTERDAY }), 'shown', TODAY).shownDays).toBe(366);
  });

  it('formats the local day and time zone', () => {
    expect(localDay(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
    expect(localTimeZone()).toBe(Intl.DateTimeFormat().resolvedOptions().timeZone);
    const spy = vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(() => {
      throw new RangeError('no Intl');
    });
    expect(localTimeZone()).toBe('UTC');
    spy.mockRestore();
  });
});

describe('parsing untrusted hints', () => {
  it('keeps valid entries and drops invalid ones', () => {
    const valid = state({ shownDays: 2, lastShownDay: YESTERDAY, dismissedAt: '2026-09-25T10:00:00.000Z' });
    const parsed = parseHints({
      'export-ai': valid,
      'Bad Key': valid,
      ['a'.repeat(65)]: valid,
      'neg': { ...valid, shownDays: -1 },
      'too-many': { ...valid, shownDays: 367 },
      'float': { ...valid, shownDays: 1.5 },
      'text-days': { ...valid, shownDays: '2' },
      'bad-day': { ...valid, lastShownDay: '26/09/2026' },
      'impossible-day': { ...valid, lastShownDay: '2026-13-45' },
      'feb-31': { ...valid, lastShownDay: '2026-02-31' },
      'empty-time': { ...valid, usedAt: '' },
      'number-time': { ...valid, usedAt: 1 },
      'long-time': { ...valid, usedAt: '2026-09-25T10:00:00.000Z'.padEnd(41, '0') },
      'not-object': 'x',
      'array': [1],
      'missing': {},
    });
    expect(parsed).toEqual({ 'export-ai': valid });
  });

  it('turns anything that is not a map into an empty map', () => {
    for (const value of [null, undefined, 'x', 42, [], [{ shownDays: 1 }]]) expect(parseHints(value)).toEqual({});
  });

  it('keeps at most 50 hints', () => {
    const many = Object.fromEntries(Array.from({ length: 60 }, (_, i) => [`h-${i}`, EMPTY_HINT]));
    expect(Object.keys(parseHints(many))).toHaveLength(50);
  });
});

describe('hint stores', () => {
  beforeEach(() => {
    store.clear();
    storageBlocked = false;
  });
  afterEach(() => vi.restoreAllMocks());

  describe('guest', () => {
    it('keeps the state only in this browser', async () => {
      const from = vi.spyOn(supabase, 'from');
      const rpc = vi.spyOn(supabase, 'rpc');
      const hints = createHintStore(null);
      expect(await hints.load()).toEqual({});
      const shown = await hints.record('export-ai', 'shown');
      expect(shown).toMatchObject({ shownDays: 1, lastShownDay: localDay() });
      await hints.record('export-ai', 'dismissed');
      expect(JSON.parse(store.get('heeey_hints')!)['export-ai'].dismissedAt).toBeTruthy();
      expect(await createHintStore(null).load()).toHaveProperty('export-ai');
      expect(from).not.toHaveBeenCalled();
      expect(rpc).not.toHaveBeenCalled();
    });

    it('tolerates corrupted or blocked storage', async () => {
      store.set('heeey_hints', '{not json');
      expect(await createHintStore(null).load()).toEqual({});
      store.set('heeey_hints', JSON.stringify({ 'export-ai': { shownDays: 'lots' } }));
      expect(await createHintStore(null).load()).toEqual({});

      storageBlocked = true;
      expect(await createHintStore(null).load()).toEqual({});
      await expect(createHintStore(null).record('export-ai', 'shown')).resolves.toMatchObject({ shownDays: 1 });
    });
  });

  describe('signed in', () => {
    it('loads from the account once and caches it', async () => {
      const { from, chain } = mockHintsTable({ data: [row('export-ai', { shown_days: 1, last_shown_day: YESTERDAY })], error: null });
      const rpc = mockRpc(() => ({ data: null, error: null }));
      const hints = createHintStore('u1');
      const first = await hints.load();
      await hints.load();
      expect(from).toHaveBeenCalledTimes(1);
      expect(from).toHaveBeenCalledWith('user_hints');
      expect(chain.eq).toHaveBeenCalledWith('user_id', 'u1');
      expect(first).toEqual({ 'export-ai': state({ shownDays: 1, lastShownDay: YESTERDAY }) });
      expect(JSON.parse(store.get('heeey_hints_u1')!)).toEqual(first);
      expect(rpc).not.toHaveBeenCalled();
    });

    it('ignores invalid rows from the server', async () => {
      mockHintsTable({ data: [row('export-ai'), row('Bad Key'), { hint_key: 'x', shown_days: 'many' }, null], error: null });
      mockRpc(() => ({ data: null, error: null }));
      expect(await createHintStore('u1').load()).toEqual({ 'export-ai': EMPTY_HINT });
    });

    it('records through the function, sending the time zone and never a date', async () => {
      mockHintsTable({ data: [], error: null });
      const saved = row('export-ai', { shown_days: 1, last_shown_day: TODAY });
      const rpc = mockRpc(() => ({ data: saved, error: null }));
      const result = await createHintStore('u1').record('export-ai', 'shown');
      expect(rpc).toHaveBeenCalledWith('record_hint_event', { p_hint_key: 'export-ai', p_event: 'shown', p_tz: localTimeZone() });
      expect(JSON.stringify(rpc.mock.calls[0][1])).not.toMatch(/\d{4}-\d{2}-\d{2}/);
      expect(result).toEqual(state({ shownDays: 1, lastShownDay: TODAY }));
      expect(JSON.parse(store.get('heeey_hints_u1')!)['export-ai']).toEqual(result);
    });

    it('falls back to the local cache when the server is unavailable', async () => {
      store.set('heeey_hints_u1', JSON.stringify({ 'export-ai': state({ shownDays: 2, lastShownDay: YESTERDAY }) }));
      mockHintsTable({ data: null, error: { message: 'relation "public.user_hints" does not exist' } });
      mockRpc(() => ({ data: null, error: { message: 'Could not find the function' } }));
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const hints = createHintStore('u1');
      expect(await hints.load()).toEqual({ 'export-ai': state({ shownDays: 2, lastShownDay: YESTERDAY }) });
      // Recorded locally, so the hint does not come back on this device
      const dismissed = await hints.record('export-ai', 'dismissed');
      expect(dismissed.dismissedAt).toBeTruthy();
      expect(JSON.parse(store.get('heeey_hints_u1')!)['export-ai'].dismissedAt).toBe(dismissed.dismissedAt);
      expect(warn).toHaveBeenCalled();
    });

    it('never rejects when the client throws, and tries again on the next store', async () => {
      store.set('heeey_hints_u1', JSON.stringify({ 'export-ai': state({ shownDays: 1, lastShownDay: YESTERDAY }) }));
      const chain: any = { select: vi.fn(() => chain), eq: vi.fn().mockRejectedValue(new TypeError('Failed to fetch')) };
      vi.spyOn(supabase, 'from').mockReturnValue(chain);
      vi.spyOn(supabase, 'rpc').mockRejectedValue(new TypeError('Failed to fetch'));
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      const hints = createHintStore('u1');
      await expect(hints.load()).resolves.toHaveProperty('export-ai');
      await expect(hints.load()).resolves.toHaveProperty('export-ai');
      await expect(hints.record('export-ai', 'used')).resolves.toMatchObject({ usedAt: expect.any(String) });
      // Recorded events show up in later loads of the same store
      expect((await hints.load())['export-ai'].usedAt).toBeTruthy();
    });

    it('sends a dismissal that never reached the server on the next online load', async () => {
      // Dismissed while offline: only the local cache has it
      store.set('heeey_hints_u1', JSON.stringify({ 'export-ai': state({ shownDays: 1, lastShownDay: YESTERDAY, dismissedAt: '2026-09-25T10:00:00.000Z' }) }));
      mockHintsTable({ data: [row('export-ai', { shown_days: 1, last_shown_day: YESTERDAY })], error: null });
      const rpc = mockRpc((_fn, args) => ({ data: row(args.p_hint_key, { shown_days: 1, last_shown_day: YESTERDAY, dismissed_at: '2026-09-26T12:00:00Z' }), error: null }));
      const hints = await createHintStore('u1').load();
      expect(rpc).toHaveBeenCalledWith('import_guest_hint', expect.objectContaining({ p_hint_key: 'export-ai', p_dismissed: true }));
      expect(shouldShowHint(hints['export-ai'], TODAY)).toBe(false);
      expect(JSON.parse(store.get('heeey_hints_u1')!)['export-ai'].dismissedAt).toBeTruthy();
    });

    it('keeps an event recorded while the account is still loading', async () => {
      let finish!: (v: { data: any; error: any }) => void;
      const chain: any = { select: vi.fn(() => chain), eq: vi.fn(() => new Promise((r) => (finish = r))) };
      vi.spyOn(supabase, 'from').mockReturnValue(chain);
      vi.spyOn(supabase, 'rpc').mockResolvedValue({ data: null, error: { message: 'offline' } } as any);
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      const hints = createHintStore('u1');
      const loading = hints.load();
      await hints.record('export-ai', 'dismissed');
      finish({ data: [], error: null });
      expect((await loading)['export-ai'].dismissedAt).toBeTruthy();
      expect(JSON.parse(store.get('heeey_hints_u1')!)['export-ai'].dismissedAt).toBeTruthy();
    });

    it('keeps an event recorded while the guest state is being sent', async () => {
      store.set('heeey_hints', JSON.stringify({ 'guest-hint': state({ dismissedAt: '2026-09-25T10:00:00.000Z' }) }));
      mockHintsTable({ data: [], error: null });
      let finishImport!: (v: { data: any; error: any }) => void;
      let importing!: () => void;
      const importStarted = new Promise<void>((r) => (importing = r));
      vi.spyOn(supabase, 'rpc').mockImplementation(((fn: string) => {
        if (fn === 'import_guest_hint') {
          importing();
          return new Promise((r) => (finishImport = r));
        }
        return Promise.resolve({ data: null, error: { message: 'offline' } });
      }) as any);
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      const hints = createHintStore('u1');
      const loading = hints.load();
      await importStarted;
      await hints.record('export-ai', 'used');
      finishImport({ data: row('guest-hint', { dismissed_at: '2026-09-26T12:00:00Z' }), error: null });
      const loaded = await loading;
      expect(loaded['export-ai'].usedAt).toBeTruthy();
      expect(loaded['guest-hint'].dismissedAt).toBeTruthy();
      expect(JSON.parse(store.get('heeey_hints_u1')!)['export-ai'].usedAt).toBeTruthy();
    });

    it('ignores invalid hint keys and events without calling the server', async () => {
      const rpc = mockRpc(() => ({ data: null, error: null }));
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      await expect(createHintStore('u1').record('Export AI', 'shown')).resolves.toEqual(EMPTY_HINT);
      await expect(createHintStore('u1').record('export-ai', 'opened' as any)).resolves.toEqual(EMPTY_HINT);
      await expect(createHintStore(null).record('Export AI', 'shown')).resolves.toEqual(EMPTY_HINT);
      expect(rpc).not.toHaveBeenCalled();
      expect(store.has('heeey_hints')).toBe(false);
      expect(warn).toHaveBeenCalledTimes(3);
    });

    it('does not read inherited properties as hints', async () => {
      const hints = createHintStore(null);
      expect(getHint(await hints.load(), 'constructor')).toBeUndefined();
      expect(await hints.record('constructor', 'shown')).toEqual(state({ shownDays: 1, lastShownDay: localDay() }));
    });
  });

  describe('guest state on sign-in', () => {
    const guest = (hints: Record<string, Partial<HintState>>) =>
      store.set('heeey_hints', JSON.stringify(Object.fromEntries(Object.entries(hints).map(([k, v]) => [k, state(v)]))));

    it('imports hints the account has no record of, and keeps the guest copy', async () => {
      guest({
        'export-ai': { shownDays: 2, lastShownDay: YESTERDAY, dismissedAt: '2026-09-25T10:00:00.000Z' },
        'never-seen': {},
      });
      mockHintsTable({ data: [], error: null });
      const rpc = mockRpc((_fn, args) => ({
        data: row(args.p_hint_key, { shown_days: args.p_shown_days, last_shown_day: args.p_last_shown_day, dismissed_at: '2026-09-26T12:00:00Z' }),
        error: null,
      }));
      const hints = await createHintStore('u1').load();
      expect(rpc).toHaveBeenCalledTimes(1);
      expect(rpc).toHaveBeenCalledWith('import_guest_hint', {
        p_hint_key: 'export-ai',
        p_shown_days: 2,
        p_last_shown_day: YESTERDAY,
        p_dismissed: true,
        p_used: false,
      });
      expect(hints['export-ai']).toMatchObject({ shownDays: 2, dismissedAt: '2026-09-26T12:00:00Z' });
      expect(store.has('heeey_hints')).toBe(true);
    });

    it('with an account record, only sends a dismiss/use the account lacks', async () => {
      guest({ 'seen-both': { shownDays: 1 }, 'dismissed-here': { dismissedAt: '2026-09-25T10:00:00.000Z' }, 'done-both': { usedAt: '2026-09-25T10:00:00.000Z' } });
      mockHintsTable({
        data: [row('seen-both', { shown_days: 2 }), row('dismissed-here', { shown_days: 1 }), row('done-both', { used_at: '2026-09-20T00:00:00Z' })],
        error: null,
      });
      const rpc = mockRpc((_fn, args) => ({ data: row(args.p_hint_key, { shown_days: 1, dismissed_at: '2026-09-26T12:00:00Z' }), error: null }));
      const hints = await createHintStore('u1').load();
      expect(rpc.mock.calls.map((c) => (c[1] as any).p_hint_key)).toEqual(['dismissed-here']);
      expect(hints['seen-both'].shownDays).toBe(2);
      expect(hints['dismissed-here'].dismissedAt).toBe('2026-09-26T12:00:00Z');
    });

    it('still respects the guest dismissal on this device when the server fails', async () => {
      guest({ 'export-ai': { dismissedAt: '2026-09-25T10:00:00.000Z' } });
      vi.spyOn(console, 'warn').mockImplementation(() => {});

      mockHintsTable({ data: [], error: null });
      mockRpc(() => ({ data: null, error: { message: 'Could not find the function' } }));
      expect(shouldShowHint((await createHintStore('u1').load())['export-ai'], TODAY)).toBe(false);

      vi.restoreAllMocks();
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      store.delete('heeey_hints_u2');
      mockHintsTable({ data: null, error: { message: 'offline' } });
      expect(shouldShowHint((await createHintStore('u2').load())['export-ai'], TODAY)).toBe(false);
    });
  });
});
