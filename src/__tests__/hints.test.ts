import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { supabase } from '../lib/supabase';
import {
  shouldShowHint,
  pickHint,
  applyHintEvent,
  parseHints,
  createHintStore,
  getHint,
  EMPTY_HINT,
  HINT_QUEUE,
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
const AT = '2026-09-25T10:00:00.000Z';
const SERVER_AT = '2026-09-26T12:00:00Z';
const row = (hint_key: string, s: Partial<{ shown_at: string | null; dismissed_at: string | null; used_at: string | null }> = {}) => ({
  hint_key,
  shown_at: null,
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
  it('shows a hint only while it was never shown, dismissed or used', () => {
    expect(shouldShowHint(undefined)).toBe(true);
    expect(shouldShowHint(EMPTY_HINT)).toBe(true);
    expect(shouldShowHint(state({ shownAt: AT }))).toBe(false);
    expect(shouldShowHint(state({ dismissedAt: AT }))).toBe(false);
    expect(shouldShowHint(state({ usedAt: AT }))).toBe(false);
  });

  it('applies events like the database does: each timestamp is set once', () => {
    const shown = applyHintEvent(undefined, 'shown', AT);
    expect(shown).toEqual(state({ shownAt: AT }));
    expect(applyHintEvent(shown, 'shown', 'later')).toBe(shown);
    const dismissed = applyHintEvent(shown, 'dismissed', 'd1');
    expect(applyHintEvent(dismissed, 'dismissed', 'd2').dismissedAt).toBe('d1');
    expect(applyHintEvent(dismissed, 'used', 'u1')).toEqual(state({ shownAt: AT, dismissedAt: 'd1', usedAt: 'u1' }));
  });
});

describe('pickHint', () => {
  const all = () => true;

  it('follows the queue order', () => {
    expect(HINT_QUEUE).toEqual(['export-ai', 'share-board', 'board-search', 'version-history']);
    expect(pickHint({}, all)).toBe('export-ai');
  });

  it('moves on once a hint was shown, dismissed or used', () => {
    expect(pickHint({ 'export-ai': state({ shownAt: AT }) }, all)).toBe('share-board');
    expect(pickHint({ 'export-ai': state({ usedAt: AT }), 'share-board': state({ dismissedAt: AT }) }, all)).toBe('board-search');
    const done = Object.fromEntries(HINT_QUEUE.map((k) => [k, state({ shownAt: AT })]));
    expect(pickHint(done, all)).toBeNull();
  });

  it('skips a hint that does not fit the screen now, without consuming it', () => {
    const hints = {};
    expect(pickHint(hints, (k) => k !== 'export-ai')).toBe('share-board');
    expect(pickHint(hints, (k) => k === 'version-history')).toBe('version-history');
    expect(pickHint(hints, () => false)).toBeNull();
    expect(pickHint(hints, all)).toBe('export-ai');
  });

  it('only asks about hints that may still show', () => {
    const canShow = vi.fn((_hintKey: string) => false);
    pickHint({ 'export-ai': state({ shownAt: AT }) }, canShow);
    expect(canShow.mock.calls.map((c) => c[0])).toEqual(['share-board', 'board-search', 'version-history']);
  });
});

describe('parsing untrusted hints', () => {
  it('keeps valid entries and drops invalid ones', () => {
    const valid = state({ shownAt: AT, dismissedAt: AT });
    const parsed = parseHints({
      'export-ai': valid,
      'never-seen': {},
      'Bad Key': valid,
      ['a'.repeat(65)]: valid,
      'empty-time': { ...valid, usedAt: '' },
      'number-time': { ...valid, shownAt: 1 },
      'long-time': { ...valid, usedAt: AT.padEnd(41, '0') },
      'not-object': 'x',
      'array': [1],
    });
    expect(parsed).toEqual({ 'export-ai': valid, 'never-seen': EMPTY_HINT });
  });

  it('keeps only the known fields', () => {
    expect(parseHints({ 'export-ai': { shownAt: AT, extra: 'x' } })).toEqual({ 'export-ai': state({ shownAt: AT }) });
  });

  it('turns anything that is not a map into an empty map', () => {
    for (const value of [null, undefined, 'x', 42, [], [{ shownAt: AT }]]) expect(parseHints(value)).toEqual({});
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
      expect(shown.shownAt).toBeTruthy();
      await hints.record('export-ai', 'dismissed');
      expect(JSON.parse(store.get('heeey_hints')!)['export-ai'].dismissedAt).toBeTruthy();
      expect(await createHintStore(null).load()).toHaveProperty('export-ai');
      expect(from).not.toHaveBeenCalled();
      expect(rpc).not.toHaveBeenCalled();
    });

    it('tolerates corrupted or blocked storage', async () => {
      store.set('heeey_hints', '{not json');
      expect(await createHintStore(null).load()).toEqual({});
      store.set('heeey_hints', JSON.stringify({ 'export-ai': { shownAt: 42 } }));
      expect(await createHintStore(null).load()).toEqual({});

      storageBlocked = true;
      expect(await createHintStore(null).load()).toEqual({});
      await expect(createHintStore(null).record('export-ai', 'shown')).resolves.toMatchObject({ shownAt: expect.any(String) });
    });
  });

  describe('signed in', () => {
    it('loads from the account once and caches it', async () => {
      const { from, chain } = mockHintsTable({ data: [row('export-ai', { shown_at: SERVER_AT })], error: null });
      const rpc = mockRpc(() => ({ data: null, error: null }));
      const hints = createHintStore('u1');
      const first = await hints.load();
      await hints.load();
      expect(from).toHaveBeenCalledTimes(1);
      expect(from).toHaveBeenCalledWith('user_hints');
      expect(chain.select).toHaveBeenCalledWith('hint_key, shown_at, dismissed_at, used_at');
      expect(chain.eq).toHaveBeenCalledWith('user_id', 'u1');
      expect(first).toEqual({ 'export-ai': state({ shownAt: SERVER_AT }) });
      expect(JSON.parse(store.get('heeey_hints_u1')!)).toEqual(first);
      expect(rpc).not.toHaveBeenCalled();
    });

    it('ignores invalid rows from the server', async () => {
      mockHintsTable({ data: [row('export-ai'), row('Bad Key'), { hint_key: 'x', shown_at: 5 }, null], error: null });
      mockRpc(() => ({ data: null, error: null }));
      expect(await createHintStore('u1').load()).toEqual({ 'export-ai': EMPTY_HINT });
    });

    it('records through the function, never sending a time', async () => {
      mockHintsTable({ data: [], error: null });
      const rpc = mockRpc(() => ({ data: row('export-ai', { shown_at: SERVER_AT }), error: null }));
      const result = await createHintStore('u1').record('export-ai', 'shown');
      expect(rpc).toHaveBeenCalledWith('record_hint_event', { p_hint_key: 'export-ai', p_event: 'shown' });
      // The server's time wins over the one saved locally first
      expect(result).toEqual(state({ shownAt: SERVER_AT }));
      expect(JSON.parse(store.get('heeey_hints_u1')!)['export-ai']).toEqual(result);
    });

    it('falls back to the local cache when the server is unavailable', async () => {
      store.set('heeey_hints_u1', JSON.stringify({ 'export-ai': state({ shownAt: AT }) }));
      mockHintsTable({ data: null, error: { message: 'relation "public.user_hints" does not exist' } });
      mockRpc(() => ({ data: null, error: { message: 'Could not find the function' } }));
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const hints = createHintStore('u1');
      expect(await hints.load()).toEqual({ 'export-ai': state({ shownAt: AT }) });
      // Recorded locally, so the hint does not come back on this device
      const shown = await hints.record('share-board', 'shown');
      expect(shown.shownAt).toBeTruthy();
      expect(JSON.parse(store.get('heeey_hints_u1')!)['share-board'].shownAt).toBe(shown.shownAt);
      expect(warn).toHaveBeenCalled();
    });

    it('never rejects when the client throws, and later loads include recorded events', async () => {
      store.set('heeey_hints_u1', JSON.stringify({ 'export-ai': state({ shownAt: AT }) }));
      const chain: any = { select: vi.fn(() => chain), eq: vi.fn().mockRejectedValue(new TypeError('Failed to fetch')) };
      vi.spyOn(supabase, 'from').mockReturnValue(chain);
      vi.spyOn(supabase, 'rpc').mockRejectedValue(new TypeError('Failed to fetch'));
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      const hints = createHintStore('u1');
      await expect(hints.load()).resolves.toHaveProperty('export-ai');
      await expect(hints.record('export-ai', 'used')).resolves.toMatchObject({ usedAt: expect.any(String) });
      expect((await hints.load())['export-ai'].usedAt).toBeTruthy();
    });

    it('sends an event that never reached the server on the next online load', async () => {
      // Shown while offline: only the local cache has it
      store.set('heeey_hints_u1', JSON.stringify({ 'share-board': state({ shownAt: AT }) }));
      mockHintsTable({ data: [], error: null });
      const rpc = mockRpc((_fn, args) => ({ data: row(args.p_hint_key, { shown_at: SERVER_AT }), error: null }));
      const hints = await createHintStore('u1').load();
      expect(rpc.mock.calls).toEqual([['record_hint_event', { p_hint_key: 'share-board', p_event: 'shown' }]]);
      expect(hints['share-board']).toEqual(state({ shownAt: SERVER_AT }));
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
      expect((await hints.record('constructor', 'shown')).shownAt).toBeTruthy();
    });
  });

  describe('guest state on sign-in', () => {
    const guest = (hints: Record<string, Partial<HintState>>) =>
      store.set('heeey_hints', JSON.stringify(Object.fromEntries(Object.entries(hints).map(([k, v]) => [k, state(v)]))));

    it('sends each event the account lacks, and keeps the guest copy', async () => {
      guest({ 'export-ai': { shownAt: AT, dismissedAt: AT }, 'never-seen': {} });
      mockHintsTable({ data: [], error: null });
      const rpc = mockRpc((_fn, args) => ({
        data: row(args.p_hint_key, { shown_at: SERVER_AT, dismissed_at: args.p_event === 'dismissed' ? SERVER_AT : null }),
        error: null,
      }));
      const hints = await createHintStore('u1').load();
      expect(rpc.mock.calls).toEqual([
        ['record_hint_event', { p_hint_key: 'export-ai', p_event: 'shown' }],
        ['record_hint_event', { p_hint_key: 'export-ai', p_event: 'dismissed' }],
      ]);
      expect(hints['export-ai']).toEqual(state({ shownAt: SERVER_AT, dismissedAt: SERVER_AT }));
      expect(hints['never-seen']).toEqual(EMPTY_HINT);
      expect(store.has('heeey_hints')).toBe(true);
    });

    it('skips what the account already has', async () => {
      guest({ 'export-ai': { shownAt: AT }, 'share-board': { shownAt: AT, usedAt: AT } });
      mockHintsTable({ data: [row('export-ai', { shown_at: SERVER_AT }), row('share-board', { shown_at: SERVER_AT })], error: null });
      const rpc = mockRpc((_fn, args) => ({ data: row(args.p_hint_key, { shown_at: SERVER_AT, used_at: SERVER_AT }), error: null }));
      const hints = await createHintStore('u1').load();
      expect(rpc.mock.calls).toEqual([['record_hint_event', { p_hint_key: 'share-board', p_event: 'used' }]]);
      expect(hints['export-ai']).toEqual(state({ shownAt: SERVER_AT }));
      expect(hints['share-board'].usedAt).toBe(SERVER_AT);
    });

    it('still respects what the guest saw on this device when the server fails', async () => {
      guest({ 'export-ai': { shownAt: AT } });
      vi.spyOn(console, 'warn').mockImplementation(() => {});

      mockHintsTable({ data: [], error: null });
      mockRpc(() => ({ data: null, error: { message: 'Could not find the function' } }));
      expect(shouldShowHint((await createHintStore('u1').load())['export-ai'])).toBe(false);

      vi.restoreAllMocks();
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      mockHintsTable({ data: null, error: { message: 'offline' } });
      expect(shouldShowHint((await createHintStore('u2').load())['export-ai'])).toBe(false);
    });
  });
});
