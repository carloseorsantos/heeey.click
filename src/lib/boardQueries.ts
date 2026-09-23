import { supabase } from './supabase';
import { Board } from './types';

/** Everything the dashboard needs, without the heavy scene columns */
export const BOARD_SUMMARY_COLUMNS =
  'id,title,owner_id,access_level,created_at,updated_at,deleted_at,thumbnail,folder_id';

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

  const { data, error } = await query(BOARD_SUMMARY_COLUMNS);
  if (!error && data) return (data as any[]).map(toSummary);

  console.warn('Resumo dos quadros indisponível, carregando linhas completas:', error?.message);
  const fallback = await query('*');
  if (fallback.error || !fallback.data) return null;
  return (fallback.data as any[]).map((row) => ({ ...row, contentLoaded: true }) as Board);
}

/** Loads the scene of a board fetched as a summary */
export async function fetchBoardContent(
  id: string
): Promise<Pick<Board, 'elements' | 'app_state' | 'files'> | null> {
  const { data, error } = await supabase
    .from('boards')
    .select('elements,app_state,files')
    .eq('id', id)
    .single();
  if (error || !data) return null;
  return data as Pick<Board, 'elements' | 'app_state' | 'files'>;
}

/** Stores a generated preview; failures are harmless (it is regenerated later) */
export async function saveBoardThumbnail(id: string, thumbnail: string): Promise<void> {
  try {
    await supabase.from('boards').update({ thumbnail }).eq('id', id);
  } catch {
    // Ignore: thumbnails are a cache
  }
}
