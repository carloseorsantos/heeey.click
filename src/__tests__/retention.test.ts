import { describe, it, expect, vi } from 'vitest';
import { handlePurge, createPurgeDeps, type PurgeDeps } from '../server/retention';

const cron = (auth?: string) =>
  new Request('https://heeey.click/api/cron/purge', { headers: auth ? { Authorization: auth } : {} });

function deps(ids: string[], failing: string[] = []): PurgeDeps & { removed: string[] } {
  const removed: string[] = [];
  return {
    removed,
    purge: vi.fn(async () => ({ purged_board_ids: ids, audit_events_purged: 3 })),
    removeBoardMedia: vi.fn(async (id: string) => {
      if (failing.includes(id)) throw new Error('storage down');
      removed.push(id);
    }),
  };
}

describe('retention cron', () => {
  it('only runs for Vercel Cron with the right secret', async () => {
    const d = deps(['a']);
    expect((await handlePurge(cron(), 's3cret', d)).status).toBe(401);
    expect((await handlePurge(cron('Bearer wrong'), 's3cret', d)).status).toBe(401);
    expect((await handlePurge(cron('Bearer '), '', d)).status).toBe(401);
    expect((await handlePurge(cron('Bearer undefined'), undefined, d)).status).toBe(401);
    expect(d.purge).not.toHaveBeenCalled();
  });

  it('purges expired data and removes the purged boards’ images', async () => {
    const d = deps(['a', 'b']);
    const res = await handlePurge(cron('Bearer s3cret'), 's3cret', d);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ boards_purged: 2, audit_events_purged: 3, media_errors: [] });
    expect(d.removed).toEqual(['a', 'b']);
  });

  it('reports images it could not remove', async () => {
    const res = await handlePurge(cron('Bearer s3cret'), 's3cret', deps(['a', 'b'], ['a']));
    expect(res.status).toBe(500);
    expect((await res.json()).media_errors).toEqual(['a']);
  });

  it('needs the service role key', async () => {
    expect(createPurgeDeps({ SUPABASE_URL: 'https://x.supabase.co' })).toBeNull();
    expect((await handlePurge(cron('Bearer s3cret'), 's3cret', null)).status).toBe(503);
  });
});
