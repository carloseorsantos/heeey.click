import { Board } from './types';
import { generateId, generateGuestName, getRandomCollaboratorColor } from './utils';
import { supabase } from './supabase';

const STORAGE_BOARDS_KEY = 'heeey_local_boards';
const BOARD_CONTENT_PREFIX = 'heeey_board_';
const BOARD_CREATOR_PREFIX = 'heeey_board_creator_';
const GUEST_PROFILE_KEY = 'heeey_guest_profile';
const CREATED_BOARD_IDS_KEY = 'heeey_created_board_ids';

export interface GuestProfile {
  id: string;
  name: string;
  color: {
    background: string;
    stroke: string;
  };
}

export function getGuestProfile(): GuestProfile {
  try {
    const raw = localStorage.getItem(GUEST_PROFILE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.id && parsed.name && parsed.color) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Erro ao ler guest profile:', e);
  }

  const id = generateId();
  const name = generateGuestName();
  const color = getRandomCollaboratorColor(id);
  const profile: GuestProfile = { id, name, color };

  try {
    localStorage.setItem(GUEST_PROFILE_KEY, JSON.stringify(profile));
  } catch (e) {
    console.error('Erro ao salvar guest profile:', e);
  }

  return profile;
}

/**
 * Resets the guest profile with a new identity.
 * Critical on sign-out to prevent shared-device claiming of anonymous boards.
 */
export function resetGuestProfile(): GuestProfile {
  const id = generateId();
  const name = generateGuestName();
  const color = getRandomCollaboratorColor(id);
  const profile: GuestProfile = { id, name, color };

  try {
    localStorage.setItem(GUEST_PROFILE_KEY, JSON.stringify(profile));
    localStorage.removeItem('heeey_guest_customized');
  } catch (e) {
    console.error('Erro ao resetar guest profile:', e);
  }

  return profile;
}

export function updateGuestProfile(updates: Partial<GuestProfile>): GuestProfile {
  const current = getGuestProfile();
  const updated = { ...current, ...updates };
  try {
    localStorage.setItem(GUEST_PROFILE_KEY, JSON.stringify(updated));
    localStorage.setItem('heeey_guest_customized', 'true');
  } catch (e) {
    console.error('Erro ao atualizar guest profile:', e);
  }
  return updated;
}

// Track IDs of boards created on this browser instance
export function getCreatedBoardIds(): string[] {
  try {
    const raw = localStorage.getItem(CREATED_BOARD_IDS_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (e) {
    console.error('Erro ao ler created board ids:', e);
    return [];
  }
}

export function markBoardAsCreated(id: string, creatorGuestId?: string): void {
  try {
    const ids = getCreatedBoardIds();
    if (!ids.includes(id)) {
      ids.push(id);
      localStorage.setItem(CREATED_BOARD_IDS_KEY, JSON.stringify(ids));
    }
    const guestId = creatorGuestId || getGuestProfile().id;
    localStorage.setItem(`${BOARD_CREATOR_PREFIX}${id}`, guestId);
  } catch (e) {
    console.error('Erro ao marcar board como criado:', e);
  }
}

export function isBoardLocallyCreated(id: string, activeGuestId?: string): boolean {
  const ids = getCreatedBoardIds();
  if (!ids.includes(id)) return false;
  if (activeGuestId) {
    const creator = getBoardCreatorGuestId(id);
    if (creator && creator !== activeGuestId) {
      return false;
    }
  }
  return true;
}

export function getBoardCreatorGuestId(id: string): string | null {
  try {
    return localStorage.getItem(`${BOARD_CREATOR_PREFIX}${id}`) || null;
  } catch {
    return null;
  }
}

export function removeCreatedBoardId(id: string): void {
  try {
    const ids = getCreatedBoardIds().filter((i) => i !== id);
    localStorage.setItem(CREATED_BOARD_IDS_KEY, JSON.stringify(ids));
    localStorage.removeItem(`${BOARD_CREATOR_PREFIX}${id}`);
  } catch (e) {
    console.error('Erro ao remover created board id:', e);
  }
}

/**
 * Prunes heavy deleted elements and oversized base64 data URLs to prevent QuotaExceededError.
 */
function pruneBoardForQuota(board: Board, aggressive: boolean = false): Board {
  const prunedElements = Array.isArray(board.elements)
    ? board.elements.filter((el: any) => !el.isDeleted)
    : [];

  const prunedFiles: Record<string, any> = {};
  if (board.files && typeof board.files === 'object') {
    for (const [key, file] of Object.entries(board.files)) {
      if (!file) continue;
      // If aggressive or oversized base64 (>50KB), strip dataURL keeping metadata
      if (
        aggressive &&
        typeof file.dataURL === 'string' &&
        file.dataURL.startsWith('data:') &&
        file.dataURL.length > 50 * 1024
      ) {
        prunedFiles[key] = {
          id: file.id,
          mimeType: file.mimeType,
          created: file.created,
          _optimized: file._optimized,
          dataURL: '', // Stripped to save quota
        };
      } else {
        prunedFiles[key] = file;
      }
    }
  }

  return {
    ...board,
    elements: prunedElements,
    files: prunedFiles,
  };
}

/**
 * Evicts older cached board contents for boards that are safely owned/synced to Supabase
 * when localStorage is near or at the 5MB quota limit.
 */
function evictOlderBoardCaches(exceptBoardId: string): void {
  try {
    const raw = localStorage.getItem(STORAGE_BOARDS_KEY);
    if (!raw) return;
    const boards: Board[] = JSON.parse(raw);
    // Find boards with owner_id (synced to cloud) sorted oldest first
    const evictable = boards
      .filter((b) => b.id !== exceptBoardId && b.owner_id !== null)
      .sort(
        (a, b) =>
          new Date(a.updated_at || 0).getTime() - new Date(b.updated_at || 0).getTime()
      );

    for (const b of evictable.slice(0, 3)) {
      localStorage.removeItem(`${BOARD_CONTENT_PREFIX}${b.id}`);
    }
  } catch (e) {
    // Ignore eviction errors
  }
}

export function getLocalBoards(): Board[] {
  try {
    const raw = localStorage.getItem(STORAGE_BOARDS_KEY);
    if (!raw) return [];
    const boards: Board[] = JSON.parse(raw);

    // Merge individual board content if available
    return boards.map((b) => {
      try {
        const individualRaw = localStorage.getItem(`${BOARD_CONTENT_PREFIX}${b.id}`);
        if (individualRaw) {
          const individual = JSON.parse(individualRaw);
          return {
            ...b,
            ...individual,
            elements: individual.elements || b.elements || [],
            files: individual.files || b.files || {},
          };
        }
      } catch {
        // Fall back to index entry
      }
      return b;
    });
  } catch (e) {
    console.error('Erro ao ler boards locais:', e);
    return [];
  }
}

export function getLocalBoard(id: string): Board | null {
  try {
    const individualRaw = localStorage.getItem(`${BOARD_CONTENT_PREFIX}${id}`);
    if (individualRaw) {
      return JSON.parse(individualRaw);
    }
  } catch (e) {
    console.warn(`Erro ao ler board individual ${id}:`, e);
  }

  const boards = getLocalBoards();
  return boards.find((b) => b.id === id) || null;
}

export function saveLocalBoard(board: Board): void {
  const pruned = pruneBoardForQuota(board, false);

  // 1. Save individual board content in its own key
  try {
    localStorage.setItem(`${BOARD_CONTENT_PREFIX}${board.id}`, JSON.stringify(pruned));
  } catch (e) {
    // Attempt recovery on QuotaExceededError
    console.warn('Quota excedida ao salvar board individual, tentando recuperar espaço:', e);
    try {
      evictOlderBoardCaches(board.id);
      const aggressivePruned = pruneBoardForQuota(board, true);
      localStorage.setItem(`${BOARD_CONTENT_PREFIX}${board.id}`, JSON.stringify(aggressivePruned));
    } catch (retryErr) {
      console.error('Não foi possível salvar o board individualmente mesmo após compressão:', retryErr);
    }
  }

  // 2. Update index in STORAGE_BOARDS_KEY with a light summary to protect index size
  let boards: Board[] = [];
  const indexEntry: Board = {
    id: board.id,
    title: board.title,
    owner_id: board.owner_id,
    access_level: board.access_level,
    created_at: board.created_at,
    updated_at: board.updated_at,
    elements: [],
    app_state: {},
    files: {},
  };

  try {
    const raw = localStorage.getItem(STORAGE_BOARDS_KEY);
    boards = raw ? JSON.parse(raw) : [];
    const index = boards.findIndex((b) => b.id === board.id);

    if (index >= 0) {
      boards[index] = indexEntry;
    } else {
      boards.unshift(indexEntry);
    }

    // Clean up any heavy elements/files stored in existing index entries
    const lightweightBoards = boards.map((b) => ({
      id: b.id,
      title: b.title,
      owner_id: b.owner_id,
      access_level: b.access_level,
      created_at: b.created_at,
      updated_at: b.updated_at,
      elements: [],
      app_state: {},
      files: {},
    }));

    localStorage.setItem(STORAGE_BOARDS_KEY, JSON.stringify(lightweightBoards));
  } catch (e) {
    console.warn('Quota excedida no índice de boards locais, recuperando espaço:', e);
    try {
      evictOlderBoardCaches(board.id);
      const index = boards.findIndex((b) => b.id === board.id);
      if (index >= 0) {
        boards[index] = indexEntry;
      } else {
        boards.unshift(indexEntry);
      }
      const trimmed = boards.slice(0, 20).map((b) => ({
        id: b.id,
        title: b.title,
        owner_id: b.owner_id,
        access_level: b.access_level,
        created_at: b.created_at,
        updated_at: b.updated_at,
        elements: [],
        app_state: {},
        files: {},
      }));
      localStorage.setItem(STORAGE_BOARDS_KEY, JSON.stringify(trimmed));
    } catch (err) {
      console.error('Erro crítico ao salvar índice de boards locais:', err);
    }
  }
}

export function deleteLocalBoard(id: string): void {
  try {
    localStorage.removeItem(`${BOARD_CONTENT_PREFIX}${id}`);
    localStorage.removeItem(`${BOARD_CREATOR_PREFIX}${id}`);

    const raw = localStorage.getItem(STORAGE_BOARDS_KEY);
    if (raw) {
      const boards: Board[] = JSON.parse(raw);
      const filtered = boards.filter((b) => b.id !== id);
      localStorage.setItem(STORAGE_BOARDS_KEY, JSON.stringify(filtered));
    }
    removeCreatedBoardId(id);
  } catch (e) {
    console.error('Erro ao excluir board local:', e);
  }
}

/**
 * When a guest logs in with Supabase auth, associate their local created boards
 * to their account by assigning owner_id = userId both locally and in Supabase.
 *
 * PREVENTS THEFT ON SHARED DEVICES:
 * Only boards created by the active guest session (matching activeGuestId or current profile)
 * are claimed. Boards left by previous users or earlier guest sessions are not stolen.
 */
export async function claimLocalBoardsForUser(
  userId: string,
  activeGuestId?: string
): Promise<void> {
  if (!userId) return;

  try {
    const localBoards = getLocalBoards();
    const createdIds = new Set(getCreatedBoardIds());
    const currentGuestId = activeGuestId || getGuestProfile().id;

    const boardsToClaim = localBoards.filter((b) => {
      if (!createdIds.has(b.id)) return false;
      if (b.owner_id && b.owner_id !== userId) return false;

      // Check creator guest ID
      const boardCreator = getBoardCreatorGuestId(b.id);
      // If creator was recorded, it must match current active guest
      if (boardCreator && boardCreator !== currentGuestId) {
        return false;
      }
      return true;
    });

    if (boardsToClaim.length === 0) return;

    for (const board of boardsToClaim) {
      if (board.owner_id !== userId) {
        board.owner_id = userId;
        saveLocalBoard(board);

        // Update in Supabase
        try {
          await supabase
            .from('boards')
            .update({ owner_id: userId })
            .eq('id', board.id)
            .is('owner_id', null);
        } catch (err) {
          console.warn(`Erro ao vincular board ${board.id} ao usuário no Supabase:`, err);
        }
      }
    }
  } catch (e) {
    console.error('Erro no claimLocalBoardsForUser:', e);
  }
}
