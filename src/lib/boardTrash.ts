import { supabase } from './supabase';

export type TrashResult = 'saved' | 'not-found' | 'error';

/**
 * Moves a board to the trash (soft delete) or restores it.
 * The server stamps deleted_at and only lets the owner change it on owned boards.
 * 'not-found' means no row was updated, e.g. a board that only exists locally.
 */
export async function setBoardTrashed(id: string, trashed: boolean): Promise<TrashResult> {
  try {
    const { data, error } = await supabase
      .from('boards')
      .update({ deleted_at: trashed ? new Date().toISOString() : null })
      .eq('id', id)
      .select('id');

    if (error) {
      console.warn('Erro ao atualizar lixeira no Supabase:', error.message);
      return 'error';
    }
    return data && data.length > 0 ? 'saved' : 'not-found';
  } catch (e) {
    console.warn('Exceção ao atualizar lixeira no Supabase:', e);
    return 'error';
  }
}

/**
 * Permanently deletes a trashed board and its uploaded images.
 * Only the authenticated owner is allowed by RLS. Images go first because the
 * storage delete policy checks ownership against the board row.
 */
export async function deleteBoardPermanently(id: string): Promise<boolean> {
  try {
    const { data: files } = await supabase.storage.from('board-media').list(id, { limit: 1000 });
    if (files && files.length > 0) {
      const { error: storageErr } = await supabase.storage
        .from('board-media')
        .remove(files.map((f) => `${id}/${f.name}`));
      if (storageErr) {
        console.warn('Erro ao remover imagens do quadro:', storageErr.message);
      }
    }

    const { data, error } = await supabase.from('boards').delete().eq('id', id).select('id');
    if (error) {
      console.warn('Erro ao excluir quadro do Supabase:', error.message);
      return false;
    }
    return !!data && data.length > 0;
  } catch (e) {
    console.warn('Exceção ao excluir quadro do Supabase:', e);
    return false;
  }
}
