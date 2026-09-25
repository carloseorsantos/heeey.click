/** Minimal Supabase environment for running migrations in PGlite (auth, storage, roles, realtime) */
export const SUPABASE_STUBS = `
create schema if not exists extensions;
create schema auth;
create table auth.users (id uuid primary key, email text, email_confirmed_at timestamptz, encrypted_password text default '',
  raw_user_meta_data jsonb not null default '{}'::jsonb);
create role service_role;
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
-- Realtime "broadcast from database": record calls so tests can inspect them
create schema realtime;
create table realtime.sent (payload jsonb, event text, topic text, private boolean);
create function realtime.send(payload jsonb, event text, topic text, private boolean default true)
returns void language sql as $$ insert into realtime.sent values (payload, event, topic, private) $$;
-- Realtime Authorization: on join, Realtime checks realtime.messages policies per topic/extension
create table realtime.messages (id bigserial primary key, topic text not null, extension text not null,
  event text, payload jsonb, private boolean default true);
alter table realtime.messages enable row level security;
create function realtime.topic() returns text language sql stable as $$
  select nullif(current_setting('realtime.topic', true), '') $$;
grant usage on schema realtime to anon, authenticated;
grant select, insert on realtime.messages to anon, authenticated;
grant usage on sequence realtime.messages_id_seq to anon, authenticated;
grant execute on function realtime.topic() to anon, authenticated;
`;
