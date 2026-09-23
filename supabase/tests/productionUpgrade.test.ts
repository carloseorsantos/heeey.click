/**
 * Upgrading a database created before the schema.sql hardening (the production
 * state inspected on 2026-09-23): only migrations are applied, not schema.sql.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { unaccent } from '@electric-sql/pglite/contrib/unaccent';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import fs from 'node:fs';
import path from 'node:path';
import { SUPABASE_STUBS } from './supabaseStubs';

const root = path.resolve(__dirname, '..');
const A = '00000000-0000-4000-8000-00000000000a';
const B = '00000000-0000-4000-8000-00000000000b';
const BOARD = '10000000-0000-4000-8000-000000000001';

// Older schema: updated_at-only trigger and loose policies
const LEGACY_SCHEMA = `
create table public.boards (
  id uuid primary key default gen_random_uuid(),
  title text not null default 'Quadro sem título',
  owner_id uuid references auth.users(id) on delete set null,
  elements jsonb not null default '[]', app_state jsonb not null default '{}', files jsonb not null default '{}',
  access_level text not null default 'edit' check (access_level in ('edit', 'view')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
-- Supabase grants the API roles on tables created in public
grant select, insert, update, delete on public.boards to anon, authenticated;
grant select, insert, update, delete on storage.objects to anon, authenticated;
alter publication supabase_realtime add table public.boards;
create function public.handle_updated_at() returns trigger language plpgsql security definer set search_path to ''
  as $$ begin new.updated_at = timezone('utc'::text, now()); return new; end; $$;
create trigger set_boards_updated_at before update on public.boards for each row execute function handle_updated_at();
alter table public.boards enable row level security;
create policy "Permitir leitura pública dos quadros" on public.boards for select using (true);
create policy "Permitir criação pública de quadros" on public.boards for insert
  with check (((auth.uid() is null) and (owner_id is null)) or ((auth.uid() is not null) and ((owner_id = auth.uid()) or (owner_id is null))));
create policy "Permitir exclusão apenas pelo proprietário" on public.boards for delete using (auth.uid() = owner_id);
create policy "Permitir atualização por proprietário ou em quadros editáveis" on public.boards for update
  using ((auth.uid() = owner_id) or (access_level = 'edit') or ((owner_id is null) and (access_level = 'edit')))
  with check ((auth.uid() = owner_id) or (access_level = 'edit') or ((owner_id is null) and (access_level = 'edit')));
insert into storage.buckets (id, name, public) values ('board-media', 'board-media', true);
create policy "Permitir exclusão de imagens no board-media" on storage.objects for delete using (bucket_id = 'board-media');
create policy "Permitir atualização de imagens no board-media" on storage.objects for update using (bucket_id = 'board-media');
create policy "Permitir upload de imagens no board-media" on storage.objects for insert with check (bucket_id = 'board-media');
create policy "Permitir leitura pública de imagens no board-media" on storage.objects for select using (bucket_id = 'board-media');
`;

let db: PGlite;

async function as(user: string | null, sql: string, params: unknown[] = []) {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${user ?? ''}', false); set role ${user ? 'authenticated' : 'anon'};`);
  try {
    return { rows: (await db.query<any>(sql, params)).rows, error: undefined as string | undefined };
  } catch (e: any) {
    return { rows: [] as any[], error: String(e.message) };
  } finally {
    await db.exec('reset role');
  }
}

describe('upgrading a pre-hardening database with the migrations', () => {
  beforeAll(async () => {
    db = new PGlite({ extensions: { unaccent, pgcrypto } });
    await db.exec(SUPABASE_STUBS);
    await db.exec(LEGACY_SCHEMA);
    await db.exec(`
      insert into auth.users values ('${A}'), ('${B}');
      insert into public.boards (id, title, owner_id, elements) values ('${BOARD}', 'Existente', '${A}', '[{"id":"e","type":"text","text":"Olá mundo"}]');
      insert into storage.objects (bucket_id, name) values ('board-media', '${BOARD}/img.webp');
    `);
    const migrations = fs.readdirSync(path.join(root, 'migrations')).filter((f) => f.endsWith('.sql')).sort();
    for (let round = 0; round < 2; round++) {
      for (const file of migrations) await db.exec(fs.readFileSync(path.join(root, 'migrations', file), 'utf8'));
    }
  }, 60_000);

  it('replaces the updated_at-only trigger', async () => {
    const triggers = (await db.query<any>(`select pg_get_triggerdef(oid) as d from pg_trigger where tgrelid = 'public.boards'::regclass and not tgisinternal`)).rows.map((r) => r.d);
    expect(triggers.some((d) => /set_boards_updated_at.*handle_board_update/.test(d))).toBe(true);
    expect((await db.query<any>(`select count(*)::int as n from pg_proc where proname = 'handle_updated_at'`)).rows[0].n).toBe(0);
  });

  it('closes the ownership and access-level holes', async () => {
    expect((await as(B, `update public.boards set owner_id = $2 where id = $1`, [BOARD, B])).error).toBeDefined();
    expect((await as(B, `update public.boards set access_level = 'view' where id = $1`, [BOARD])).error).toBeDefined();
  });

  it('enforces the trash rules', async () => {
    expect((await as(B, `update public.boards set deleted_at = now() where id = $1`, [BOARD])).error).toMatch(/proprietário/);
    await as(A, `update public.boards set deleted_at = now() where id = $1`, [BOARD]);
    expect((await as(A, `update public.boards set elements = '[]' where id = $1`, [BOARD])).error).toMatch(/lixeira/);
    await as(A, `update public.boards set deleted_at = null where id = $1`, [BOARD]);
  });

  it('protects board images from other users', async () => {
    expect((await as(B, `delete from storage.objects where name like $1 returning id`, [`${BOARD}/%`])).rows).toHaveLength(0);
    expect((await as(A, `delete from storage.objects where name like $1 returning id`, [`${BOARD}/%`])).rows).toHaveLength(1);
  });

  it('keeps existing data and indexes it for search', async () => {
    expect((await db.query<any>(`select title from public.boards where id = $1`, [BOARD])).rows[0].title).toBe('Existente');
    expect((await as(A, `select id from public.search_boards('ola mun')`)).rows).toHaveLength(1);
  });
});
