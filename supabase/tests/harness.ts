/**
 * A fresh database with schema.sql, storage.sql and every migration applied (PGlite with
 * Supabase stubs), plus helpers to run SQL as a signed-in user or anon under RLS.
 */
import { PGlite } from '@electric-sql/pglite';
import { unaccent } from '@electric-sql/pglite/contrib/unaccent';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import fs from 'node:fs';
import path from 'node:path';
import { SUPABASE_STUBS } from './supabaseStubs';

const root = path.resolve(__dirname, '..');

export interface TestDb {
  db: PGlite;
  /**
   * Runs a statement as a user (authenticated) or anon (null) with RLS. `link` is the board
   * opened by link (the x-board-id header the app sends).
   */
  as: (user: string | null, sql: string, params?: unknown[], link?: string | null) => Promise<{ rows: any[]; error?: string }>;
  /** Superuser, no JWT user */
  sys: (sql: string, params?: unknown[]) => Promise<any[]>;
  /** Creates a user as Supabase Auth would (the signup trigger creates the personal team) */
  signUp: (id: string, email: string, options?: { confirmed?: boolean; name?: string }) => Promise<void>;
  /** Default project of the user's personal team */
  personalProject: (user: string) => Promise<string>;
}

export async function createTestDb(): Promise<TestDb> {
  const db = new PGlite({ extensions: { unaccent, pgcrypto } });
  await db.exec(SUPABASE_STUBS);
  await db.exec(fs.readFileSync(path.join(root, 'schema.sql'), 'utf8'));
  await db.exec(fs.readFileSync(path.join(root, 'storage.sql'), 'utf8'));
  const migrations = fs.readdirSync(path.join(root, 'migrations')).filter((f) => f.endsWith('.sql')).sort();
  for (const file of migrations) await db.exec(fs.readFileSync(path.join(root, 'migrations', file), 'utf8'));

  const as: TestDb['as'] = async (user, sql, params = [], link = null) => {
    const headers = link ? JSON.stringify({ 'x-board-id': link }) : '{}';
    await db.exec(
      `reset role; select set_config('request.jwt.claim.sub', '${user ?? ''}', false); select set_config('request.headers', '${headers}', false); set role ${user ? 'authenticated' : 'anon'};`
    );
    try {
      return { rows: (await db.query<any>(sql, params)).rows };
    } catch (e: any) {
      return { rows: [], error: String(e.message) };
    } finally {
      await db.exec('reset role');
    }
  };

  const sys: TestDb['sys'] = async (sql, params = []) => {
    await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false); select set_config('request.headers', '{}', false);`);
    return (await db.query<any>(sql, params)).rows;
  };

  const signUp: TestDb['signUp'] = async (id, email, { confirmed = true, name } = {}) => {
    await sys(`insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values ($1, $2, $3, $4::jsonb)`, [
      id,
      email,
      confirmed ? new Date().toISOString() : null,
      JSON.stringify(name ? { full_name: name } : {}),
    ]);
  };

  const personalProject: TestDb['personalProject'] = async (user) =>
    (
      await sys(
        `select p.id from public.projects p join public.teams t on t.id = p.team_id
         where t.created_by = $1 and t.is_personal and p.is_default`,
        [user]
      )
    )[0].id;

  return { db, as, sys, signUp, personalProject };
}
