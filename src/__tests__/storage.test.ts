import { describe, it, expect, beforeEach } from 'vitest';
import {
  getGuestProfile,
  updateGuestProfile,
  getLocalBoards,
  getLocalBoard,
  saveLocalBoard,
  deleteLocalBoard,
  markBoardAsCreated,
  isBoardLocallyCreated,
  getCreatedBoardIds,
  removeCreatedBoardId,
  getClaimableLocalBoards,
  markLocalBoardClaimed,
} from '../lib/storage';
import { Board } from '../lib/types';


// Simple localStorage polyfill for node test environment
const store = new Map<string, string>();
const localStorageMock = {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => store.set(key, value),
  removeItem: (key: string) => store.delete(key),
  clear: () => store.clear(),
  get length() { return store.size; },
  key: (index: number) => Array.from(store.keys())[index] ?? null,
};
globalThis.localStorage = localStorageMock as any;

describe('storage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('getGuestProfile should initialize and persist a profile', () => {
    const profile = getGuestProfile();
    expect(profile.id).toBeDefined();
    expect(profile.name).toBeDefined();
    expect(profile.color.background).toBeDefined();

    // Calling again should return the same cached profile
    const profile2 = getGuestProfile();
    expect(profile2.id).toBe(profile.id);
    expect(profile2.name).toBe(profile.name);
  });

  it('updateGuestProfile should modify the stored profile', () => {
    const updated = updateGuestProfile({ name: 'Meu Novo Nome' });
    expect(updated.name).toBe('Meu Novo Nome');

    const retrieved = getGuestProfile();
    expect(retrieved.name).toBe('Meu Novo Nome');
    expect(localStorage.getItem('heeey_guest_customized')).toBe('true');
  });

  it('saveLocalBoard, getLocalBoards and deleteLocalBoard should work', () => {
    expect(getLocalBoards()).toEqual([]);

    const sampleBoard: Board = {
      id: 'test-board-1',
      title: 'Quadro de Teste',
      owner_id: null,
      elements: [],
      app_state: {},
      files: {},
      access_level: 'edit',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    saveLocalBoard(sampleBoard);
    const boards = getLocalBoards();
    expect(boards.length).toBe(1);
    expect(boards[0].id).toBe('test-board-1');
    expect(boards[0].title).toBe('Quadro de Teste');

    // Update board
    const modifiedBoard = { ...sampleBoard, title: 'Quadro Atualizado' };
    saveLocalBoard(modifiedBoard);
    const updatedBoards = getLocalBoards();
    expect(updatedBoards.length).toBe(1);
    expect(updatedBoards[0].title).toBe('Quadro Atualizado');

    // Delete board
    deleteLocalBoard('test-board-1');
    expect(getLocalBoards().length).toBe(0);
  });

  it('markBoardAsCreated, isBoardLocallyCreated, and removeCreatedBoardId should track creator state', () => {
    expect(isBoardLocallyCreated('board-abc')).toBe(false);

    markBoardAsCreated('board-abc');
    expect(isBoardLocallyCreated('board-abc')).toBe(true);
    expect(getCreatedBoardIds()).toContain('board-abc');

    // Deleting via deleteLocalBoard also cleans up created ID
    const sampleBoard: Board = {
      id: 'board-abc',
      title: 'Quadro Local',
      owner_id: null,
      elements: [],
      app_state: {},
      files: {},
      access_level: 'edit',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    saveLocalBoard(sampleBoard);
    deleteLocalBoard('board-abc');

    expect(isBoardLocallyCreated('board-abc')).toBe(false);
  });

  it('offers locally created guest boards for claiming, once', async () => {
    const guestBoard1: Board = {
      id: 'guest-board-1',
      title: 'Quadro 1',
      owner_id: null,
      elements: [],
      app_state: {},
      files: {},
      access_level: 'edit',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    saveLocalBoard(guestBoard1);
    markBoardAsCreated('guest-board-1');

    expect(getClaimableLocalBoards().map((b) => b.id)).toEqual(['guest-board-1']);

    // Claimed into a team: not offered again
    markLocalBoardClaimed(guestBoard1, { owner_id: 'user-uuid-999', team_id: 't1', project_id: 'p1', access_level: 'restricted' });
    const updated = getLocalBoards();
    expect(updated[0]).toMatchObject({ owner_id: 'user-uuid-999', team_id: 't1', project_id: 'p1', access_level: 'restricted' });
    expect(getClaimableLocalBoards()).toEqual([]);
  });

  it('shared device protection: should NOT claim boards created by a previous guest session after reset', async () => {
    // Guest 1 creates a board
    const guestProfile1 = getGuestProfile();
    const guestBoard1: Board = {
      id: 'shared-board-1',
      title: 'Quadro da Biblioteca',
      owner_id: null,
      elements: [],
      app_state: {},
      files: {},
      access_level: 'edit',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    saveLocalBoard(guestBoard1);
    markBoardAsCreated('shared-board-1', guestProfile1.id);

    // Guest 1 leaves/signs out, guest profile is reset
    const { resetGuestProfile } = await import('../lib/storage');
    const guestProfile2 = resetGuestProfile();
    expect(guestProfile2.id).not.toBe(guestProfile1.id);

    // Person 2 logs in: the board must NOT be offered to them
    expect(getClaimableLocalBoards(guestProfile2.id).map((b) => b.id)).not.toContain('shared-board-1');
    expect(getClaimableLocalBoards(guestProfile1.id).map((b) => b.id)).toContain('shared-board-1');
  });

  it('resilient storage: saves individual board content and cleans up on delete', () => {
    const board: Board = {
      id: 'resilient-board-1',
      title: 'Quadro Resiliente',
      owner_id: null,
      elements: [{ id: 'el-1', type: 'rectangle', version: 1, isDeleted: false }],
      app_state: { viewBackgroundColor: '#ffffff' },
      files: { 'file-1': { id: 'file-1', dataURL: 'http://example.com/img.png', mimeType: 'image/png' } },
      access_level: 'edit',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    saveLocalBoard(board);

    // Verify individual key was written
    const individualKey = localStorage.getItem('heeey_board_resilient-board-1');
    expect(individualKey).toBeTruthy();
    const parsed = JSON.parse(individualKey!);
    expect(parsed.elements.length).toBe(1);
    expect(parsed.files['file-1']).toBeDefined();

    // Verify getLocalBoard returns the full individual content
    const loaded = getLocalBoard('resilient-board-1');
    expect(loaded?.id).toBe('resilient-board-1');
    expect(loaded?.files['file-1'].dataURL).toBe('http://example.com/img.png');

    // Deleting cleans up individual key
    deleteLocalBoard('resilient-board-1');
    expect(localStorage.getItem('heeey_board_resilient-board-1')).toBeNull();
    expect(getLocalBoard('resilient-board-1')).toBeNull();
  });

  it('isBoardLocallyCreated should respect activeGuestId to prevent shared-device hijacking', () => {
    markBoardAsCreated('board-guest-1', 'guest-123');

    // Matching guest should return true
    expect(isBoardLocallyCreated('board-guest-1', 'guest-123')).toBe(true);

    // Different guest on shared computer should return false
    expect(isBoardLocallyCreated('board-guest-1', 'guest-456')).toBe(false);

    // Without activeGuestId argument, returns true for backwards compatibility
    expect(isBoardLocallyCreated('board-guest-1')).toBe(true);
  });

  it('saveLocalBoard should keep the trash state in the index and restore it when cleared', () => {
    const board: Board = {
      id: 'trashed-board-1',
      title: 'Quadro na Lixeira',
      owner_id: null,
      elements: [],
      app_state: {},
      files: {},
      access_level: 'edit',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: '2026-09-23T12:00:00.000Z',
    };

    saveLocalBoard(board);
    const index = JSON.parse(localStorage.getItem('heeey_local_boards') || '[]');
    expect(index[0].deleted_at).toBe('2026-09-23T12:00:00.000Z');
    expect(getLocalBoards()[0].deleted_at).toBe('2026-09-23T12:00:00.000Z');

    saveLocalBoard({ ...board, deleted_at: null });
    const restoredIndex = JSON.parse(localStorage.getItem('heeey_local_boards') || '[]');
    expect(restoredIndex[0].deleted_at).toBeUndefined();
    expect(getLocalBoard('trashed-board-1')?.deleted_at).toBeNull();
  });
});
