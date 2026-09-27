/**
 * Board hints (supabase/migrations/20260928120000_user_hints.sql): each signed-in user only
 * reads their own rows, and every write goes through record_hint_event.
 * Each test creates its own user, so tests do not depend on each other's rows.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { createTestDb, TestDb } from './harness';

let t: TestDb;
let seq = 0;

/** A fresh signed-up user */
async function newUser() {
  const id = `00000000-0000-4000-8000-${String(0xc00 + ++seq).padStart(12, '0')}`;
  await t.signUp(id, `hints-${seq}@heeey.test`);
  return id;
}

const record = (user: string | null, key: string, event: string) =>
  t.as(user, `select public.record_hint_event($1, $2) as h`, [key, event]);

const row = async (user: string, key: string) =>
  (await t.sys(`select * from public.user_hints where user_id = $1 and hint_key = $2`, [user, key]))[0];

describe('user hints', () => {
  beforeAll(async () => {
    t = await createTestDb();
  }, 60_000);

  describe('access', () => {
    it('the owner reads their own rows; other users and anon read nothing', async () => {
      const [a, b] = [await newUser(), await newUser()];
      expect((await record(a, 'export-ai', 'shown')).error).toBeUndefined();
      expect((await t.as(a, `select hint_key from public.user_hints`)).rows).toEqual([{ hint_key: 'export-ai' }]);
      expect((await t.as(b, `select count(*)::int as n from public.user_hints`)).rows[0].n).toBe(0);
      expect((await t.as(null, `select count(*) from public.user_hints`)).code).toBe('42501');
    });

    it('nobody writes to the table directly', async () => {
      const a = await newUser();
      await record(a, 'export-ai', 'shown');
      for (const user of [a, null]) {
        expect((await t.as(user, `insert into public.user_hints (user_id, hint_key) values ($1, 'direct')`, [a])).code).toBe('42501');
        expect((await t.as(user, `update public.user_hints set shown_at = null, dismissed_at = null where user_id = $1`, [a])).code).toBe('42501');
        expect((await t.as(user, `delete from public.user_hints where user_id = $1`, [a])).code).toBe('42501');
      }
      expect((await row(a, 'export-ai')).shown_at).not.toBeNull();
    });

    it('only signed-in users can call the function', async () => {
      expect((await record(null, 'export-ai', 'shown')).code).toBe('42501');
      // Not only rejected at runtime: anon has no execute grant at all
      const grants = await t.sys(
        `select has_function_privilege('anon', 'public.record_hint_event(text, text)', 'execute') as anon,
                has_function_privilege('authenticated', 'public.record_hint_event(text, text)', 'execute') as auth`
      );
      expect(grants[0]).toEqual({ anon: false, auth: true });
    });
  });

  describe('validation', () => {
    it('rejects invalid hint keys', async () => {
      const a = await newUser();
      for (const key of ['Export-AI', 'export ai', '', 'a'.repeat(65), 'export_ai', 'dica/1']) {
        expect((await record(a, key, 'shown')).code, key).toBe('22023');
      }
      expect((await t.as(a, `select public.record_hint_event(null, 'shown')`)).code).toBe('22023');
      expect((await t.sys(`select count(*)::int as n from public.user_hints where user_id = $1`, [a]))[0].n).toBe(0);
    });

    it('rejects invalid events', async () => {
      const a = await newUser();
      for (const event of ['open', 'SHOWN', '']) expect((await record(a, 'export-ai', event)).code, event).toBe('22023');
      expect((await t.as(a, `select public.record_hint_event('export-ai', null)`)).code).toBe('22023');
    });

    it('caps how many hints one account can create', async () => {
      const many = await newUser();
      for (let i = 0; i < 50; i++) expect((await record(many, `hint-${i}`, 'shown')).error).toBeUndefined();
      expect((await record(many, 'hint-50', 'shown')).code).toBe('22023');
      // Existing hints still work at the cap
      expect((await record(many, 'hint-0', 'used')).error).toBeUndefined();
    });
  });

  describe('events', () => {
    it('each event sets its own timestamp and returns the hint', async () => {
      const a = await newUser();
      const shown = (await record(a, 'export-ai', 'shown')).rows[0].h;
      expect(shown).toMatchObject({ hint_key: 'export-ai', dismissed_at: null, used_at: null });
      expect(shown.shown_at).toBeTruthy();
      const dismissed = (await record(a, 'export-ai', 'dismissed')).rows[0].h;
      expect(dismissed.shown_at).toBe(shown.shown_at);
      expect(dismissed.dismissed_at).toBeTruthy();
      expect(dismissed.used_at).toBeNull();
    });

    it('every timestamp keeps the first value', async () => {
      const a = await newUser();
      for (const event of ['shown', 'dismissed', 'used']) await record(a, 'keep-first', event);
      const before = await row(a, 'keep-first');
      await t.sys(`select pg_sleep(0.01)`);
      for (const event of ['shown', 'dismissed', 'used']) await record(a, 'keep-first', event);
      const after = await row(a, 'keep-first');
      expect(+after.shown_at).toBe(+before.shown_at);
      expect(+after.dismissed_at).toBe(+before.dismissed_at);
      expect(+after.used_at).toBe(+before.used_at);
    });

    it('using the feature before ever seeing the hint does not count as shown', async () => {
      const a = await newUser();
      const r = (await record(a, 'used-first', 'used')).rows[0].h;
      expect(r.used_at).toBeTruthy();
      expect(r.shown_at).toBeNull();
      // A later view is still recorded
      expect((await record(a, 'used-first', 'shown')).rows[0].h.shown_at).toBeTruthy();
    });
  });

  it('deleting the account deletes its hints', async () => {
    const gone = await newUser();
    await record(gone, 'export-ai', 'shown');
    expect(await row(gone, 'export-ai')).toBeDefined();
    await t.sys(`delete from auth.users where id = $1`, [gone]);
    expect((await t.sys(`select count(*)::int as n from public.user_hints where user_id = $1`, [gone]))[0].n).toBe(0);
  });

  it('keeps the grants after the migration runs again', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const sql = fs.readFileSync(path.resolve(__dirname, '../migrations/20260928120000_user_hints.sql'), 'utf8');
    await t.db.exec(sql);
    const a = await newUser();
    expect((await record(a, 'again', 'shown')).error).toBeUndefined();
    expect((await t.as(null, `select count(*) from public.user_hints`)).code).toBe('42501');
    expect((await t.as(a, `insert into public.user_hints (user_id, hint_key) values ($1, 'x')`, [a])).code).toBe('42501');
    const [{ rec }] = await t.sys(`select has_function_privilege('anon', 'public.record_hint_event(text, text)', 'execute') as rec`);
    expect(rec).toBe(false);
  });
});
