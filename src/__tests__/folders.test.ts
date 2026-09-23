import { describe, it, expect } from 'vitest';
import { Folder, getFolderPath, getFolderSubtreeIds, flattenFolderTree } from '../lib/folders';

const folder = (id: string, name: string, parent_id: string | null = null): Folder => ({
  id,
  name,
  parent_id,
  owner_id: 'u1',
  created_at: '',
  updated_at: '',
});

const folders = [
  folder('work', 'Trabalho'),
  folder('q4', 'Q4', 'work'),
  folder('okr', 'OKRs', 'q4'),
  folder('home', 'Casa'),
];

describe('folders helpers', () => {
  it('getFolderPath returns the breadcrumb from the root', () => {
    expect(getFolderPath(folders, 'okr').map((f) => f.id)).toEqual(['work', 'q4', 'okr']);
    expect(getFolderPath(folders, null)).toEqual([]);
    expect(getFolderPath(folders, 'missing')).toEqual([]);
  });

  it('getFolderPath stops on corrupted cycles', () => {
    const cyclic = [folder('a', 'A', 'b'), folder('b', 'B', 'a')];
    expect(getFolderPath(cyclic, 'a').map((f) => f.id)).toEqual(['b', 'a']);
  });

  it('getFolderSubtreeIds includes nested folders only', () => {
    expect([...getFolderSubtreeIds(folders, 'work')].sort()).toEqual(['okr', 'q4', 'work']);
    expect([...getFolderSubtreeIds(folders, 'home')]).toEqual(['home']);
  });

  it('flattenFolderTree orders depth-first and alphabetically', () => {
    expect(flattenFolderTree(folders).map(({ folder, depth }) => `${depth}:${folder.name}`)).toEqual([
      '0:Casa',
      '0:Trabalho',
      '1:Q4',
      '2:OKRs',
    ]);
  });
});
