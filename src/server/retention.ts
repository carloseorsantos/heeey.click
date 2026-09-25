import { createClient } from '@supabase/supabase-js';

export interface PurgeDeps {
  /** Runs public.purge_expired_data() with the service role */
  purge: () => Promise<{ purged_board_ids: string[]; audit_events_purged: number }>;
  /** Removes every file under board-media/{boardId}/ */
  removeBoardMedia: (boardId: string) => Promise<void>;
  /** Runs public.apply_scheduled_link_restrictions(): open links whose notice period ended become restricted */
  restrictLinks: () => Promise<number>;
}

/**
 * Daily retention job (Vercel Cron): permanently deletes boards trashed over 30 days ago,
 * then their images, and audit events over a year old; also restricts the open links whose
 * 30-day notice ended (teams migration). Only Vercel Cron, which sends
 * `Authorization: Bearer $CRON_SECRET`, may call it.
 */
export async function handlePurge(request: Request, cronSecret: string | undefined, deps: PurgeDeps | null): Promise<Response> {
  if (!cronSecret || request.headers.get('Authorization') !== `Bearer ${cronSecret}`) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }
  if (!deps) {
    return Response.json({ error: 'SUPABASE_SERVICE_ROLE_KEY is not configured' }, { status: 503 });
  }

  const linksRestricted = await deps.restrictLinks();
  const result = await deps.purge();
  const mediaErrors: string[] = [];
  for (const id of result.purged_board_ids) {
    try {
      await deps.removeBoardMedia(id);
    } catch {
      mediaErrors.push(id);
    }
  }
  return Response.json(
    {
      boards_purged: result.purged_board_ids.length,
      audit_events_purged: result.audit_events_purged,
      links_restricted: linksRestricted,
      media_errors: mediaErrors,
    },
    { status: mediaErrors.length ? 500 : 200 }
  );
}

/** Supabase-backed deps; null when the service role key isn't set */
export function createPurgeDeps(env: Record<string, string | undefined>): PurgeDeps | null {
  const url = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  const client = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const bucket = client.storage.from('board-media');

  return {
    async purge() {
      const { data, error } = await client.rpc('purge_expired_data');
      if (error) throw new Error(error.message);
      return data;
    },
    async restrictLinks() {
      const { data, error } = await client.rpc('apply_scheduled_link_restrictions');
      if (error) throw new Error(error.message);
      return (data as number) ?? 0;
    },
    async removeBoardMedia(boardId) {
      for (;;) {
        const { data: files, error } = await bucket.list(boardId, { limit: 1000 });
        if (error) throw new Error(error.message);
        if (!files?.length) return;
        const { error: removeError } = await bucket.remove(files.map((f) => `${boardId}/${f.name}`));
        if (removeError) throw new Error(removeError.message);
        if (files.length < 1000) return;
      }
    },
  };
}
