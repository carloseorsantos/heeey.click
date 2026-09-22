import { describe, it, expect, beforeEach } from 'vitest';
import {
  getGuestProfile,
  updateGuestProfile,
  getLocalBoards,
  saveLocalBoard,
  deleteLocalBoard,
  markBoardAsCreated,
  isBoardLocallyCreated,
  getCreatedBoardIds,
  removeCreatedBoardId,
  claimLocalBoardsForUser,
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

  it('claimLocalBoardsForUser should associate locally created guest boards to authenticated user', async () => {
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

    // Claim for user
    await claimLocalBoardsForUser('user-uuid-999');

    const updated = getLocalBoards();
    expect(updated[0].owner_id).toBe('user-uuid-999');
  });
});

