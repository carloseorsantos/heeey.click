import { Board } from './types';
import { generateId, generateGuestName, getRandomCollaboratorColor } from './utils';
import { supabase } from './supabase';

const STORAGE_BOARDS_KEY = 'heeey_local_boards';
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

export function updateGuestProfile(updates: Partial<GuestProfile>): GuestProfile {
  const current = getGuestProfile();
  const updated = { ...current, ...updates };
  try {
    localStorage.setItem(GUEST_PROFILE_KEY, JSON.stringify(updated));
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

export function markBoardAsCreated(id: string): void {
  try {
    const ids = getCreatedBoardIds();
    if (!ids.includes(id)) {
      ids.push(id);
      localStorage.setItem(CREATED_BOARD_IDS_KEY, JSON.stringify(ids));
    }
  } catch (e) {
    console.error('Erro ao marcar board como criado:', e);
  }
}

export function isBoardLocallyCreated(id: string): boolean {
  const ids = getCreatedBoardIds();
  return ids.includes(id);
}

export function removeCreatedBoardId(id: string): void {
  try {
    const ids = getCreatedBoardIds().filter((i) => i !== id);
    localStorage.setItem(CREATED_BOARD_IDS_KEY, JSON.stringify(ids));
  } catch (e) {
    console.error('Erro ao remover created board id:', e);
  }
}

export function getLocalBoards(): Board[] {
  try {
    const raw = localStorage.getItem(STORAGE_BOARDS_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (e) {
    console.error('Erro ao ler boards locais:', e);
    return [];
  }
}

export function getLocalBoard(id: string): Board | null {
  const boards = getLocalBoards();
  return boards.find((b) => b.id === id) || null;
}

export function saveLocalBoard(board: Board): void {
  try {
    const boards = getLocalBoards();
    const index = boards.findIndex((b) => b.id === board.id);
    if (index >= 0) {
      boards[index] = board;
    } else {
      boards.unshift(board);
    }
    localStorage.setItem(STORAGE_BOARDS_KEY, JSON.stringify(boards));
  } catch (e) {
    console.error('Erro ao salvar board local:', e);
  }
}

export function deleteLocalBoard(id: string): void {
  try {
    const boards = getLocalBoards().filter((b) => b.id !== id);
    localStorage.setItem(STORAGE_BOARDS_KEY, JSON.stringify(boards));
    removeCreatedBoardId(id);
  } catch (e) {
    console.error('Erro ao excluir board local:', e);
  }
}

/**
 * When a guest logs in with Supabase auth, associate their local created boards
 * to their account by assigning owner_id = userId both locally and in Supabase.
 */
export async function claimLocalBoardsForUser(userId: string): Promise<void> {
  if (!userId) return;

  try {
    const localBoards = getLocalBoards();
    const createdIds = new Set(getCreatedBoardIds());

    const boardsToClaim = localBoards.filter(
      (b) => createdIds.has(b.id) && (!b.owner_id || b.owner_id === userId)
    );

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

