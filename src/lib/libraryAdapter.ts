import type {
  LibraryPersistenceAdapter,
  LibraryMigrationAdapter,
} from '@excalidraw/excalidraw/data/library';
import { supabase } from './supabase';

const GUEST_LIBRARY_KEY = 'heeey_library';
const userCacheKey = (userId: string) => `heeey_library_${userId}`;

function readItems(key: string): any[] | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function writeItems(key: string, items: readonly any[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(items));
  } catch (e) {
    console.warn('Não foi possível guardar a biblioteca neste navegador:', e);
  }
}

/**
 * Where the Excalidraw library lives: this browser for guests, the account
 * (user_libraries) for signed-in users, with a local cache for offline use.
 */
export function createLibraryAdapter(userId: string | null | undefined): LibraryPersistenceAdapter {
  if (!userId) {
    return {
      load: () => ({ libraryItems: readItems(GUEST_LIBRARY_KEY) || [] }),
      save: ({ libraryItems }) => writeItems(GUEST_LIBRARY_KEY, libraryItems),
    };
  }

  const cacheKey = userCacheKey(userId);
  return {
    async load() {
      const { data, error } = await supabase
        .from('user_libraries')
        .select('items')
        .eq('user_id', userId)
        .maybeSingle();
      if (error) {
        console.warn('Biblioteca da conta indisponível, usando a cópia local:', error.message);
        return { libraryItems: readItems(cacheKey) || [] };
      }
      const items = Array.isArray(data?.items) ? data.items : [];
      writeItems(cacheKey, items);
      return { libraryItems: items };
    },
    async save({ libraryItems }) {
      writeItems(cacheKey, libraryItems);
      const { error } = await supabase
        .from('user_libraries')
        .upsert({ user_id: userId, items: libraryItems }, { onConflict: 'user_id' });
      if (error) {
        // Excalidraw expects save to throw on failure; the local cache keeps the change
        throw new Error(`Não foi possível sincronizar a biblioteca: ${error.message}`);
      }
    },
  };
}

/** Moves a library built as a guest on this browser into the account on first sign-in */
export function createGuestLibraryMigration(userId: string | null | undefined): LibraryMigrationAdapter | undefined {
  if (!userId) return undefined;
  return {
    load: () => {
      const items = readItems(GUEST_LIBRARY_KEY);
      return items && items.length > 0 ? { libraryItems: items } : null;
    },
    clear: () => {
      try {
        localStorage.removeItem(GUEST_LIBRARY_KEY);
      } catch {
        // ignore
      }
    },
  };
}
