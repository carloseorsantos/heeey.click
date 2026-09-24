import { supabase } from './supabase';
import { getLocale } from '../i18n';

export interface Folder {
  id: string;
  owner_id: string;
  parent_id: string | null;
  name: string;
  created_at: string;
  updated_at: string;
}

/** Folders from the root down to folderId (inclusive), for breadcrumbs */
export function getFolderPath(folders: readonly Folder[], folderId: string | null): Folder[] {
  const byId = new Map(folders.map((f) => [f.id, f]));
  const path: Folder[] = [];
  const seen = new Set<string>();
  let current = folderId ? byId.get(folderId) : undefined;
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    path.unshift(current);
    current = current.parent_id ? byId.get(current.parent_id) : undefined;
  }
  return path;
}

/** folderId and every folder nested inside it */
export function getFolderSubtreeIds(folders: readonly Folder[], folderId: string): Set<string> {
  const ids = new Set<string>([folderId]);
  let added = true;
  while (added) {
    added = false;
    for (const f of folders) {
      if (f.parent_id && ids.has(f.parent_id) && !ids.has(f.id)) {
        ids.add(f.id);
        added = true;
      }
    }
  }
  return ids;
}

/** Folders sorted as an indented tree (depth-first, alphabetical per level) */
export function flattenFolderTree(folders: readonly Folder[]): { folder: Folder; depth: number }[] {
  const children = new Map<string | null, Folder[]>();
  for (const f of folders) {
    const key = f.parent_id && folders.some((p) => p.id === f.parent_id) ? f.parent_id : null;
    children.set(key, [...(children.get(key) || []), f]);
  }
  const result: { folder: Folder; depth: number }[] = [];
  const visit = (parentId: string | null, depth: number) => {
    const list = [...(children.get(parentId) || [])].sort((a, b) =>
      a.name.localeCompare(b.name, getLocale(), { sensitivity: 'base' })
    );
    for (const folder of list) {
      result.push({ folder, depth });
      visit(folder.id, depth + 1);
    }
  };
  visit(null, 0);
  return result;
}

export async function fetchFolders(ownerId: string): Promise<Folder[] | null> {
  const { data, error } = await supabase
    .from('folders')
    .select('*')
    .eq('owner_id', ownerId)
    .order('name', { ascending: true });
  if (error) {
    console.warn('Erro ao carregar pastas:', error.message);
    return null;
  }
  return (data || []) as Folder[];
}

export async function createFolder(
  ownerId: string,
  name: string,
  parentId: string | null
): Promise<Folder | null> {
  const { data, error } = await supabase
    .from('folders')
    .insert({ owner_id: ownerId, name: name.trim(), parent_id: parentId })
    .select('*')
    .single();
  if (error || !data) {
    console.warn('Erro ao criar pasta:', error?.message);
    return null;
  }
  return data as Folder;
}

export async function updateFolder(
  id: string,
  changes: Partial<Pick<Folder, 'name' | 'parent_id'>>
): Promise<boolean> {
  const { error } = await supabase
    .from('folders')
    .update(changes.name !== undefined ? { ...changes, name: changes.name.trim() } : changes)
    .eq('id', id);
  if (error) console.warn('Erro ao atualizar pasta:', error.message);
  return !error;
}

/** Subfolders are deleted too; boards inside go back to the root (on delete set null) */
export async function deleteFolder(id: string): Promise<boolean> {
  const { error } = await supabase.from('folders').delete().eq('id', id);
  if (error) console.warn('Erro ao excluir pasta:', error.message);
  return !error;
}

export async function moveBoardToFolder(boardId: string, folderId: string | null): Promise<boolean> {
  const { data, error } = await supabase
    .from('boards')
    .update({ folder_id: folderId })
    .eq('id', boardId)
    .select('id');
  if (error) console.warn('Erro ao mover quadro:', error.message);
  return !error && !!data && data.length > 0;
}
