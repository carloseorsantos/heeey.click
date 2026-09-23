import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { supabase } from '../lib/supabase';
import { createLibraryAdapter, createGuestLibraryMigration } from '../lib/libraryAdapter';

const store = new Map<string, string>();
globalThis.localStorage = {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => store.set(key, value),
  removeItem: (key: string) => store.delete(key),
  clear: () => store.clear(),
  get length() {
    return store.size;
  },
  key: (i: number) => Array.from(store.keys())[i] ?? null,
} as any;

const item = (id: string) => ({ id, status: 'unpublished', elements: [], created: 1 }) as any;

function mockLibraryTable(select: { data: any; error: any }, upsert: { error: any } = { error: null }) {
  const chain: any = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    maybeSingle: vi.fn().mockResolvedValue(select),
    upsert: vi.fn().mockResolvedValue(upsert),
  };
  vi.spyOn(supabase, 'from').mockReturnValue(chain);
  return chain;
}

describe('library adapters', () => {
  beforeEach(() => store.clear());
  afterEach(() => vi.restoreAllMocks());

  it('guests keep the library in this browser', async () => {
    const adapter = createLibraryAdapter(null);
    expect(await adapter.load({ source: 'load' })).toEqual({ libraryItems: [] });
    await adapter.save({ libraryItems: [item('a')] });
    expect(await adapter.load({ source: 'load' })).toEqual({ libraryItems: [item('a')] });
  });

  it('signed-in users load from the account and cache locally', async () => {
    mockLibraryTable({ data: { items: [item('remote')] }, error: null });
    const adapter = createLibraryAdapter('u1');
    expect(await adapter.load({ source: 'load' })).toEqual({ libraryItems: [item('remote')] });
    expect(JSON.parse(store.get('heeey_library_u1')!)).toEqual([item('remote')]);
  });

  it('falls back to the local cache when the account library is unavailable', async () => {
    store.set('heeey_library_u1', JSON.stringify([item('cached')]));
    mockLibraryTable({ data: null, error: { message: 'relation does not exist' } });
    expect(await createLibraryAdapter('u1').load({ source: 'load' })).toEqual({ libraryItems: [item('cached')] });
  });

  it('upserts on save and throws (keeping the local copy) when sync fails', async () => {
    const chain = mockLibraryTable({ data: null, error: null });
    await createLibraryAdapter('u1').save({ libraryItems: [item('x')] });
    expect(chain.upsert).toHaveBeenCalledWith({ user_id: 'u1', items: [item('x')] }, { onConflict: 'user_id' });

    mockLibraryTable({ data: null, error: null }, { error: { message: 'offline' } });
    await expect(createLibraryAdapter('u1').save({ libraryItems: [item('y')] })).rejects.toThrow(/sincronizar/);
    expect(JSON.parse(store.get('heeey_library_u1')!)).toEqual([item('y')]);
  });

  it('migrates the guest library into the account once', async () => {
    expect(createGuestLibraryMigration(null)).toBeUndefined();
    const migration = createGuestLibraryMigration('u1')!;
    expect(await migration.load()).toBeNull();

    store.set('heeey_library', JSON.stringify([item('guest')]));
    expect(await migration.load()).toEqual({ libraryItems: [item('guest')] });
    await migration.clear();
    expect(store.has('heeey_library')).toBe(false);
  });
});
