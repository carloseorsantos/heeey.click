/**
 * Runs schema.sql, storage.sql and every migration (twice, to check they are
 * re-runnable) in a real Postgres (PGlite/WASM) with minimal Supabase stubs, then
 * checks triggers and RLS as the anon/authenticated roles.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { unaccent } from '@electric-sql/pglite/contrib/unaccent';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(__dirname, '..');
const A = '00000000-0000-4000-8000-00000000000a';
const B = '00000000-0000-4000-8000-00000000000b';
const BOARD = '10000000-0000-4000-8000-000000000001';

const SUPABASE_STUBS = `
create schema if not exists extensions;
create schema auth;
create table auth.users (id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create schema storage;
create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
alter table storage.objects enable row level security;
create role anon; create role authenticated;
grant usage on schema auth, extensions, public, storage to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
-- Like Supabase: new tables in public are granted to the API roles when created
alter default privileges in schema public grant select, insert, update, delete on tables to anon, authenticated;
grant select, insert, update, delete on storage.objects to anon, authenticated;
create publication supabase_realtime;
`;

let db: PGlite;

/** Runs a statement as a user (authenticated role) or as anon (user = null); RLS applies */
async function as(user: string | null, sql: string, params: unknown[] = []) {
  await db.exec(
    `reset role; select set_config('request.jwt.claim.sub', '${user ?? ''}', false); set role ${user ? 'authenticated' : 'anon'};`
  );
  try {
    return { rows: (await db.query<any>(sql, params)).rows, error: undefined as string | undefined };
  } catch (e: any) {
    return { rows: [] as any[], error: String(e.message) };
  } finally {
    await db.exec('reset role');
  }
}

/** Setup statements as the superuser, with no JWT user */
async function sys(sql: string) {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`);
  await db.exec(sql);
}

const board = async (id = BOARD) => (await db.query<any>('select * from public.boards where id = $1', [id])).rows[0];
const texts = (list: string[]) =>
  JSON.stringify(list.map((text, i) => ({ id: `e${i}`, type: 'text', text, version: 1, isDeleted: false })));

describe('database schema and migrations', () => {
  beforeAll(async () => {
    db = new PGlite({ extensions: { unaccent, pgcrypto } });
    await db.exec(SUPABASE_STUBS);
    await db.exec(fs.readFileSync(path.join(root, 'schema.sql'), 'utf8'));
    await db.exec(fs.readFileSync(path.join(root, 'storage.sql'), 'utf8'));
    const migrations = fs.readdirSync(path.join(root, 'migrations')).filter((f) => f.endsWith('.sql')).sort();
    for (let round = 0; round < 2; round++) {
      for (const file of migrations) await db.exec(fs.readFileSync(path.join(root, 'migrations', file), 'utf8'));
    }
    await db.exec(`insert into auth.users values ('${A}'), ('${B}');`);
    const created = await as(A, `insert into public.boards (id, title, owner_id, elements) values ($1, 'Planejamento Q4', $2, $3::jsonb)`, [
      BOARD,
      A,
      texts(['Reunião de planejamento']),
    ]);
    expect(created.error).toBeUndefined();
  }, 60_000);

  describe('trash and delete', () => {
    it('thumbnail-only updates do not count as edits', async () => {
      await sys(`update public.boards set updated_at = now() - interval '1 day' where id = '${BOARD}'`);
      const before = (await board()).updated_at;
      expect((await as(A, `update public.boards set thumbnail = 'data:x' where id = $1`, [BOARD])).error).toBeUndefined();
      expect(+(await board()).updated_at).toBe(+before);
    });

    it('only the owner trashes; trashed boards are read-only until restored', async () => {
      expect((await as(B, `update public.boards set deleted_at = now() where id = $1`, [BOARD])).error).toMatch(/proprietário/);
      const before = (await board()).updated_at;
      expect((await as(A, `update public.boards set deleted_at = now() where id = $1`, [BOARD])).error).toBeUndefined();
      expect(+(await board()).updated_at).toBe(+before);
      expect((await as(A, `update public.boards set elements = '[]' where id = $1`, [BOARD])).error).toMatch(/lixeira/);
      expect((await as(A, `update public.boards set deleted_at = null where id = $1`, [BOARD])).error).toBeUndefined();
    });

    it('nobody but the signed-in owner can hard-delete', async () => {
      const guest = '10000000-0000-4000-8000-000000000009';
      await as(null, `insert into public.boards (id, title) values ($1, 'guest')`, [guest]);
      expect((await as(null, `delete from public.boards where id = $1 returning id`, [guest])).rows).toHaveLength(0);
      expect((await as(B, `delete from public.boards where id = $1 returning id`, [BOARD])).rows).toHaveLength(0);
    });
  });

  describe('version history', () => {
    it('snapshots the previous scene at most every 10 minutes', async () => {
      await as(A, `update public.boards set elements = $2::jsonb where id = $1`, [BOARD, texts(['Reunião de planejamento', 'Novo item'])]);
      await as(A, `update public.boards set elements = $2::jsonb where id = $1`, [BOARD, texts(['a', 'b', 'c'])]);
      const versions = (await db.query<any>('select element_count, reason from public.board_versions where board_id = $1', [BOARD])).rows;
      expect(versions).toEqual([{ element_count: 1, reason: 'auto' }]);
    });

    it('snapshot_board and history reads follow edit permissions', async () => {
      expect((await as(A, `select public.snapshot_board($1)`, [BOARD])).error).toBeUndefined();
      expect((await as(A, `select count(*)::int as n from public.board_versions where board_id = $1`, [BOARD])).rows[0].n).toBe(2);

      await as(A, `update public.boards set access_level = 'view' where id = $1`, [BOARD]);
      expect((await as(B, `select count(*)::int as n from public.board_versions where board_id = $1`, [BOARD])).rows[0].n).toBe(0);
      expect((await as(B, `select public.snapshot_board($1)`, [BOARD])).error).toBeDefined();
      expect((await as(B, `insert into public.board_versions (board_id, title) values ($1, 'x')`, [BOARD])).error).toBeDefined();
      await as(A, `update public.boards set access_level = 'edit' where id = $1`, [BOARD]);
    });
  });

  describe('folders', () => {
    it('keeps folders private, acyclic and owner-managed', async () => {
      const parent = (await as(A, `insert into public.folders (owner_id, name) values ($1, 'Trabalho') returning id`, [A])).rows[0].id;
      const child = (await as(A, `insert into public.folders (owner_id, name, parent_id) values ($1, 'Sub', $2) returning id`, [A, parent])).rows[0].id;

      expect((await as(A, `update public.folders set parent_id = $2 where id = $1`, [parent, child])).error).toMatch(/dentro dela mesma/);
      expect((await as(B, `select count(*)::int as n from public.folders`)).rows[0].n).toBe(0);
      expect((await as(B, `insert into public.folders (owner_id, name, parent_id) values ($1, 'x', $2)`, [B, parent])).error).toBeDefined();
      expect((await as(A, `insert into public.folders (owner_id, name) values ($1, 'x')`, [B])).error).toBeDefined();

      const before = (await board()).updated_at;
      expect((await as(A, `update public.boards set folder_id = $2 where id = $1`, [BOARD, child])).error).toBeUndefined();
      expect(+(await board()).updated_at).toBe(+before);
      expect((await as(B, `update public.boards set folder_id = null where id = $1`, [BOARD])).error).toBeDefined();

      expect((await as(A, `delete from public.folders where id = $1`, [parent])).error).toBeUndefined();
      expect((await board()).folder_id).toBeNull();
    });
  });

  describe('personal library', () => {
    it('is private to its owner and upserts', async () => {
      const upsert = (user: string, owner: string, items: string) =>
        as(user, `insert into public.user_libraries (user_id, items) values ($1, $2::jsonb)
                  on conflict (user_id) do update set items = excluded.items`, [owner, items]);

      expect((await upsert(A, A, '[{"id":"lib-1"}]')).error).toBeUndefined();
      expect((await upsert(A, A, '[{"id":"lib-1"},{"id":"lib-2"}]')).error).toBeUndefined();
      expect((await as(A, `select jsonb_array_length(items) as n from public.user_libraries`)).rows).toEqual([{ n: 2 }]);

      expect((await as(B, `select count(*)::int as n from public.user_libraries`)).rows[0].n).toBe(0);
      expect((await upsert(B, A, '[]')).error).toBeDefined();
      expect((await as(null, `select count(*)::int as n from public.user_libraries`)).rows[0].n).toBe(0);
      expect((await upsert(A, A, '{"not":"an array"}')).error).toBeDefined();
    });
  });

  describe('API keys', () => {
    it('creates a key once, stores only its hash and hides the hash from clients', async () => {
      const created = await as(A, `select * from public.create_api_key('Agente', array['read'])`);
      expect(created.error).toBeUndefined();
      const { key, prefix } = created.rows[0];
      expect(key).toMatch(/^hk_[0-9a-f]{8}_[0-9a-f]{40}$/);
      expect(key.startsWith(prefix)).toBe(true);

      const stored = (await db.query<any>('select key_hash from public.api_keys where prefix = $1', [prefix])).rows[0];
      expect(stored.key_hash).not.toContain(key.slice(12));
      expect((await as(A, `select key_hash from public.api_keys`)).error).toMatch(/permission denied/);
      expect((await as(A, `select name, scopes from public.api_keys`)).rows).toEqual([{ name: 'Agente', scopes: ['read'] }]);
      expect((await as(B, `select count(*)::int as n from public.api_keys`)).rows[0].n).toBe(0);
      expect((await as(null, `select * from public.create_api_key('x')`)).error).toBeDefined();
      expect((await as(A, `insert into public.api_keys (user_id, name, prefix, key_hash) values ($1, 'x', 'p', 'h')`, [A])).error).toBeDefined();
    });

    it('api_authenticate checks the key, scope and revocation, and becomes the user', async () => {
      const { key, id } = (await as(A, `select * from public.create_api_key('Leitura', array['read'])`)).rows[0];
      await sys('select 1');
      const uid = (await db.query<any>(`select public.api_authenticate($1, 'read') as u, auth.uid() as me`, [key])).rows[0];
      expect(uid).toEqual({ u: A, me: A });
      await expect(db.query(`select public.api_authenticate($1, 'write')`, [key])).rejects.toThrow(/escrita/);
      await expect(db.query(`select public.api_authenticate('hk_nope', 'read')`)).rejects.toThrow(/inválida/);
      expect((await as(null, `select public.api_authenticate($1, 'read')`, [key])).error).toMatch(/permission denied/);

      expect((await as(B, `select public.revoke_api_key($1) as ok`, [id])).rows[0].ok).toBe(false);
      expect((await as(A, `select public.revoke_api_key($1) as ok`, [id])).rows[0].ok).toBe(true);
      await expect(db.query(`select public.api_authenticate($1, 'read')`, [key])).rejects.toThrow(/revogada/);
    });
  });

  describe('search', () => {
    it('matches titles and canvas text by unaccented prefix, for the owner only', async () => {
      await as(A, `update public.boards set elements = $2::jsonb where id = $1`, [BOARD, texts(['Reunião de planejamento', 'Orçamento anual'])]);
      const search = (user: string, q: string) => as(user, `select id, content from public.search_boards($1)`, [q]);

      const hit = await search(A, 'reuniao plan');
      expect(hit.rows).toHaveLength(1);
      expect(hit.rows[0].content).toContain('Reunião');
      expect((await search(A, 'orcamento')).rows).toHaveLength(1);
      expect((await search(A, 'q4')).rows).toHaveLength(1);
      expect((await search(A, 'inexistente')).rows).toHaveLength(0);
      expect((await search(B, 'reuniao')).rows).toHaveLength(0);
      expect((await search(A, '!!! & | :*')).error).toBeUndefined();

      await as(A, `update public.boards set deleted_at = now() where id = $1`, [BOARD]);
      expect((await search(A, 'reuniao')).rows).toHaveLength(0);
      await as(A, `update public.boards set deleted_at = null where id = $1`, [BOARD]);
    });
  });
});
