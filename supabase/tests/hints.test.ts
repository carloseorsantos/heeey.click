/**
 * Board hints (supabase/migrations/20260928120000_user_hints.sql): each signed-in user only
 * reads their own rows, and every write goes through record_hint_event / import_guest_hint.
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

const record = (user: string | null, key: string, event: string, tz: string | null = 'UTC') =>
  t.as(user, `select public.record_hint_event($1, $2, $3) as h`, [key, event, tz]);

const importHint = (user: string | null, key: string, shown: number, day: string | null, dismissed = false, used = false) =>
  t.as(user, `select public.import_guest_hint($1, $2, $3::date, $4, $5) as h`, [key, shown, day, dismissed, used]);

/** Moves the last shown day back, as if the hint had been seen `days` days earlier */
const ageHint = (user: string, key: string, days = 1) =>
  t.sys(`update public.user_hints set last_shown_day = last_shown_day - $3::int where user_id = $1 and hint_key = $2`, [user, key, days]);

const row = async (user: string, key: string) =>
  (await t.sys(`select * from public.user_hints where user_id = $1 and hint_key = $2`, [user, key]))[0];

const utcDay = async (offset = 0) =>
  (await t.sys(`select to_char((now() at time zone 'UTC')::date + $1::int, 'YYYY-MM-DD') as d`, [offset]))[0].d as string;

const iso = (d: Date | string | null) => (d instanceof Date ? d.toISOString().slice(0, 10) : d);

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
        expect((await t.as(user, `update public.user_hints set shown_days = 0, dismissed_at = null where user_id = $1`, [a])).code).toBe('42501');
        expect((await t.as(user, `delete from public.user_hints where user_id = $1`, [a])).code).toBe('42501');
      }
      expect((await row(a, 'export-ai')).shown_days).toBe(1);
    });

    it('only signed-in users can call the functions', async () => {
      expect((await record(null, 'export-ai', 'shown')).code).toBe('42501');
      expect((await importHint(null, 'export-ai', 1, null, true)).code).toBe('42501');
      // Not only rejected at runtime: anon has no execute grant at all
      const grants = await t.sys(
        `select has_function_privilege('anon', 'public.record_hint_event(text, text, text)', 'execute') as rec,
                has_function_privilege('anon', 'public.import_guest_hint(text, integer, date, boolean, boolean)', 'execute') as imp,
                has_function_privilege('authenticated', 'public.record_hint_event(text, text, text)', 'execute') as rec_auth,
                has_function_privilege('authenticated', 'public.import_guest_hint(text, integer, date, boolean, boolean)', 'execute') as imp_auth`
      );
      expect(grants[0]).toEqual({ rec: false, imp: false, rec_auth: true, imp_auth: true });
    });

    it('the internal helpers are not callable from the API', async () => {
      const helpers = [
        'public.check_hint_key(text)',
        'public.hint_local_day(text)',
        'public.check_hint_limit(uuid, text)',
        'public.hint_json(uuid, text)',
      ];
      for (const fn of helpers) {
        for (const role of ['anon', 'authenticated']) {
          const [{ ok }] = await t.sys(`select has_function_privilege($1, $2, 'execute') as ok`, [role, fn]);
          expect(ok, `${role} ${fn}`).toBe(false);
        }
      }
    });
  });

  describe('validation', () => {
    it('rejects invalid hint keys', async () => {
      const a = await newUser();
      for (const key of ['Export-AI', 'export ai', '', 'a'.repeat(65), 'export_ai', 'dica/1']) {
        expect((await record(a, key, 'shown')).code, key).toBe('22023');
        expect((await importHint(a, key, 1, null)).code, key).toBe('22023');
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
      expect((await importHint(many, 'hint-51', 1, null, true)).code).toBe('22023');
      // Existing hints still work at the cap
      expect((await record(many, 'hint-0', 'used')).error).toBeUndefined();
      expect((await importHint(many, 'hint-1', 1, null, true)).error).toBeUndefined();
    });
  });

  describe('counting days', () => {
    it('shown counts once per day and again on a later day', async () => {
      const a = await newUser();
      const first = (await record(a, 'export-ai', 'shown')).rows[0].h;
      expect(first).toMatchObject({ hint_key: 'export-ai', shown_days: 1, dismissed_at: null, used_at: null });
      expect(first.first_shown_at).toBeTruthy();
      // Compared with the day the function itself saved, so a midnight rollover cannot break it
      await t.sys(`update public.user_hints set last_shown_day = $2::date + 1 where user_id = $1`, [a, first.last_shown_day]);
      await record(a, 'export-ai', 'shown');
      expect((await row(a, 'export-ai')).shown_days).toBe(1);

      await ageHint(a, 'export-ai', 2);
      expect((await record(a, 'export-ai', 'shown')).rows[0].h.shown_days).toBe(2);
    });

    it('going back to an earlier day (another time zone) does not count', async () => {
      const a = await newUser();
      await record(a, 'tz-hop', 'shown', 'Pacific/Kiritimati'); // UTC+14: always the latest day
      await record(a, 'tz-hop', 'shown', 'Etc/GMT+12'); // UTC-12
      await record(a, 'tz-hop', 'shown', 'UTC');
      expect((await row(a, 'tz-hop')).shown_days).toBe(1);
    });

    it('an invalid or missing time zone counts as UTC, and any zone stays within a day of UTC', async () => {
      for (const tz of ['Not/AZone', "UTC'; drop table x", '', null, 'UTC+100', 'EST5EDT']) {
        const a = await newUser();
        const before = await utcDay(-1);
        const r = await record(a, 'tz', 'shown', tz);
        const after = await utcDay(1);
        expect(r.error, String(tz)).toBeUndefined();
        const day = iso(r.rows[0].h.last_shown_day)!;
        expect(day >= before && day <= after, `${tz}: ${day}`).toBe(true);
      }
      // Omitted argument uses the default
      const a = await newUser();
      expect((await t.as(a, `select public.record_hint_event('tz', 'shown') as h`)).rows[0].h.shown_days).toBe(1);
    });

    it('dismissed and used keep the first timestamp and are not views', async () => {
      const a = await newUser();
      await record(a, 'keep-first', 'dismissed');
      await record(a, 'keep-first', 'used');
      const before = await row(a, 'keep-first');
      await t.sys(`select pg_sleep(0.01)`);
      await record(a, 'keep-first', 'dismissed');
      await record(a, 'keep-first', 'used');
      const after = await row(a, 'keep-first');
      expect(+after.dismissed_at).toBe(+before.dismissed_at);
      expect(+after.used_at).toBe(+before.used_at);
      expect(after.shown_days).toBe(0);
      expect(after.last_shown_day).toBeNull();
    });

    it('a view after dismissing is still recorded', async () => {
      const a = await newUser();
      await record(a, 'late-view', 'dismissed');
      const r = (await record(a, 'late-view', 'shown')).rows[0].h;
      expect(r.shown_days).toBe(1);
      expect(r.dismissed_at).toBeTruthy();
    });
  });

  describe('guest import', () => {
    it('imports when the account has no record, clamping browser values', async () => {
      const a = await newUser();
      const r = await importHint(a, 'imported', 999, '2026-01-01', true);
      expect(r.error).toBeUndefined();
      expect(r.rows[0].h).toMatchObject({ hint_key: 'imported', shown_days: 366, last_shown_day: '2026-01-01', used_at: null });
      expect(r.rows[0].h.dismissed_at).toBeTruthy();

      const negative = (await importHint(a, 'negative', -5, null, false, true)).rows[0].h;
      expect(negative.shown_days).toBe(0);
      expect(negative.used_at).toBeTruthy();
    });

    it('keeps the last shown day only between 2020 and tomorrow (UTC)', async () => {
      const a = await newUser();
      const tomorrow = await utcDay(1);
      const later = await utcDay(3);
      expect((await importHint(a, 'tomorrow', 1, tomorrow)).rows[0].h.last_shown_day).toBe(tomorrow);
      expect((await importHint(a, 'later', 1, later)).rows[0].h.last_shown_day).toBeNull();
      expect((await importHint(a, 'future', 2, '2999-01-01')).rows[0].h).toMatchObject({ shown_days: 2, last_shown_day: null });
      expect((await importHint(a, 'old', 1, '1999-12-31')).rows[0].h.last_shown_day).toBeNull();
      expect((await importHint(a, 'inf', 1, '-infinity')).rows[0].h.last_shown_day).toBeNull();
    });

    it('an imported day ahead of today keeps today from counting again', async () => {
      const a = await newUser();
      await importHint(a, 'ahead', 1, await utcDay(1));
      await record(a, 'ahead', 'shown');
      expect((await row(a, 'ahead')).shown_days).toBe(1);
    });

    it('with an existing record, only adds dismissed/used and keeps the account counter', async () => {
      const a = await newUser();
      await record(a, 'export-ai', 'shown');
      const r = (await importHint(a, 'export-ai', 3, null, true)).rows[0].h;
      expect(r.shown_days).toBe(1);
      expect(r.dismissed_at).toBeTruthy();
      expect(r.used_at).toBeNull();

      // An empty or "not dismissed" guest state never clears what the account has
      await importHint(a, 'export-ai', 0, null, false, false);
      expect((await row(a, 'export-ai')).dismissed_at).not.toBeNull();
    });

    it('skips an empty guest state', async () => {
      const a = await newUser();
      expect((await importHint(a, 'nothing', 0, null)).rows[0].h).toBeNull();
      expect(await row(a, 'nothing')).toBeUndefined();
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
    const [{ rec }] = await t.sys(`select has_function_privilege('anon', 'public.record_hint_event(text, text, text)', 'execute') as rec`);
    expect(rec).toBe(false);
  });
});
