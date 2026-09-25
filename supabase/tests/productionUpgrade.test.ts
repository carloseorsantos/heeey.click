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

// `link` is the board opened by link (the x-board-id request header the app sends)
async function as(user: string | null, sql: string, params: unknown[] = [], link: string | null = BOARD) {
  const headers = link ? JSON.stringify({ 'x-board-id': link }) : '{}';
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${user ?? ''}', false); select set_config('request.headers', '${headers}', false); set role ${user ? 'authenticated' : 'anon'};`);
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
    expect((await as(B, `update public.boards set deleted_at = now() where id = $1`, [BOARD])).error).toMatch(/lixeira/);
    await as(A, `update public.boards set deleted_at = now() where id = $1`, [BOARD]);
    expect((await as(A, `update public.boards set elements = '[]' where id = $1`, [BOARD])).error).toMatch(/lixeira/);
    await as(A, `update public.boards set deleted_at = null where id = $1`, [BOARD]);
  });

  it('protects board images from other users', async () => {
    expect((await as(B, `delete from storage.objects where name like $1 returning id`, [`${BOARD}/%`])).rows).toHaveLength(0);
    expect((await as(A, `delete from storage.objects where name like $1 returning id`, [`${BOARD}/%`])).rows).toHaveLength(1);
  });

  it('gives every existing user a personal team and moves their boards into it, restricting open links in 30 days', async () => {
    const teams = (await db.query<any>(`select created_by, is_personal from public.teams order by created_by`)).rows;
    expect(teams).toEqual([
      { created_by: A, is_personal: true },
      { created_by: B, is_personal: true },
    ]);
    const board = (await db.query<any>(
      `select b.access_level, round(extract(epoch from b.restrict_link_at - now()) / 86400)::int as remaining_days, p.is_default, t.created_by
       from public.boards b join public.projects p on p.id = b.project_id join public.teams t on t.id = b.team_id
       where b.id = $1`,
      [BOARD]
    )).rows[0];
    expect(board).toMatchObject({ access_level: 'edit', is_default: true, created_by: A });
    expect(board.remaining_days).toBe(30);
    // The link keeps working meanwhile, and the owner still manages the board
    expect((await as(null, `select id from public.boards where id = $1`, [BOARD])).rows).toHaveLength(1);
    expect((await as(A, `select public.get_board_access($1) as a`, [BOARD])).rows[0].a.permission).toBe('manage');
  });

  it('keeps existing data and indexes it for search', async () => {
    expect((await db.query<any>(`select title from public.boards where id = $1`, [BOARD])).rows[0].title).toBe('Existente');
    expect((await as(A, `select id from public.search_boards('ola mun')`)).rows).toHaveLength(1);
  });
});

/**
 * The production state before the teams migration (2026-09-25): every earlier migration
 * applied, users with nested folders and boards inside them, plus anonymous boards.
 */
describe('upgrading to teams with folders and boards inside them', () => {
  const FOLDER = '30000000-0000-4000-8000-000000000001';
  const CHILD = '30000000-0000-4000-8000-000000000002';
  const IN_CHILD = '10000000-0000-4000-8000-000000000011';
  const ANON = '10000000-0000-4000-8000-000000000012';

  beforeAll(async () => {
    db = new PGlite({ extensions: { unaccent, pgcrypto } });
    await db.exec(SUPABASE_STUBS);
    await db.exec(fs.readFileSync(path.join(root, 'schema.sql'), 'utf8'));
    await db.exec(fs.readFileSync(path.join(root, 'storage.sql'), 'utf8'));
    const migrations = fs.readdirSync(path.join(root, 'migrations')).filter((f) => f.endsWith('.sql')).sort();
    const teams = migrations.findIndex((f) => f.includes('teams_projects_sharing'));
    for (const file of migrations.slice(0, teams)) await db.exec(fs.readFileSync(path.join(root, 'migrations', file), 'utf8'));
    await db.exec(`
      insert into auth.users (id) values ('${A}'), ('${B}');
      insert into public.folders (id, owner_id, name) values ('${FOLDER}', '${A}', 'Pai');
      insert into public.folders (id, owner_id, name, parent_id) values ('${CHILD}', '${A}', 'Filha', '${FOLDER}');
      insert into public.boards (id, title, owner_id, folder_id) values ('${IN_CHILD}', 'Na pasta filha', '${A}', '${CHILD}');
      insert into public.boards (id, title) values ('${ANON}', 'Anônimo');
    `);
    for (const file of migrations.slice(teams)) await db.exec(fs.readFileSync(path.join(root, 'migrations', file), 'utf8'));
  }, 60_000);

  it('moves folders and the boards inside them to the personal project, keeping the tree', async () => {
    const rows = (await db.query<any>(
      `select f.id, f.parent_id, p.is_default, t.created_by from public.folders f
       join public.projects p on p.id = f.project_id join public.teams t on t.id = f.team_id order by f.name`
    )).rows;
    expect(rows).toEqual([
      { id: CHILD, parent_id: FOLDER, is_default: true, created_by: A },
      { id: FOLDER, parent_id: null, is_default: true, created_by: A },
    ]);
    const board = (await db.query<any>(`select folder_id, project_id is not null as has_project from public.boards where id = $1`, [IN_CHILD])).rows[0];
    expect(board).toEqual({ folder_id: CHILD, has_project: true });
    expect((await as(A, `select count(*)::int as n from public.folders`)).rows[0].n).toBe(2);
    expect((await as(B, `select count(*)::int as n from public.folders`)).rows[0].n).toBe(0);
  });

  it('leaves boards created without an account open and without a team', async () => {
    expect((await db.query<any>(`select team_id, access_level from public.boards where id = $1`, [ANON])).rows[0]).toEqual({
      team_id: null,
      access_level: 'edit',
    });
  });
});

