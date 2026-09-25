import { BOARD_ID_HEADER, supabase } from './supabase';
import { Board } from './types';

/** Everything the dashboard needs, without the heavy scene columns */
export const BOARD_SUMMARY_COLUMNS =
  'id,title,owner_id,access_level,created_at,updated_at,deleted_at,thumbnail,folder_id,team_id,project_id,restrict_link_at';
/** Databases without the teams migration yet */
const LEGACY_SUMMARY_COLUMNS = 'id,title,owner_id,access_level,created_at,updated_at,deleted_at,thumbnail,folder_id';

function toSummary(row: any): Board {
  return { ...row, elements: [], app_state: {}, files: {}, contentLoaded: false };
}

/**
 * Lists the user's boards (active and trashed) as light summaries.
 * Falls back to full rows if the database does not have the newer columns yet.
 */
export async function fetchBoardSummaries(ownerId: string): Promise<Board[] | null> {
  const query = (columns: string) =>
    supabase
      .from('boards')
      .select(columns)
      .eq('owner_id', ownerId)
      .order('updated_at', { ascending: false });

  const { data, error } = await query(LEGACY_SUMMARY_COLUMNS);
  if (!error && data) return (data as any[]).map(toSummary);

  console.warn('Resumo dos quadros indisponível, carregando linhas completas:', error?.message);
  const fallback = await query('*');
  if (fallback.error || !fallback.data) return null;
  return (fallback.data as any[]).map((row) => ({ ...row, contentLoaded: true }) as Board);
}

/** Boards of a team (active and trashed) that the user can see, as light summaries */
export async function fetchTeamBoards(teamId: string): Promise<Board[] | null> {
  const { data, error } = await supabase
    .from('boards')
    .select(BOARD_SUMMARY_COLUMNS)
    .eq('team_id', teamId)
    .order('updated_at', { ascending: false });
  if (error || !data) {
    console.warn('Erro ao carregar quadros do time:', error?.message);
    return null;
  }
  return (data as any[]).map(toSummary);
}

/** Boards shared directly with the user (Leitor/Editor), with the role they got */
export async function fetchSharedBoards(userId: string): Promise<{ board: Board; role: 'edit' | 'view' }[] | null> {
  const { data: shares, error } = await supabase.from('board_members').select('board_id,role').eq('user_id', userId);
  if (error || !shares) return null;
  if (shares.length === 0) return [];
  const roles = new Map(shares.map((s: any) => [s.board_id as string, s.role as 'edit' | 'view']));
  const { data, error: boardsError } = await supabase
    .from('boards')
    .select(BOARD_SUMMARY_COLUMNS)
    .in('id', [...roles.keys()])
    .is('deleted_at', null)
    .order('updated_at', { ascending: false });
  if (boardsError || !data) return null;
  return (data as any[]).map((row) => ({ board: toSummary(row), role: roles.get(row.id) ?? 'view' }));
}

/** Loads the scene of a board fetched as a summary */
export async function fetchBoardContent(
  id: string
): Promise<Pick<Board, 'elements' | 'app_state' | 'files'> | null> {
  const { data, error } = await supabase
    .from('boards')
    .select('elements,app_state,files')
    .eq('id', id)
    .setHeader(BOARD_ID_HEADER, id)
    .single();
  if (error || !data) return null;
  return data as Pick<Board, 'elements' | 'app_state' | 'files'>;
}

/** Stores a generated preview; failures are harmless (it is regenerated later) */
export async function saveBoardThumbnail(id: string, thumbnail: string): Promise<void> {
  try {
    await supabase.from('boards').update({ thumbnail }).eq('id', id).setHeader(BOARD_ID_HEADER, id);
  } catch {
    // Ignore: thumbnails are a cache
  }
}
