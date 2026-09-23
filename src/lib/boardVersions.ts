import { supabase } from './supabase';

export interface BoardVersionSummary {
  id: string;
  created_at: string;
  reason: 'auto' | 'before_restore';
  element_count: number;
  thumbnail: string | null;
}

export interface BoardVersion extends BoardVersionSummary {
  title: string;
  elements: any[];
  app_state: Record<string, any>;
  files: Record<string, any>;
}

export async function listBoardVersions(boardId: string): Promise<BoardVersionSummary[] | null> {
  const { data, error } = await supabase
    .from('board_versions')
    .select('id,created_at,reason,element_count,thumbnail')
    .eq('board_id', boardId)
    .order('created_at', { ascending: false })
    .limit(30);
  if (error) {
    console.warn('Erro ao carregar histórico de versões:', error.message);
    return null;
  }
  return (data || []) as BoardVersionSummary[];
}

export async function fetchBoardVersion(versionId: string): Promise<BoardVersion | null> {
  const { data, error } = await supabase
    .from('board_versions')
    .select('*')
    .eq('id', versionId)
    .single();
  if (error || !data) return null;
  return data as BoardVersion;
}

/** Saves the current board state to the history (so a restore can be undone) */
export async function snapshotBoard(boardId: string): Promise<boolean> {
  const { error } = await supabase.rpc('snapshot_board', { p_board_id: boardId });
  if (error) {
    console.warn('Erro ao salvar versão atual:', error.message);
    return false;
  }
  return true;
}

/**
 * Turns a stored version into a scene update that wins reconciliation everywhere:
 * every element gets a version above the one currently on the canvas, and elements
 * that did not exist in that version are marked as deleted.
 */
export function buildRestoredElements(
  currentElements: readonly any[],
  versionElements: readonly any[],
  now: number = Date.now(),
  randomNonce: () => number = () => Math.floor(Math.random() * 2 ** 31)
): any[] {
  const currentById = new Map(currentElements.map((el) => [el.id, el]));
  const bump = (el: any, base: any, changes: Record<string, any> = {}) => ({
    ...el,
    ...changes,
    version: Math.max(el.version || 0, base?.version || 0) + 1,
    versionNonce: randomNonce(),
    updated: now,
  });

  const restored = versionElements.map((el) => bump(el, currentById.get(el.id)));
  const restoredIds = new Set(versionElements.map((el) => el.id));
  const removed = currentElements
    .filter((el) => !restoredIds.has(el.id) && !el.isDeleted)
    .map((el) => bump(el, el, { isDeleted: true }));

  return [...restored, ...removed];
}
