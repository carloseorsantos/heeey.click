-- ==============================================================================
-- Times (workspaces), projetos e compartilhamento estilo Google Drive
-- Decisões em adr/0001-times-e-projetos.md.
--
-- Usuário ↔ (N:N) Time → Projeto → Pastas → Quadros
-- - Todo usuário tem um time pessoal (criado no cadastro e no backfill abaixo).
-- - Papéis no time: owner | admin | member | viewer.
-- - Projetos abertos ao time ('team') ou privados ('private', só project_members;
--   owner/admin do time sempre veem).
-- - Quadros: acesso pelo time/projeto, por convite direto (board_members) e pelo link
--   (access_level: restricted | view | edit). O maior acesso vence.
-- - boards.owner_id e folders.owner_id passam a significar "quem criou".
-- - Mudanças privilegiadas (reivindicar, mover entre projetos/times, agendar a restrição
--   do link) só acontecem por funções security definer que ligam o sinal heeey.system.
-- ==============================================================================

create extension if not exists pgcrypto with schema extensions;
create extension if not exists unaccent with schema extensions;

-- ------------------------------------------------------------------------------
-- 1. Níveis de permissão: manage > edit > view
-- ------------------------------------------------------------------------------
create or replace function public.perm_rank(p text)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case p when 'manage' then 3 when 'edit' then 2 when 'view' then 1 else 0 end;
$$;

create or replace function public.max_perm(a text, b text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when public.perm_rank(a) = 0 and public.perm_rank(b) = 0 then null
    when public.perm_rank(a) >= public.perm_rank(b) then a
    else b
  end;
$$;

-- Sinal das funções privilegiadas (clientes não conseguem ligá-lo: set_config não é exposto)
create or replace function public.is_system_change()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(current_setting('heeey.system', true), '') = 'on';
$$;

-- ------------------------------------------------------------------------------
-- 2. Tabelas
-- ------------------------------------------------------------------------------
create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 60),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,58}[a-z0-9]$'),
  is_personal boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  -- Engrenagem do modal de compartilhar: editores podem adicionar pessoas e mudar o acesso geral
  editors_can_share boolean not null default true,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create unique index if not exists idx_teams_personal on public.teams(created_by) where is_personal;

create table if not exists public.team_members (
  team_id uuid not null references public.teams(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'member', 'viewer')),
  created_at timestamptz not null default timezone('utc'::text, now()),
  primary key (team_id, user_id)
);

create index if not exists idx_team_members_user on public.team_members(user_id);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 100),
  visibility text not null default 'team' check (visibility in ('team', 'private')),
  is_default boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  check (not is_default or visibility = 'team')
);

create index if not exists idx_projects_team on public.projects(team_id);
create unique index if not exists idx_projects_default on public.projects(team_id) where is_default;

create table if not exists public.project_members (
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('edit', 'view')),
  added_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc'::text, now()),
  primary key (project_id, user_id)
);

create index if not exists idx_project_members_user on public.project_members(user_id);

create table if not exists public.team_invites (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  role text not null check (role in ('admin', 'member', 'viewer')),
  -- Só o hash SHA-256 do token do link fica no banco
  token_hash text not null unique,
  invited_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc'::text, now()),
  expires_at timestamptz not null default timezone('utc'::text, now()) + interval '7 days',
  accepted_by uuid references auth.users(id) on delete set null,
  accepted_at timestamptz,
  revoked_at timestamptz
);

create index if not exists idx_team_invites_team on public.team_invites(team_id);

-- Convites diretos em um quadro (Leitor/Editor). user_id null = convite pendente, ativado
-- quando alguém cria conta com esse e-mail verificado.
create table if not exists public.board_members (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  email text not null check (
    email = lower(btrim(email)) and char_length(email) <= 254 and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'
  ),
  role text not null check (role in ('edit', 'view')),
  invited_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  unique (board_id, email),
  unique (board_id, user_id)
);

create index if not exists idx_board_members_user on public.board_members(user_id) where user_id is not null;
create index if not exists idx_board_members_pending on public.board_members(email) where user_id is null;
create index if not exists idx_board_members_invited_by on public.board_members(invited_by, created_at);

-- Times que cada chave de API pode acessar
create table if not exists public.api_key_teams (
  api_key_id uuid not null references public.api_keys(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  primary key (api_key_id, team_id)
);

create index if not exists idx_api_key_teams_team on public.api_key_teams(team_id);

-- ------------------------------------------------------------------------------
-- 3. Colunas novas
-- ------------------------------------------------------------------------------
alter table public.boards add column if not exists team_id uuid references public.teams(id) on delete restrict;
alter table public.boards add column if not exists project_id uuid references public.projects(id) on delete restrict;
-- Migração com aviso: quando o link aberto deste quadro vira restrito
alter table public.boards add column if not exists restrict_link_at timestamptz;

create index if not exists idx_boards_team on public.boards(team_id);
create index if not exists idx_boards_project on public.boards(project_id);
create index if not exists idx_boards_restrict_link_at on public.boards(restrict_link_at) where restrict_link_at is not null;

alter table public.boards drop constraint if exists boards_access_level_check;
alter table public.boards add constraint boards_access_level_check
  check (access_level in ('restricted', 'view', 'edit'));

alter table public.boards drop constraint if exists boards_team_project_check;
alter table public.boards add constraint boards_team_project_check
  check ((team_id is null) = (project_id is null));

-- Sem time, ninguém conseguiria abrir um quadro restrito
alter table public.boards drop constraint if exists boards_restricted_needs_team_check;
alter table public.boards add constraint boards_restricted_needs_team_check
  check (team_id is not null or access_level <> 'restricted');

alter table public.folders add column if not exists team_id uuid references public.teams(id) on delete cascade;
alter table public.folders add column if not exists project_id uuid references public.projects(id) on delete cascade;
create index if not exists idx_folders_project on public.folders(project_id);

-- A pasta é do projeto: continua existindo se quem a criou excluir a conta
alter table public.folders alter column owner_id drop not null;
alter table public.folders drop constraint if exists folders_owner_id_fkey;
alter table public.folders add constraint folders_owner_id_fkey
  foreign key (owner_id) references auth.users(id) on delete set null;

alter table public.audit_log add column if not exists team_id uuid;
create index if not exists idx_audit_log_team on public.audit_log(team_id) where team_id is not null;

-- ------------------------------------------------------------------------------
-- 4. Funções de acesso (a fonte da verdade para RLS, Storage, Realtime e API)
-- ------------------------------------------------------------------------------

-- Papel do usuário atual no time (null = não é membro)
create or replace function public.team_role(p_team_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select m.role from public.team_members m
  where m.team_id = p_team_id and m.user_id = auth.uid();
$$;

create or replace function public.my_team_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.team_id from public.team_members m where m.user_id = auth.uid();
$$;

-- Acesso do usuário atual a um projeto pelo time: manage | edit | view | null
create or replace function public.project_access(p_project_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_team uuid;
  v_visibility text;
  v_role text;
  v_project_role text;
begin
  if auth.uid() is null or p_project_id is null then
    return null;
  end if;
  select p.team_id, p.visibility into v_team, v_visibility from public.projects p where p.id = p_project_id;
  if not found then
    return null;
  end if;
  select m.role into v_role from public.team_members m where m.team_id = v_team and m.user_id = auth.uid();
  if v_role is null then
    return null;
  end if;
  if v_role in ('owner', 'admin') then
    return 'manage';
  end if;
  if v_visibility = 'team' then
    return case v_role when 'member' then 'edit' else 'view' end;
  end if;
  select pm.role into v_project_role from public.project_members pm
  where pm.project_id = p_project_id and pm.user_id = auth.uid();
  if v_project_role is null then
    return null;
  end if;
  -- Quem é leitor no time continua só lendo, mesmo num projeto privado
  return case when v_role = 'viewer' then 'view' else v_project_role end;
end;
$$;

-- Projetos que o usuário atual enxerga
create or replace function public.readable_project_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.id
  from public.projects p
  join public.team_members m on m.team_id = p.team_id and m.user_id = auth.uid()
  where m.role in ('owner', 'admin')
     or p.visibility = 'team'
     or exists (select 1 from public.project_members pm where pm.project_id = p.id and pm.user_id = auth.uid());
$$;

-- Quadros compartilhados diretamente com o usuário atual
create or replace function public.shared_board_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select bm.board_id from public.board_members bm where bm.user_id = auth.uid();
$$;

-- Acesso do usuário atual a um quadro sem contar o link: time/projeto, criador e convite direto
create or replace function public.board_member_permission(p_board_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_owner uuid;
  v_team uuid;
  v_project uuid;
  v_perm text;
  v_shared text;
begin
  if auth.uid() is null then
    return null;
  end if;
  select b.owner_id, b.team_id, b.project_id into v_owner, v_team, v_project
  from public.boards b where b.id = p_board_id;
  if not found then
    return null;
  end if;
  if v_team is null then
    -- Quadro antigo com dono e sem time (não deveria existir depois do backfill)
    return case when v_owner = auth.uid() then 'manage' end;
  end if;

  v_perm := public.project_access(v_project);
  -- Quem criou o quadro o administra enquanto puder editar o projeto
  if v_perm = 'edit' and v_owner = auth.uid() then
    v_perm := 'manage';
  end if;

  select bm.role into v_shared from public.board_members bm
  where bm.board_id = p_board_id and bm.user_id = auth.uid();
  return public.max_perm(v_perm, v_shared);
end;
$$;

-- Acesso efetivo, contando o link (quem sabe o id do quadro): manage | edit | view | null.
-- Usada pelo Storage, pelo Realtime e pelo histórico, que identificam o quadro pelo id.
create or replace function public.board_permission(p_board_id text)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_access text;
begin
  begin
    v_id := p_board_id::uuid;
  exception when others then
    return null;
  end;
  select b.access_level into v_access from public.boards b where b.id = v_id;
  if not found then
    return null;
  end if;
  return public.max_perm(
    public.board_member_permission(v_id),
    case when v_access in ('edit', 'view') then v_access end
  );
end;
$$;

-- Se o usuário atual pode adicionar pessoas e mudar o acesso geral do quadro
create or replace function public.board_can_share(p_board_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_perm text := public.board_member_permission(p_board_id);
  v_editors_can_share boolean;
begin
  -- Atenção a null: sem acesso nenhum, v_perm é null e comparações com null não barram
  if v_perm is null or v_perm not in ('manage', 'edit') then
    return false;
  end if;
  if v_perm = 'manage' then
    return true;
  end if;
  select t.editors_can_share into v_editors_can_share
  from public.boards b join public.teams t on t.id = b.team_id
  where b.id = p_board_id;
  return coalesce(v_editors_can_share, false);
end;
$$;

-- Se o quadro existe (para a tela "Você precisa de acesso" e para uploads de rascunhos)
create or replace function public.board_exists(p_board_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.boards b where b.id = p_board_id);
$$;

revoke all on function public.perm_rank(text) from public;
revoke all on function public.max_perm(text, text) from public;
revoke all on function public.is_system_change() from public, anon, authenticated;
revoke all on function public.team_role(uuid) from public;
revoke all on function public.my_team_ids() from public;
revoke all on function public.project_access(uuid) from public;
revoke all on function public.readable_project_ids() from public;
revoke all on function public.shared_board_ids() from public;
revoke all on function public.board_member_permission(uuid) from public;
revoke all on function public.board_permission(text) from public;
revoke all on function public.board_can_share(uuid) from public;
revoke all on function public.board_exists(uuid) from public;
grant execute on function public.perm_rank(text) to anon, authenticated;
grant execute on function public.max_perm(text, text) to anon, authenticated;
grant execute on function public.team_role(uuid) to anon, authenticated;
grant execute on function public.my_team_ids() to anon, authenticated;
grant execute on function public.project_access(uuid) to anon, authenticated;
grant execute on function public.readable_project_ids() to anon, authenticated;
grant execute on function public.shared_board_ids() to anon, authenticated;
grant execute on function public.board_member_permission(uuid) to anon, authenticated;
grant execute on function public.board_permission(text) to anon, authenticated;
grant execute on function public.board_can_share(uuid) to anon, authenticated;
grant execute on function public.board_exists(uuid) to anon, authenticated;

-- Colunas calculadas para o PostgREST: select=*,my_role / select=*,my_access
create or replace function public.my_role(t public.teams)
returns text
language sql
stable
set search_path = ''
as $$
  select public.team_role(t.id);
$$;

create or replace function public.my_access(p public.projects)
returns text
language sql
stable
set search_path = ''
as $$
  select public.project_access(p.id);
$$;

revoke all on function public.my_role(public.teams) from public, anon;
revoke all on function public.my_access(public.projects) from public, anon;
grant execute on function public.my_role(public.teams) to authenticated;
grant execute on function public.my_access(public.projects) to authenticated;

-- ------------------------------------------------------------------------------
-- 5. Time pessoal e convites pendentes
-- ------------------------------------------------------------------------------
create or replace function public.slugify(p_text text)
returns text
language sql
stable
set search_path = ''
as $$
  select coalesce(
    nullif(trim(both '-' from left(
      regexp_replace(lower(extensions.unaccent('extensions.unaccent'::regdictionary, coalesce(p_text, ''))), '[^a-z0-9]+', '-', 'g'),
      40
    )), ''),
    'time'
  );
$$;

create or replace function public.unique_team_slug(p_name text)
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_base text := public.slugify(p_name);
  v_slug text;
begin
  loop
    v_slug := v_base || '-' || substr(encode(extensions.gen_random_bytes(4), 'hex'), 1, 6);
    exit when not exists (select 1 from public.teams t where t.slug = v_slug);
  end loop;
  return v_slug;
end;
$$;

-- Nome exibido de um usuário (perfil, nome do provedor ou início do e-mail)
create or replace function public.user_display_name(p_user uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    nullif(btrim(u.raw_user_meta_data->>'custom_name'), ''),
    nullif(btrim(u.raw_user_meta_data->>'full_name'), ''),
    nullif(btrim(u.raw_user_meta_data->>'name'), ''),
    nullif(split_part(coalesce(u.email, ''), '@', 1), '')
  )
  from auth.users u where u.id = p_user;
$$;

create or replace function public.create_personal_team(p_user uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_team uuid;
  v_name text;
begin
  select t.id into v_team from public.teams t where t.created_by = p_user and t.is_personal;
  if v_team is not null then
    return v_team;
  end if;
  if not exists (select 1 from auth.users u where u.id = p_user) then
    return null;
  end if;

  v_name := left(coalesce(public.user_display_name(p_user), 'Pessoal'), 60);
  insert into public.teams (name, slug, is_personal, created_by)
  values (v_name, public.unique_team_slug(v_name), true, p_user)
  returning id into v_team;
  insert into public.team_members (team_id, user_id, role) values (v_team, p_user, 'owner');
  insert into public.projects (team_id, name, is_default, created_by) values (v_team, 'Geral', true, p_user);
  return v_team;
end;
$$;

-- E-mail cuja posse o usuário provou (minúsculo), ou null.
-- email_confirmed_at sozinho não basta: com "Confirm email" desligado no Supabase Auth
-- (mailer_autoconfirm), qualquer um cria pela API pública (POST /auth/v1/signup) uma conta
-- com senha já confirmada usando o e-mail de outra pessoa. O app só entra por magic link, e
-- contas criadas assim não têm senha; então só contas sem senha herdam convites por e-mail.
create or replace function public.proven_email(p_user uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select lower(u.email)
  from auth.users u
  where u.id = p_user
    and u.email is not null
    and u.email_confirmed_at is not null
    and coalesce(u.encrypted_password, '') = '';
$$;

revoke all on function public.proven_email(uuid) from public, anon, authenticated;

-- Ativa convites pendentes em quadros feitos para o e-mail (comprovado) do usuário
create or replace function public.activate_board_shares(p_user uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text;
  v_count integer;
begin
  v_email := public.proven_email(p_user);
  if v_email is null then
    return 0;
  end if;

  update public.board_members bm
  set user_id = p_user, updated_at = timezone('utc'::text, now())
  where bm.user_id is null
    and bm.email = v_email
    and not exists (
      select 1 from public.board_members x where x.board_id = bm.board_id and x.user_id = p_user
    );
  get diagnostics v_count = row_count;
  -- Sobras: a pessoa já tinha acesso direto a esses quadros por outra linha
  delete from public.board_members bm where bm.user_id is null and bm.email = v_email;
  return v_count;
end;
$$;

revoke all on function public.slugify(text) from public, anon, authenticated;
revoke all on function public.unique_team_slug(text) from public, anon, authenticated;
revoke all on function public.user_display_name(uuid) from public, anon, authenticated;
revoke all on function public.create_personal_team(uuid) from public, anon, authenticated;
revoke all on function public.activate_board_shares(uuid) from public, anon, authenticated;

-- Cadastro e confirmação de e-mail. Nunca impede o cadastro: se falhar aqui, o app chama
-- ensure_personal_team() ao entrar.
create or replace function public.handle_auth_user_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  begin
    if tg_op = 'INSERT' then
      perform public.create_personal_team(new.id);
    end if;
    if new.email_confirmed_at is not null then
      perform public.activate_board_shares(new.id);
    end if;
  exception when others then
    raise warning 'heeey: falha ao preparar o time pessoal de %: %', new.id, sqlerrm;
  end;
  return new;
end;
$$;

revoke all on function public.handle_auth_user_change() from public, anon, authenticated;

drop trigger if exists heeey_on_auth_user_created on auth.users;
create trigger heeey_on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_auth_user_change();

drop trigger if exists heeey_on_auth_user_confirmed on auth.users;
create trigger heeey_on_auth_user_confirmed
  after update of email, email_confirmed_at on auth.users
  for each row
  when (new.email_confirmed_at is not null)
  execute function public.handle_auth_user_change();

-- Chamada pelo app ao entrar: garante o time pessoal e ativa convites pendentes
create or replace function public.ensure_personal_team()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_team uuid;
begin
  if auth.uid() is null then
    raise exception 'Entre na sua conta.' using errcode = '28000';
  end if;
  v_team := public.create_personal_team(auth.uid());
  perform public.activate_board_shares(auth.uid());
  return v_team;
end;
$$;

revoke all on function public.ensure_personal_team() from public, anon;
grant execute on function public.ensure_personal_team() to authenticated;

-- Membro saiu do time: tira dos projetos privados; time sem membros some; time sem dono
-- ganha um (exclusão de conta não pode ser bloqueada pelo banco)
create or replace function public.handle_team_member_removed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_next uuid;
begin
  if not exists (select 1 from public.teams t where t.id = old.team_id) then
    return old;
  end if;

  delete from public.project_members pm
  using public.projects p
  where pm.project_id = p.id and p.team_id = old.team_id and pm.user_id = old.user_id;

  if not exists (select 1 from public.team_members m where m.team_id = old.team_id) then
    perform set_config('heeey.system', 'on', true);
    perform set_config('heeey.audit_purge', 'on', true);
    delete from public.boards b where b.team_id = old.team_id;
    delete from public.teams t where t.id = old.team_id;
    perform set_config('heeey.audit_purge', 'off', true);
    perform set_config('heeey.system', 'off', true);
    return old;
  end if;

  if not exists (select 1 from public.team_members m where m.team_id = old.team_id and m.role = 'owner') then
    select m.user_id into v_next from public.team_members m
    where m.team_id = old.team_id
    order by case m.role when 'admin' then 0 when 'member' then 1 else 2 end, m.created_at
    limit 1;
    update public.team_members m set role = 'owner' where m.team_id = old.team_id and m.user_id = v_next;
  end if;
  return old;
end;
$$;

revoke all on function public.handle_team_member_removed() from public, anon, authenticated;

drop trigger if exists handle_team_member_removed on public.team_members;
create trigger handle_team_member_removed
  after delete on public.team_members
  for each row
  execute function public.handle_team_member_removed();

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$;

drop trigger if exists touch_teams on public.teams;
create trigger touch_teams before update on public.teams
  for each row execute function public.touch_updated_at();
drop trigger if exists touch_projects on public.projects;
create trigger touch_projects before update on public.projects
  for each row execute function public.touch_updated_at();

-- Integridade: time pessoal e dono do time não mudam por fora das funções abaixo
create or replace function public.check_team_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.is_personal is distinct from old.is_personal or new.created_by is distinct from old.created_by and new.created_by is not null then
    raise exception 'Não é permitido alterar o tipo ou o criador do time.';
  end if;
  return new;
end;
$$;

drop trigger if exists check_team_update on public.teams;
create trigger check_team_update before update on public.teams
  for each row execute function public.check_team_update();

-- Membros de projeto precisam ser membros do time
create or replace function public.check_project_member()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.projects p
    join public.team_members m on m.team_id = p.team_id and m.user_id = new.user_id
    where p.id = new.project_id
  ) then
    raise exception 'A pessoa precisa ser membro do time.' using errcode = '22023';
  end if;
  return new;
end;
$$;

drop trigger if exists check_project_member on public.project_members;
create trigger check_project_member before insert or update on public.project_members
  for each row execute function public.check_project_member();

-- ------------------------------------------------------------------------------
-- 6. Quadros e pastas: integridade
-- ------------------------------------------------------------------------------

-- Projeto padrão do time pessoal de um usuário
create or replace function public.personal_default_project(p_user uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.id from public.projects p
  join public.teams t on t.id = p.team_id
  where t.created_by = p_user and t.is_personal and p.is_default;
$$;

revoke all on function public.personal_default_project(uuid) from public, anon, authenticated;

-- Novo quadro: o time vem do projeto (ou da pasta, ou do time pessoal de quem cria)
create or replace function public.assign_board_team()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.project_id is null and new.folder_id is not null then
    select f.project_id into new.project_id from public.folders f where f.id = new.folder_id;
  end if;
  if new.project_id is null and new.team_id is not null then
    select p.id into new.project_id from public.projects p where p.team_id = new.team_id and p.is_default;
  end if;
  if new.project_id is null and new.owner_id is not null then
    new.project_id := public.personal_default_project(new.owner_id);
  end if;
  if new.project_id is not null then
    select p.team_id into new.team_id from public.projects p where p.id = new.project_id;
    if new.team_id is null then
      raise exception 'Projeto não encontrado.' using errcode = 'P0002';
    end if;
  end if;
  if not public.is_system_change() then
    new.restrict_link_at := null;
  end if;
  return new;
end;
$$;

revoke all on function public.assign_board_team() from public, anon, authenticated;

drop trigger if exists assign_board_team on public.boards;
create trigger assign_board_team
  before insert on public.boards
  for each row
  execute function public.assign_board_team();

-- Regras de atualização (substitui a versão da migration de busca)
create or replace function public.handle_board_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_system boolean := public.is_system_change();
begin
  -- Criador, time, projeto e agendamento do link só mudam pelas funções privilegiadas
  -- (a exclusão da conta de quem criou zera owner_id pela chave estrangeira)
  if new.owner_id is distinct from old.owner_id and new.owner_id is not null and not v_system then
    raise exception 'Não é permitido alterar o criador do quadro.';
  end if;
  if (new.team_id is distinct from old.team_id or new.project_id is distinct from old.project_id) and not v_system then
    raise exception 'Use a opção Mover para trocar o quadro de projeto ou de time.';
  end if;
  if new.restrict_link_at is distinct from old.restrict_link_at and not v_system then
    raise exception 'Não é permitido alterar o agendamento do link.';
  end if;

  -- Acesso geral: quem pode compartilhar; quadros sem time ficam abertos para edição
  if old.access_level is distinct from new.access_level then
    if not v_system then
      if old.team_id is null then
        if new.access_level <> 'edit' then
          raise exception 'Um quadro anônimo sem proprietário não pode ser bloqueado como somente leitura.';
        end if;
      elsif not public.board_can_share(old.id) then
        raise exception 'Você não tem permissão para alterar o acesso geral deste quadro.' using errcode = '42501';
      end if;
    end if;
    -- Mudar o acesso cancela a migração agendada do link
    new.restrict_link_at := null;
  end if;

  -- Lixeira: quem edita o quadro pelo time (ou o administra)
  if new.deleted_at is distinct from old.deleted_at then
    if not v_system and old.team_id is not null
      and coalesce(public.project_access(old.project_id), '') not in ('manage', 'edit')
      and coalesce(public.board_member_permission(old.id), '') <> 'manage' then
      raise exception 'Apenas quem edita o quadro pelo time pode movê-lo para a lixeira ou restaurá-lo.' using errcode = '42501';
    end if;
    if new.deleted_at is not null then
      new.deleted_at = timezone('utc'::text, now());
    end if;
  end if;

  -- Quadros na lixeira ficam somente leitura até serem restaurados
  if old.deleted_at is not null and new.deleted_at is not null and (
    new.elements is distinct from old.elements
    or new.app_state is distinct from old.app_state
    or new.files is distinct from old.files
    or new.title is distinct from old.title
    or (new.access_level is distinct from old.access_level and not v_system)
  ) then
    raise exception 'Quadro na lixeira é somente leitura. Restaure-o para editar.';
  end if;

  -- Lixeira, pasta, projeto, miniatura, índice de busca e agendamento não contam como edição
  if (to_jsonb(new) - 'deleted_at' - 'updated_at' - 'thumbnail' - 'folder_id' - 'search_vector'
        - 'team_id' - 'project_id' - 'restrict_link_at')
     = (to_jsonb(old) - 'deleted_at' - 'updated_at' - 'thumbnail' - 'folder_id' - 'search_vector'
        - 'team_id' - 'project_id' - 'restrict_link_at') then
    new.updated_at = old.updated_at;
  else
    new.updated_at = timezone('utc'::text, now());
  end if;
  return new;
end;
$$;

-- Pasta do quadro: do mesmo projeto; mover entre pastas é de quem edita pelo time
create or replace function public.check_board_folder()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE'
    and new.folder_id is not distinct from old.folder_id
    and new.project_id is not distinct from old.project_id then
    return new;
  end if;
  if tg_op = 'UPDATE' and new.folder_id is distinct from old.folder_id and not public.is_system_change()
    and coalesce(public.project_access(new.project_id), '') not in ('manage', 'edit') then
    raise exception 'Apenas quem edita o projeto pode mover o quadro entre pastas.' using errcode = '42501';
  end if;
  if new.folder_id is not null and not exists (
    select 1 from public.folders f
    where f.id = new.folder_id and f.project_id is not distinct from new.project_id
  ) then
    raise exception 'Pasta de destino não encontrada.';
  end if;
  return new;
end;
$$;

drop trigger if exists check_board_folder on public.boards;
create trigger check_board_folder
  before insert or update of folder_id, project_id on public.boards
  for each row
  execute function public.check_board_folder();

-- Pastas: do projeto, sem ciclos, até 8 níveis
create or replace function public.check_folder_parent()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  cursor_id uuid;
  depth integer := 0;
begin
  if tg_op = 'INSERT' then
    if new.project_id is null and new.parent_id is not null then
      select f.project_id into new.project_id from public.folders f where f.id = new.parent_id;
    end if;
    if new.project_id is null and new.owner_id is not null then
      new.project_id := public.personal_default_project(new.owner_id);
    end if;
    select p.team_id into new.team_id from public.projects p where p.id = new.project_id;
    if new.team_id is null then
      raise exception 'Projeto não encontrado.' using errcode = 'P0002';
    end if;
  else
    if (new.project_id is distinct from old.project_id or new.team_id is distinct from old.team_id)
      and not public.is_system_change() then
      raise exception 'Não é permitido mover uma pasta para outro projeto.';
    end if;
    -- Só a exclusão da conta de quem criou (on delete set null) muda o criador
    if new.owner_id is distinct from old.owner_id and new.owner_id is not null then
      raise exception 'Não é permitido alterar o criador da pasta.';
    end if;
  end if;
  new.updated_at = timezone('utc'::text, now());

  cursor_id := new.parent_id;
  while cursor_id is not null loop
    if cursor_id = new.id then
      raise exception 'Uma pasta não pode ficar dentro dela mesma.';
    end if;
    depth := depth + 1;
    if depth > 8 then
      raise exception 'Limite de 8 níveis de pastas atingido.';
    end if;
    select f.parent_id into cursor_id
    from public.folders f
    where f.id = cursor_id and f.project_id = new.project_id;
    if not found then
      raise exception 'Pasta de destino não encontrada.';
    end if;
  end loop;
  return new;
end;
$$;

drop trigger if exists check_folder_parent on public.folders;
create trigger check_folder_parent
  before insert or update of parent_id, owner_id, project_id, team_id on public.folders
  for each row
  execute function public.check_folder_parent();

-- ------------------------------------------------------------------------------
-- 7. Backfill: time pessoal para cada usuário; quadros e pastas vão para ele.
--    Quadros com link aberto ganham 30 dias até virarem restritos (com aviso no app).
-- ------------------------------------------------------------------------------
do $$
declare
  u record;
begin
  perform set_config('heeey.system', 'on', true);

  for u in select id from auth.users loop
    perform public.create_personal_team(u.id);
  end loop;

  update public.boards b
  set team_id = p.team_id,
      project_id = p.id,
      restrict_link_at = case when b.access_level in ('edit', 'view')
                              then timezone('utc'::text, now()) + interval '30 days' end
  from public.projects p
  join public.teams t on t.id = p.team_id and t.is_personal and p.is_default
  where b.team_id is null and b.owner_id is not null and t.created_by = b.owner_id;

  update public.folders f
  set team_id = p.team_id, project_id = p.id
  from public.projects p
  join public.teams t on t.id = p.team_id and t.is_personal and p.is_default
  where f.project_id is null and t.created_by = f.owner_id;

  -- Chaves existentes continuam alcançando os mesmos quadros (os do time pessoal)
  insert into public.api_key_teams (api_key_id, team_id)
  select k.id, t.id
  from public.api_keys k
  join public.teams t on t.created_by = k.user_id and t.is_personal
  where not exists (select 1 from public.api_key_teams x where x.api_key_id = k.id);

  perform set_config('heeey.system', 'off', true);
end;
$$;

-- ------------------------------------------------------------------------------
-- 8. RLS
-- ------------------------------------------------------------------------------
alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.team_invites enable row level security;
alter table public.board_members enable row level security;
alter table public.api_key_teams enable row level security;

-- Escrita só pelas funções abaixo
revoke all on public.teams, public.team_members, public.projects, public.project_members,
  public.team_invites, public.board_members, public.api_key_teams from anon, authenticated;
grant select on public.teams, public.team_members, public.projects, public.project_members,
  public.board_members, public.api_key_teams to authenticated;
grant select (id, team_id, role, invited_by, created_at, expires_at, accepted_by, accepted_at, revoked_at)
  on public.team_invites to authenticated;

drop policy if exists "Times visíveis aos membros" on public.teams;
create policy "Times visíveis aos membros" on public.teams for select
  using (id in (select public.my_team_ids()));

drop policy if exists "Membros visíveis aos membros do time" on public.team_members;
create policy "Membros visíveis aos membros do time" on public.team_members for select
  using (team_id in (select public.my_team_ids()));

drop policy if exists "Projetos visíveis a quem tem acesso" on public.projects;
create policy "Projetos visíveis a quem tem acesso" on public.projects for select
  using (id in (select public.readable_project_ids()));

drop policy if exists "Membros de projeto visíveis a quem vê o projeto" on public.project_members;
create policy "Membros de projeto visíveis a quem vê o projeto" on public.project_members for select
  using (project_id in (select public.readable_project_ids()));

drop policy if exists "Convites visíveis a owners e admins" on public.team_invites;
create policy "Convites visíveis a owners e admins" on public.team_invites for select
  using (public.team_role(team_id) in ('owner', 'admin'));

-- A lista completa de quem tem acesso vem de board_sharing(); aqui, só as próprias linhas
drop policy if exists "Convites de quadro visíveis à pessoa convidada" on public.board_members;
create policy "Convites de quadro visíveis à pessoa convidada" on public.board_members for select
  using (user_id = auth.uid());

drop policy if exists "Times das chaves visíveis ao dono" on public.api_key_teams;
create policy "Times das chaves visíveis ao dono" on public.api_key_teams for select
  using (exists (select 1 from public.api_keys k where k.id = api_key_id and k.user_id = auth.uid()));

-- Quadros
drop policy if exists "Permitir leitura pelo dono ou pelo link do quadro" on public.boards;
drop policy if exists "Permitir leitura por membros, convidados ou pelo link" on public.boards;
create policy "Permitir leitura por membros, convidados ou pelo link"
  on public.boards
  for select
  using (
    project_id in (select public.readable_project_ids())
    or id in (select public.shared_board_ids())
    or (team_id is null and owner_id is not null and owner_id = auth.uid())
    or (id = public.requested_board_id() and access_level <> 'restricted')
  );

drop policy if exists "Permitir criação pública de quadros" on public.boards;
create policy "Permitir criação pública de quadros"
  on public.boards
  for insert
  with check (
    -- Anônimo (ou logado sem time): quadro aberto e sem dono
    (owner_id is null and team_id is null)
    -- Logado: quadro criado por ele num projeto onde pode editar
    or (
      auth.uid() is not null
      and owner_id = auth.uid()
      and team_id is not null
      and public.project_access(project_id) in ('manage', 'edit')
    )
  );

drop policy if exists "Permitir atualização por proprietário ou em quadros editáveis" on public.boards;
drop policy if exists "Permitir atualização por quem edita o quadro" on public.boards;
create policy "Permitir atualização por quem edita o quadro"
  on public.boards
  for update
  using (
    public.board_member_permission(id) in ('manage', 'edit')
    or (access_level = 'edit' and id = public.requested_board_id())
  )
  with check (
    public.board_member_permission(id) in ('manage', 'edit')
    or (access_level = 'edit' and id = public.requested_board_id())
  );

drop policy if exists "Permitir exclusão apenas pelo proprietário" on public.boards;
drop policy if exists "Permitir exclusão por quem administra o quadro" on public.boards;
create policy "Permitir exclusão por quem administra o quadro"
  on public.boards
  for delete
  using (public.board_member_permission(id) = 'manage');

-- Colunas que o app escreve diretamente; o resto passa pelas funções privilegiadas
revoke insert, update on public.boards from anon, authenticated;
grant insert (id, title, owner_id, elements, app_state, files, access_level, created_at, updated_at,
  deleted_at, thumbnail, folder_id, team_id, project_id) on public.boards to anon, authenticated;
grant update (title, elements, app_state, files, access_level, updated_at, deleted_at, thumbnail, folder_id)
  on public.boards to anon, authenticated;

-- Pastas
drop policy if exists "Pastas visíveis apenas para o dono" on public.folders;
drop policy if exists "Pastas visíveis a quem vê o projeto" on public.folders;
create policy "Pastas visíveis a quem vê o projeto" on public.folders for select
  using (project_id in (select public.readable_project_ids()));

drop policy if exists "Pastas criadas apenas pelo dono" on public.folders;
drop policy if exists "Pastas criadas por quem edita o projeto" on public.folders;
create policy "Pastas criadas por quem edita o projeto" on public.folders for insert
  with check (
    auth.uid() is not null and owner_id = auth.uid()
    and public.project_access(project_id) in ('manage', 'edit')
  );

drop policy if exists "Pastas alteradas apenas pelo dono" on public.folders;
drop policy if exists "Pastas alteradas por quem edita o projeto" on public.folders;
create policy "Pastas alteradas por quem edita o projeto" on public.folders for update
  using (public.project_access(project_id) in ('manage', 'edit'))
  with check (public.project_access(project_id) in ('manage', 'edit'));

drop policy if exists "Pastas excluídas apenas pelo dono" on public.folders;
drop policy if exists "Pastas excluídas por quem edita o projeto" on public.folders;
create policy "Pastas excluídas por quem edita o projeto" on public.folders for delete
  using (public.project_access(project_id) in ('manage', 'edit'));

revoke insert, update on public.folders from anon, authenticated;
grant insert (id, owner_id, parent_id, name, project_id, created_at, updated_at) on public.folders to authenticated;
grant update (parent_id, name, updated_at) on public.folders to authenticated;

-- Histórico: quem edita pelo time/convite, ou pelo link aberto no cabeçalho x-board-id
drop policy if exists "Permitir leitura do histórico a quem edita o quadro" on public.board_versions;
create policy "Permitir leitura do histórico a quem edita o quadro"
  on public.board_versions
  for select
  using (
    public.board_member_permission(board_id) in ('manage', 'edit')
    or (
      board_id = public.requested_board_id()
      and public.board_permission(board_id::text) in ('manage', 'edit')
    )
  );

create or replace function public.snapshot_board(p_board_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.boards;
begin
  select * into target from public.boards b where b.id = p_board_id;
  if target.id is null then
    raise exception 'Quadro não encontrado.';
  end if;
  if target.deleted_at is not null then
    raise exception 'Quadro na lixeira é somente leitura. Restaure-o para editar.';
  end if;
  -- coalesce: sem cabeçalho a comparação é null, e `not (... or null)` não bloquearia
  if not coalesce(
    public.board_member_permission(p_board_id) in ('manage', 'edit')
    or (target.access_level = 'edit' and p_board_id = public.requested_board_id()),
    false
  ) then
    raise exception 'Sem permissão para salvar versões deste quadro.';
  end if;

  perform public.insert_board_version(target, 'before_restore', timezone('utc'::text, now()));
end;
$$;

grant execute on function public.snapshot_board(uuid) to anon, authenticated;

-- Storage board-media: listar e excluir é de quem administra; enviar, de quem edita
-- (ou de um quadro ainda não salvo, só local)
create or replace function public.board_media_can_write(p_path text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  begin
    v_id := split_part(p_path, '/', 1)::uuid;
  exception when others then
    return false;
  end;
  if not public.board_exists(v_id) then
    return true;
  end if;
  return public.board_permission(v_id::text) in ('manage', 'edit');
end;
$$;

revoke all on function public.board_media_can_write(text) from public;
grant execute on function public.board_media_can_write(text) to anon, authenticated;

drop policy if exists "Permitir leitura de imagens no board-media pelo dono do quadro" on storage.objects;
drop policy if exists "Permitir leitura de imagens no board-media por quem administra o quadro" on storage.objects;
create policy "Permitir leitura de imagens no board-media por quem administra o quadro"
  on storage.objects
  for select
  using (
    bucket_id = 'board-media'
    and public.board_permission(split_part(name, '/', 1)) = 'manage'
  );

drop policy if exists "Permitir upload de imagens no board-media" on storage.objects;
create policy "Permitir upload de imagens no board-media"
  on storage.objects
  for insert
  with check (bucket_id = 'board-media' and public.board_media_can_write(name));

drop policy if exists "Permitir atualização de imagens no board-media" on storage.objects;
create policy "Permitir atualização de imagens no board-media"
  on storage.objects
  for update
  using (
    bucket_id = 'board-media'
    and public.board_permission(split_part(name, '/', 1)) in ('manage', 'edit')
  );

drop policy if exists "Permitir exclusão de imagens no board-media" on storage.objects;
create policy "Permitir exclusão de imagens no board-media"
  on storage.objects
  for delete
  using (
    bucket_id = 'board-media'
    and public.board_permission(split_part(name, '/', 1)) = 'manage'
  );

-- Realtime: entrar na sala exige poder abrir o quadro; alterar a cena exige poder editá-lo.
-- Quadro que ainda não está no banco (recém-criado, só local) é tratado como editável.
create or replace function public.realtime_can_read_board(p_board_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_board_id is null then
    return false;
  end if;
  if not public.board_exists(p_board_id) then
    return true;
  end if;
  return public.board_permission(p_board_id::text) is not null;
end;
$$;

create or replace function public.realtime_can_edit_board(p_board_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_deleted timestamptz;
begin
  select b.deleted_at into v_deleted from public.boards b where b.id = p_board_id;
  if not found then
    return true;
  end if;
  return v_deleted is null and public.board_permission(p_board_id::text) in ('manage', 'edit');
end;
$$;

revoke all on function public.realtime_can_read_board(uuid) from public;
revoke all on function public.realtime_can_edit_board(uuid) from public;
grant execute on function public.realtime_can_read_board(uuid) to anon, authenticated;
grant execute on function public.realtime_can_edit_board(uuid) to anon, authenticated;

drop policy if exists "heeey: receber mensagens da sala do quadro" on realtime.messages;
create policy "heeey: receber mensagens da sala do quadro"
  on realtime.messages
  for select
  to anon, authenticated
  using (
    realtime.messages.extension in ('broadcast', 'presence')
    and public.realtime_can_read_board(public.realtime_topic_board(realtime.topic()))
  );

drop policy if exists "heeey: aparecer online na sala do quadro" on realtime.messages;
create policy "heeey: aparecer online na sala do quadro"
  on realtime.messages
  for insert
  to anon, authenticated
  with check (
    realtime.messages.extension = 'presence'
    and split_part(realtime.topic(), ':', 2) = 'room'
    and public.realtime_can_read_board(public.realtime_topic_board(realtime.topic()))
  );

drop policy if exists "heeey: enviar cursores na sala do quadro" on realtime.messages;
create policy "heeey: enviar cursores na sala do quadro"
  on realtime.messages
  for insert
  to anon, authenticated
  with check (
    realtime.messages.extension = 'broadcast'
    and split_part(realtime.topic(), ':', 2) = 'peers'
    and public.realtime_can_read_board(public.realtime_topic_board(realtime.topic()))
  );

drop policy if exists "heeey: alterar a cena pela sala do quadro" on realtime.messages;
create policy "heeey: alterar a cena pela sala do quadro"
  on realtime.messages
  for insert
  to anon, authenticated
  with check (
    realtime.messages.extension = 'broadcast'
    and split_part(realtime.topic(), ':', 2) = 'room'
    and public.realtime_topic_board(realtime.topic()) is not null
    and public.realtime_can_edit_board(public.realtime_topic_board(realtime.topic()))
  );

-- ------------------------------------------------------------------------------
-- 9. Times: criar, editar, membros e convites
-- ------------------------------------------------------------------------------
create or replace function public.require_user()
returns uuid
language plpgsql
stable
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Entre na sua conta.' using errcode = '28000';
  end if;
  return auth.uid();
end;
$$;

revoke all on function public.require_user() from public, anon, authenticated;

create or replace function public.team_json(p_team_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', t.id, 'name', t.name, 'slug', t.slug, 'is_personal', t.is_personal,
    'editors_can_share', t.editors_can_share, 'created_at', t.created_at,
    'my_role', public.team_role(t.id)
  )
  from public.teams t where t.id = p_team_id;
$$;

revoke all on function public.team_json(uuid) from public, anon, authenticated;

create or replace function public.create_team(p_name text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := public.require_user();
  v_name text := btrim(coalesce(p_name, ''));
  v_team uuid;
begin
  if char_length(v_name) not between 1 and 60 then
    raise exception 'O nome do time deve ter entre 1 e 60 caracteres.' using errcode = '22023';
  end if;
  if (select count(*) from public.teams t where t.created_by = v_user and not t.is_personal) >= 20 then
    raise exception 'Limite de 20 times criados atingido.' using errcode = '22023';
  end if;
  insert into public.teams (name, slug, created_by) values (v_name, public.unique_team_slug(v_name), v_user)
  returning id into v_team;
  insert into public.team_members (team_id, user_id, role) values (v_team, v_user, 'owner');
  insert into public.projects (team_id, name, is_default, created_by) values (v_team, 'Geral', true, v_user);
  return public.team_json(v_team);
end;
$$;

create or replace function public.update_team(p_team_id uuid, p_name text default null, p_editors_can_share boolean default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_user();
  if coalesce(public.team_role(p_team_id), '') not in ('owner', 'admin') then
    raise exception 'Apenas owners e admins alteram o time.' using errcode = '42501';
  end if;
  if p_name is not null and char_length(btrim(p_name)) not between 1 and 60 then
    raise exception 'O nome do time deve ter entre 1 e 60 caracteres.' using errcode = '22023';
  end if;
  update public.teams t
  set name = coalesce(nullif(btrim(p_name), ''), t.name),
      editors_can_share = coalesce(p_editors_can_share, t.editors_can_share)
  where t.id = p_team_id;
  return public.team_json(p_team_id);
end;
$$;

create or replace function public.delete_team(p_team_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_personal boolean;
begin
  perform public.require_user();
  select t.is_personal into v_personal from public.teams t where t.id = p_team_id;
  if v_personal is null or public.team_role(p_team_id) is distinct from 'owner' then
    raise exception 'Apenas owners excluem o time.' using errcode = '42501';
  end if;
  if v_personal then
    raise exception 'O time pessoal não pode ser excluído.' using errcode = '22023';
  end if;
  if exists (select 1 from public.boards b where b.team_id = p_team_id) then
    raise exception 'Exclua ou mova os quadros do time (inclusive os da lixeira) antes de excluí-lo.' using errcode = '22023';
  end if;
  delete from public.teams t where t.id = p_team_id;
  return true;
end;
$$;

create or replace function public.list_team_members(p_team_id uuid)
returns table (user_id uuid, email text, name text, avatar_url text, role text, created_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if public.team_role(p_team_id) is null then
    raise exception 'Time não encontrado.' using errcode = 'P0002';
  end if;
  return query
  select m.user_id, u.email::text, public.user_display_name(m.user_id), (u.raw_user_meta_data->>'avatar_url')::text, m.role, m.created_at
  from public.team_members m
  join auth.users u on u.id = m.user_id
  where m.team_id = p_team_id
  order by case m.role when 'owner' then 0 when 'admin' then 1 when 'member' then 2 else 3 end, m.created_at;
end;
$$;

create or replace function public.set_team_member_role(p_team_id uuid, p_user_id uuid, p_role text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me text;
  v_target text;
  v_personal_owner uuid;
begin
  perform public.require_user();
  if p_role not in ('owner', 'admin', 'member', 'viewer') then
    raise exception 'Papel inválido.' using errcode = '22023';
  end if;
  v_me := public.team_role(p_team_id);
  if coalesce(v_me, '') not in ('owner', 'admin') then
    raise exception 'Apenas owners e admins alteram papéis.' using errcode = '42501';
  end if;
  select m.role into v_target from public.team_members m where m.team_id = p_team_id and m.user_id = p_user_id for update;
  if v_target is null then
    raise exception 'Membro não encontrado.' using errcode = 'P0002';
  end if;
  if (v_target = 'owner' or p_role = 'owner') and v_me <> 'owner' then
    raise exception 'Apenas owners concedem ou retiram o papel de owner.' using errcode = '42501';
  end if;
  select t.created_by into v_personal_owner from public.teams t where t.id = p_team_id and t.is_personal;
  if v_personal_owner = p_user_id and p_role <> 'owner' then
    raise exception 'O dono do time pessoal continua owner.' using errcode = '22023';
  end if;
  update public.team_members m set role = p_role where m.team_id = p_team_id and m.user_id = p_user_id;
  if not exists (select 1 from public.team_members m where m.team_id = p_team_id and m.role = 'owner') then
    raise exception 'O time precisa de pelo menos um owner.' using errcode = '22023';
  end if;
  return true;
end;
$$;

create or replace function public.remove_team_member(p_team_id uuid, p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := public.require_user();
  v_me text := public.team_role(p_team_id);
  v_target text;
  v_personal_owner uuid;
begin
  if v_me is null then
    raise exception 'Time não encontrado.' using errcode = 'P0002';
  end if;
  select m.role into v_target from public.team_members m where m.team_id = p_team_id and m.user_id = p_user_id for update;
  if v_target is null then
    raise exception 'Membro não encontrado.' using errcode = 'P0002';
  end if;
  select t.created_by into v_personal_owner from public.teams t where t.id = p_team_id and t.is_personal;
  if v_personal_owner = p_user_id then
    raise exception 'O dono do time pessoal não pode sair dele.' using errcode = '22023';
  end if;
  if p_user_id <> v_user then
    if v_me not in ('owner', 'admin') then
      raise exception 'Apenas owners e admins removem membros.' using errcode = '42501';
    end if;
    if v_target = 'owner' and v_me <> 'owner' then
      raise exception 'Apenas owners removem outros owners.' using errcode = '42501';
    end if;
  end if;
  if v_target = 'owner' and (select count(*) from public.team_members m where m.team_id = p_team_id and m.role = 'owner') = 1 then
    raise exception 'O time precisa de pelo menos um owner. Promova outra pessoa antes de sair.' using errcode = '22023';
  end if;
  delete from public.team_members m where m.team_id = p_team_id and m.user_id = p_user_id;
  return true;
end;
$$;

create or replace function public.create_team_invite(p_team_id uuid, p_role text default 'member')
returns table (id uuid, token text, expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := public.require_user();
  v_token text;
begin
  if coalesce(public.team_role(p_team_id), '') not in ('owner', 'admin') then
    raise exception 'Apenas owners e admins convidam pessoas.' using errcode = '42501';
  end if;
  if p_role not in ('admin', 'member', 'viewer') then
    raise exception 'Papel inválido.' using errcode = '22023';
  end if;
  if (
    select count(*) from public.team_invites i
    where i.team_id = p_team_id and i.accepted_at is null and i.revoked_at is null and i.expires_at > timezone('utc'::text, now())
  ) >= 50 then
    raise exception 'Limite de 50 convites ativos. Revogue algum antes de criar outro.' using errcode = '22023';
  end if;
  v_token := encode(extensions.gen_random_bytes(24), 'hex');
  return query
  insert into public.team_invites as i (team_id, role, token_hash, invited_by)
  values (p_team_id, p_role, encode(extensions.digest(v_token, 'sha256'), 'hex'), v_user)
  returning i.id, v_token, i.expires_at;
end;
$$;

create or replace function public.revoke_team_invite(p_invite_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_team uuid;
begin
  perform public.require_user();
  select i.team_id into v_team from public.team_invites i where i.id = p_invite_id;
  if v_team is null or coalesce(public.team_role(v_team), '') not in ('owner', 'admin') then
    raise exception 'Convite não encontrado.' using errcode = 'P0002';
  end if;
  update public.team_invites i set revoked_at = timezone('utc'::text, now())
  where i.id = p_invite_id and i.revoked_at is null and i.accepted_at is null;
  return found;
end;
$$;

-- Prévia do convite (página /invite/<token>); não revela nada de tokens inválidos
create or replace function public.get_team_invite(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_invite public.team_invites;
  v_team public.teams;
begin
  select * into v_invite from public.team_invites i
  where i.token_hash = encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex');
  if v_invite.id is null then
    return jsonb_build_object('status', 'invalid');
  end if;
  select * into v_team from public.teams t where t.id = v_invite.team_id;
  return jsonb_build_object(
    'status', case
      when v_invite.revoked_at is not null then 'revoked'
      when v_invite.accepted_at is not null then 'used'
      when v_invite.expires_at <= timezone('utc'::text, now()) then 'expired'
      else 'valid' end,
    'team_name', v_team.name,
    'team_slug', case when public.team_role(v_team.id) is not null then v_team.slug end,
    'role', v_invite.role,
    'invited_by', public.user_display_name(v_invite.invited_by),
    'is_member', public.team_role(v_team.id) is not null
  );
end;
$$;

-- Aceitar: entra no time com o papel do convite (o link vale para uma pessoa)
create or replace function public.accept_team_invite(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := public.require_user();
  v_invite public.team_invites;
begin
  select * into v_invite from public.team_invites i
  where i.token_hash = encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex')
  for update;
  if v_invite.id is null then
    raise exception 'Convite inválido.' using errcode = 'P0002';
  end if;
  if public.team_role(v_invite.team_id) is not null then
    return public.team_json(v_invite.team_id);
  end if;
  if v_invite.revoked_at is not null or v_invite.accepted_at is not null
    or v_invite.expires_at <= timezone('utc'::text, now()) then
    raise exception 'Este convite expirou ou já foi usado. Peça um novo link.' using errcode = '22023';
  end if;
  insert into public.team_members (team_id, user_id, role) values (v_invite.team_id, v_user, v_invite.role);
  update public.team_invites i
  set accepted_by = v_user, accepted_at = timezone('utc'::text, now())
  where i.id = v_invite.id;
  return public.team_json(v_invite.team_id);
end;
$$;

-- ------------------------------------------------------------------------------
-- 10. Projetos
-- ------------------------------------------------------------------------------
create or replace function public.project_json(p_project_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', p.id, 'team_id', p.team_id, 'name', p.name, 'visibility', p.visibility,
    'is_default', p.is_default, 'created_by', p.created_by, 'created_at', p.created_at,
    'my_access', public.project_access(p.id)
  )
  from public.projects p where p.id = p_project_id;
$$;

revoke all on function public.project_json(uuid) from public, anon, authenticated;

-- Quem administra o projeto: owner/admin do time, ou quem o criou e ainda o edita
create or replace function public.can_manage_project(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.project_access(p.id) = 'manage'
      or (public.project_access(p.id) = 'edit' and p.created_by = auth.uid())
  from public.projects p where p.id = p_project_id;
$$;

revoke all on function public.can_manage_project(uuid) from public;
grant execute on function public.can_manage_project(uuid) to authenticated;

create or replace function public.create_project(p_team_id uuid, p_name text, p_visibility text default 'team')
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := public.require_user();
  v_name text := btrim(coalesce(p_name, ''));
  v_project uuid;
begin
  if coalesce(public.team_role(p_team_id), '') not in ('owner', 'admin', 'member') then
    raise exception 'Apenas membros com edição criam projetos.' using errcode = '42501';
  end if;
  if char_length(v_name) not between 1 and 100 then
    raise exception 'O nome do projeto deve ter entre 1 e 100 caracteres.' using errcode = '22023';
  end if;
  if coalesce(p_visibility, '') not in ('team', 'private') then
    raise exception 'Visibilidade inválida.' using errcode = '22023';
  end if;
  if (select count(*) from public.projects p where p.team_id = p_team_id) >= 200 then
    raise exception 'Limite de 200 projetos por time atingido.' using errcode = '22023';
  end if;
  insert into public.projects (team_id, name, visibility, created_by)
  values (p_team_id, v_name, p_visibility, v_user)
  returning id into v_project;
  if p_visibility = 'private' then
    insert into public.project_members (project_id, user_id, role, added_by) values (v_project, v_user, 'edit', v_user);
  end if;
  return public.project_json(v_project);
end;
$$;

create or replace function public.update_project(p_project_id uuid, p_name text default null, p_visibility text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := public.require_user();
  v_project public.projects;
begin
  select * into v_project from public.projects p where p.id = p_project_id for update;
  if v_project.id is null or not coalesce(public.can_manage_project(p_project_id), false) then
    raise exception 'Apenas quem administra o projeto pode alterá-lo.' using errcode = '42501';
  end if;
  if p_name is not null and char_length(btrim(p_name)) not between 1 and 100 then
    raise exception 'O nome do projeto deve ter entre 1 e 100 caracteres.' using errcode = '22023';
  end if;
  if p_visibility is not null and p_visibility not in ('team', 'private') then
    raise exception 'Visibilidade inválida.' using errcode = '22023';
  end if;
  if v_project.is_default and p_visibility = 'private' then
    raise exception 'O projeto padrão do time continua aberto ao time.' using errcode = '22023';
  end if;
  -- Ao fechar o projeto, quem fechou continua dentro
  if p_visibility = 'private' and v_project.visibility = 'team' then
    insert into public.project_members (project_id, user_id, role, added_by)
    values (p_project_id, v_user, 'edit', v_user)
    on conflict (project_id, user_id) do update set role = 'edit';
  end if;
  update public.projects p
  set name = coalesce(nullif(btrim(p_name), ''), p.name),
      visibility = coalesce(p_visibility, p.visibility)
  where p.id = p_project_id;
  return public.project_json(p_project_id);
end;
$$;

create or replace function public.delete_project(p_project_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_project public.projects;
begin
  perform public.require_user();
  select * into v_project from public.projects p where p.id = p_project_id;
  if v_project.id is null or coalesce(public.team_role(v_project.team_id), '') not in ('owner', 'admin') then
    raise exception 'Apenas owners e admins do time excluem projetos.' using errcode = '42501';
  end if;
  if v_project.is_default then
    raise exception 'O projeto padrão do time não pode ser excluído.' using errcode = '22023';
  end if;
  if exists (select 1 from public.boards b where b.project_id = p_project_id) then
    raise exception 'Exclua ou mova os quadros do projeto (inclusive os da lixeira) antes de excluí-lo.' using errcode = '22023';
  end if;
  delete from public.projects p where p.id = p_project_id;
  return true;
end;
$$;

create or replace function public.list_project_members(p_project_id uuid)
returns table (user_id uuid, email text, name text, role text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if public.project_access(p_project_id) is null then
    raise exception 'Projeto não encontrado.' using errcode = 'P0002';
  end if;
  return query
  select pm.user_id, u.email::text, public.user_display_name(pm.user_id), pm.role
  from public.project_members pm
  join auth.users u on u.id = pm.user_id
  where pm.project_id = p_project_id
  order by pm.created_at;
end;
$$;

-- p_role null remove a pessoa do projeto
create or replace function public.set_project_member(p_project_id uuid, p_user_id uuid, p_role text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := public.require_user();
begin
  if not coalesce(public.can_manage_project(p_project_id), false) then
    raise exception 'Apenas quem administra o projeto altera os membros.' using errcode = '42501';
  end if;
  if p_role is null then
    delete from public.project_members pm where pm.project_id = p_project_id and pm.user_id = p_user_id;
    return found;
  end if;
  if p_role not in ('edit', 'view') then
    raise exception 'Papel inválido.' using errcode = '22023';
  end if;
  insert into public.project_members (project_id, user_id, role, added_by)
  values (p_project_id, p_user_id, p_role, v_user)
  on conflict (project_id, user_id) do update set role = excluded.role;
  return true;
end;
$$;

-- ------------------------------------------------------------------------------
-- 11. Quadros: acesso, compartilhamento, reivindicação e movimentação
-- ------------------------------------------------------------------------------

-- O que o usuário atual pode fazer num quadro (o link conta só com o cabeçalho x-board-id)
create or replace function public.get_board_access(p_board_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  b public.boards;
  v_member text;
  v_link text;
  v_perm text;
  v_project_access text;
  v_team public.teams;
  v_project public.projects;
begin
  select * into b from public.boards x where x.id = p_board_id;
  if b.id is null then
    return jsonb_build_object('exists', false, 'permission', null);
  end if;
  v_member := public.board_member_permission(b.id);
  v_link := case when b.access_level in ('edit', 'view') and b.id = public.requested_board_id() then b.access_level end;
  v_perm := public.max_perm(v_member, v_link);
  if v_perm is null then
    return jsonb_build_object('exists', true, 'permission', null);
  end if;

  v_project_access := public.project_access(b.project_id);
  select * into v_team from public.teams t where t.id = b.team_id;
  select * into v_project from public.projects p where p.id = b.project_id;
  return jsonb_build_object(
    'exists', true,
    'permission', v_perm,
    'member_permission', v_member,
    'can_share', public.board_can_share(b.id),
    'can_trash', b.team_id is null or v_project_access in ('manage', 'edit') or v_member = 'manage',
    'can_delete', v_member = 'manage',
    'can_move', v_project_access in ('manage', 'edit'),
    'is_creator', b.owner_id is not null and b.owner_id = auth.uid(),
    'access_level', b.access_level,
    'restrict_link_at', b.restrict_link_at,
    'team', case when v_member is not null and v_team.id is not null then jsonb_build_object(
      'id', v_team.id, 'name', v_team.name, 'slug', case when public.team_role(v_team.id) is not null then v_team.slug end,
      'is_personal', v_team.is_personal, 'is_member', public.team_role(v_team.id) is not null) end,
    'project', case when v_project_access is not null then jsonb_build_object(
      'id', v_project.id, 'name', v_project.name, 'visibility', v_project.visibility, 'is_default', v_project.is_default) end
  );
end;
$$;

-- "Pessoas com acesso" do modal de compartilhar
create or replace function public.board_sharing(p_board_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  b public.boards;
  v_team public.teams;
  v_project public.projects;
  v_perm text := public.board_member_permission(p_board_id);
begin
  if v_perm is null then
    raise exception 'Quadro não encontrado.' using errcode = 'P0002';
  end if;
  select * into b from public.boards x where x.id = p_board_id;
  select * into v_team from public.teams t where t.id = b.team_id;
  select * into v_project from public.projects p where p.id = b.project_id;
  return jsonb_build_object(
    'can_share', public.board_can_share(p_board_id),
    'my_permission', v_perm,
    'access_level', b.access_level,
    'restrict_link_at', b.restrict_link_at,
    'creator', case when b.owner_id is not null then jsonb_build_object(
      'user_id', b.owner_id,
      'name', public.user_display_name(b.owner_id),
      'email', (select u.email::text from auth.users u where u.id = b.owner_id),
      'is_you', b.owner_id = auth.uid()) end,
    'team', case when v_team.id is not null then jsonb_build_object(
      'id', v_team.id, 'name', v_team.name, 'is_personal', v_team.is_personal,
      'editors_can_share', v_team.editors_can_share,
      'member_count', (select count(*) from public.team_members m where m.team_id = v_team.id)) end,
    'project', case when v_project.id is not null then jsonb_build_object(
      'id', v_project.id, 'name', v_project.name, 'visibility', v_project.visibility, 'is_default', v_project.is_default,
      'member_count', case when v_project.visibility = 'private'
        then (select count(*) from public.project_members pm where pm.project_id = v_project.id) end) end,
    -- Convites diretos: só e-mail e papel, sem indicar quem já tem conta
    'members', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', bm.id, 'email', bm.email, 'role', bm.role, 'is_you', bm.user_id is not null and bm.user_id = auth.uid()
      ) order by bm.created_at)
      from public.board_members bm where bm.board_id = p_board_id
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.share_board(p_board_id uuid, p_email text, p_role text default 'view')
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := public.require_user();
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_team uuid;
  v_target uuid;
  v_row public.board_members;
begin
  if p_role not in ('edit', 'view') then
    raise exception 'Papel inválido.' using errcode = '22023';
  end if;
  if char_length(v_email) > 254 or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'E-mail inválido.' using errcode = '22023';
  end if;
  select b.team_id into v_team from public.boards b where b.id = p_board_id;
  if v_team is null or not public.board_can_share(p_board_id) then
    raise exception 'Você não tem permissão para compartilhar este quadro.' using errcode = '42501';
  end if;
  if (select count(*) from public.board_members bm where bm.invited_by = v_user
      and bm.created_at > timezone('utc'::text, now()) - interval '1 hour') >= 60 then
    raise exception 'Muitos convites em pouco tempo. Tente novamente mais tarde.' using errcode = '22023';
  end if;
  if (select count(*) from public.board_members bm where bm.board_id = p_board_id) >= 100 then
    raise exception 'Limite de 100 pessoas convidadas por quadro.' using errcode = '22023';
  end if;

  select u.id into v_target from auth.users u
  where lower(u.email) = v_email and public.proven_email(u.id) = v_email
  limit 1;

  if v_target is not null then
    update public.board_members bm set role = p_role, updated_at = timezone('utc'::text, now())
    where bm.board_id = p_board_id and bm.user_id = v_target
    returning * into v_row;
  end if;
  if v_row.id is null then
    insert into public.board_members (board_id, user_id, email, role, invited_by)
    values (p_board_id, v_target, v_email, p_role, v_user)
    on conflict (board_id, email) do update
      set role = excluded.role,
          user_id = coalesce(public.board_members.user_id, excluded.user_id),
          updated_at = timezone('utc'::text, now())
    returning * into v_row;
  end if;
  return jsonb_build_object('id', v_row.id, 'email', v_row.email, 'role', v_row.role);
end;
$$;

create or replace function public.update_board_share(p_member_id uuid, p_role text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_board uuid;
begin
  perform public.require_user();
  if p_role not in ('edit', 'view') then
    raise exception 'Papel inválido.' using errcode = '22023';
  end if;
  select bm.board_id into v_board from public.board_members bm where bm.id = p_member_id;
  if v_board is null or not public.board_can_share(v_board) then
    raise exception 'Convite não encontrado.' using errcode = 'P0002';
  end if;
  update public.board_members bm set role = p_role, updated_at = timezone('utc'::text, now()) where bm.id = p_member_id;
  return true;
end;
$$;

-- Quem compartilha remove qualquer convite; a pessoa convidada pode remover o próprio acesso
create or replace function public.remove_board_share(p_member_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.board_members;
begin
  perform public.require_user();
  select * into v_row from public.board_members bm where bm.id = p_member_id;
  if v_row.id is null or not (coalesce(v_row.user_id = auth.uid(), false) or public.board_can_share(v_row.board_id)) then
    raise exception 'Convite não encontrado.' using errcode = 'P0002';
  end if;
  delete from public.board_members bm where bm.id = p_member_id;
  return true;
end;
$$;

-- Reivindicar um quadro anônimo (criado sem login): escolhe projeto e acesso geral
create or replace function public.claim_board(p_board_id uuid, p_project_id uuid, p_access_level text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := public.require_user();
  b public.boards;
  v_team uuid;
begin
  if p_access_level not in ('edit', 'restricted') then
    raise exception 'Escolha se o quadro continua aberto por link ou fica restrito.' using errcode = '22023';
  end if;
  select * into b from public.boards x where x.id = p_board_id for update;
  -- Quem reivindica precisa ter aberto o quadro pelo link (como antes)
  if b.id is null or b.id is distinct from public.requested_board_id() then
    raise exception 'Quadro não encontrado.' using errcode = 'P0002';
  end if;
  if b.team_id is not null or b.owner_id is not null then
    raise exception 'Este quadro já pertence a um time.' using errcode = '22023';
  end if;
  if b.access_level <> 'edit' then
    raise exception 'Quadro não encontrado.' using errcode = 'P0002';
  end if;
  if coalesce(public.project_access(p_project_id), '') not in ('manage', 'edit') then
    raise exception 'Você não pode criar quadros neste projeto.' using errcode = '42501';
  end if;
  select p.team_id into v_team from public.projects p where p.id = p_project_id;

  perform set_config('heeey.system', 'on', true);
  update public.boards x
  set owner_id = v_user, team_id = v_team, project_id = p_project_id, folder_id = null, access_level = p_access_level
  where x.id = p_board_id
  returning * into b;
  perform set_config('heeey.system', 'off', true);
  return jsonb_build_object('id', b.id, 'team_id', b.team_id, 'project_id', b.project_id, 'access_level', b.access_level);
end;
$$;

-- Mover para outro projeto (e pasta). Entre times: owner/admin nos dois.
create or replace function public.move_board(p_board_id uuid, p_project_id uuid, p_folder_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  b public.boards;
  v_team uuid;
begin
  perform public.require_user();
  select * into b from public.boards x where x.id = p_board_id for update;
  if b.id is null or b.team_id is null or public.board_member_permission(b.id) is null then
    raise exception 'Quadro não encontrado.' using errcode = 'P0002';
  end if;
  select p.team_id into v_team from public.projects p where p.id = p_project_id;
  if v_team is null or public.project_access(p_project_id) is null then
    raise exception 'Projeto não encontrado.' using errcode = 'P0002';
  end if;
  if v_team = b.team_id then
    if coalesce(public.project_access(b.project_id), '') not in ('manage', 'edit')
      or coalesce(public.project_access(p_project_id), '') not in ('manage', 'edit') then
      raise exception 'Você precisa editar os dois projetos para mover o quadro.' using errcode = '42501';
    end if;
  elsif coalesce(public.team_role(b.team_id), '') not in ('owner', 'admin')
     or coalesce(public.team_role(v_team), '') not in ('owner', 'admin') then
    raise exception 'Para mover entre times, você precisa ser owner ou admin nos dois.' using errcode = '42501';
  end if;
  if p_folder_id is not null and not exists (
    select 1 from public.folders f where f.id = p_folder_id and f.project_id = p_project_id
  ) then
    raise exception 'Pasta de destino não encontrada.' using errcode = 'P0002';
  end if;

  perform set_config('heeey.system', 'on', true);
  update public.boards x set team_id = v_team, project_id = p_project_id, folder_id = p_folder_id
  where x.id = p_board_id
  returning * into b;
  perform set_config('heeey.system', 'off', true);
  return jsonb_build_object('id', b.id, 'team_id', b.team_id, 'project_id', b.project_id, 'folder_id', b.folder_id);
end;
$$;

-- "Manter link aberto": cancela a migração agendada deste quadro
create or replace function public.keep_board_link_open(p_board_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_user();
  if not public.board_can_share(p_board_id) then
    raise exception 'Você não tem permissão para compartilhar este quadro.' using errcode = '42501';
  end if;
  perform set_config('heeey.system', 'on', true);
  update public.boards b set restrict_link_at = null where b.id = p_board_id and b.restrict_link_at is not null;
  perform set_config('heeey.system', 'off', true);
  return true;
end;
$$;

-- Cron diário: aplica as restrições de link que venceram
create or replace function public.apply_scheduled_link_restrictions()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  perform set_config('heeey.system', 'on', true);
  update public.boards b
  set access_level = 'restricted'
  where b.restrict_link_at is not null
    and b.restrict_link_at <= timezone('utc'::text, now())
    and b.team_id is not null
    and b.deleted_at is null;
  get diagnostics v_count = row_count;
  perform set_config('heeey.system', 'off', true);
  return v_count;
end;
$$;

revoke all on function public.apply_scheduled_link_restrictions() from public, anon, authenticated;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.apply_scheduled_link_restrictions() to service_role;
  end if;
end;
$$;

-- Permissões das funções do app: só para quem está logado (a prévia do convite também para anon)
do $$
declare
  fn text;
begin
  foreach fn in array array[
    'public.create_team(text)',
    'public.update_team(uuid, text, boolean)',
    'public.delete_team(uuid)',
    'public.list_team_members(uuid)',
    'public.set_team_member_role(uuid, uuid, text)',
    'public.remove_team_member(uuid, uuid)',
    'public.create_team_invite(uuid, text)',
    'public.revoke_team_invite(uuid)',
    'public.accept_team_invite(text)',
    'public.create_project(uuid, text, text)',
    'public.update_project(uuid, text, text)',
    'public.delete_project(uuid)',
    'public.list_project_members(uuid)',
    'public.set_project_member(uuid, uuid, text)',
    'public.board_sharing(uuid)',
    'public.share_board(uuid, text, text)',
    'public.update_board_share(uuid, text)',
    'public.remove_board_share(uuid)',
    'public.claim_board(uuid, uuid, text)',
    'public.move_board(uuid, uuid, uuid)',
    'public.keep_board_link_open(uuid)'
  ] loop
    execute format('revoke all on function %s from public, anon', fn);
    execute format('grant execute on function %s to authenticated', fn);
  end loop;
end;
$$;

revoke all on function public.get_team_invite(text) from public;
grant execute on function public.get_team_invite(text) to anon, authenticated;
revoke all on function public.get_board_access(uuid) from public;
grant execute on function public.get_board_access(uuid) to anon, authenticated;

-- ------------------------------------------------------------------------------
-- 12. Busca: quadros dos times (projetos visíveis) e compartilhados comigo
-- ------------------------------------------------------------------------------
drop function if exists public.search_boards(text, integer);
create or replace function public.search_boards(p_query text, p_limit integer default 20, p_team_id uuid default null)
returns table (
  id uuid,
  title text,
  owner_id uuid,
  team_id uuid,
  project_id uuid,
  folder_id uuid,
  access_level text,
  thumbnail text,
  created_at timestamptz,
  updated_at timestamptz,
  content text,
  rank real
)
language plpgsql
stable
set search_path = ''
as $$
declare
  q tsquery;
begin
  if auth.uid() is null then
    return;
  end if;

  select to_tsquery('simple', string_agg(w || ':*', ' & '))
  into q
  from (
    select regexp_replace(t, '[^[:alnum:]]', '', 'g') as w
    from regexp_split_to_table(extensions.unaccent('extensions.unaccent'::regdictionary, lower(btrim(coalesce(p_query, '')))), '\s+') t
  ) words
  where w <> '';

  if q is null then
    return;
  end if;

  return query
  select
    b.id, b.title, b.owner_id, b.team_id, b.project_id, b.folder_id, b.access_level, b.thumbnail,
    b.created_at, b.updated_at,
    left(public.board_plain_text(b.elements), 2000) as content,
    ts_rank(b.search_vector, q) as rank
  from public.boards b
  where b.deleted_at is null
    and b.search_vector @@ q
    and (
      (b.project_id in (select public.readable_project_ids()) and (p_team_id is null or b.team_id = p_team_id))
      or (p_team_id is null and b.id in (select public.shared_board_ids()))
    )
  order by rank desc, b.updated_at desc
  limit least(greatest(coalesce(p_limit, 20), 1), 50);
end;
$$;

revoke all on function public.search_boards(text, integer, uuid) from public, anon;
grant execute on function public.search_boards(text, integer, uuid) to authenticated;

drop function if exists public.search_candidates(integer);
create or replace function public.search_candidates(p_limit integer default 40, p_team_id uuid default null)
returns table (
  id uuid,
  title text,
  owner_id uuid,
  team_id uuid,
  project_id uuid,
  folder_id uuid,
  access_level text,
  thumbnail text,
  created_at timestamptz,
  updated_at timestamptz,
  content text
)
language sql
stable
set search_path = ''
as $$
  select
    b.id, b.title, b.owner_id, b.team_id, b.project_id, b.folder_id, b.access_level, b.thumbnail,
    b.created_at, b.updated_at,
    left(public.board_plain_text(b.elements), 600) as content
  from public.boards b
  where auth.uid() is not null
    and b.deleted_at is null
    and (
      (b.project_id in (select public.readable_project_ids()) and (p_team_id is null or b.team_id = p_team_id))
      or (p_team_id is null and b.id in (select public.shared_board_ids()))
    )
  order by b.updated_at desc
  limit least(greatest(coalesce(p_limit, 40), 1), 60);
$$;

revoke all on function public.search_candidates(integer, uuid) from public, anon;
grant execute on function public.search_candidates(integer, uuid) to authenticated;

-- ------------------------------------------------------------------------------
-- 13. Chaves de API por time e API pública
-- ------------------------------------------------------------------------------
drop function if exists public.create_api_key(text, text[]);
create or replace function public.create_api_key(
  p_name text,
  p_scopes text[] default array['read', 'write'],
  p_team_ids uuid[] default null
)
returns table (id uuid, key text, prefix text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_teams uuid[];
  v_secret text;
  v_prefix text;
  v_key text;
  v_id uuid;
begin
  if v_user is null then
    raise exception 'Entre na sua conta para criar chaves de API.';
  end if;
  if (select count(*) from public.api_keys k where k.user_id = v_user and k.revoked_at is null) >= 20 then
    raise exception 'Limite de 20 chaves ativas atingido. Revogue uma chave antes de criar outra.';
  end if;

  -- Sem times escolhidos: só o time pessoal
  v_teams := coalesce(p_team_ids, array[public.create_personal_team(v_user)]);
  if cardinality(v_teams) = 0 or exists (
    select 1 from unnest(v_teams) t(team_id) where public.team_role(t.team_id) is null
  ) then
    raise exception 'Escolha pelo menos um time do qual você participa.' using errcode = '22023';
  end if;

  v_secret := encode(extensions.gen_random_bytes(24), 'hex');
  v_prefix := 'hk_' || substr(v_secret, 1, 8);
  v_key := v_prefix || '_' || substr(v_secret, 9);

  insert into public.api_keys as k (user_id, name, prefix, key_hash, scopes)
  values (
    v_user,
    btrim(p_name),
    v_prefix,
    encode(extensions.digest(v_key, 'sha256'), 'hex'),
    coalesce(p_scopes, array['read', 'write'])
  )
  returning k.id into v_id;

  insert into public.api_key_teams (api_key_id, team_id)
  select v_id, t.team_id from (select distinct unnest(v_teams) as team_id) t;

  return query select v_id, v_key, v_prefix;
end;
$$;

revoke all on function public.create_api_key(text, text[], uuid[]) from public, anon;
grant execute on function public.create_api_key(text, text[], uuid[]) to authenticated;

-- Valida a chave e o escopo, devolve o usuário e faz auth.uid() valer esse usuário
-- (e heeey.api_key valer a chave) até o fim da transação
create or replace function public.api_authenticate(p_key text, p_scope text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_key public.api_keys;
begin
  select * into v_key
  from public.api_keys k
  where k.key_hash = encode(extensions.digest(coalesce(p_key, ''), 'sha256'), 'hex')
    and k.revoked_at is null;

  if v_key.id is null then
    raise exception 'Chave de API inválida ou revogada.' using errcode = '28000';
  end if;
  if not (p_scope = any(v_key.scopes)) then
    raise exception 'Esta chave de API não tem permissão de %.',
      case p_scope when 'write' then 'escrita' else 'leitura' end
      using errcode = '42501';
  end if;

  if v_key.last_used_at is null or v_key.last_used_at < timezone('utc'::text, now()) - interval '1 minute' then
    update public.api_keys k set last_used_at = timezone('utc'::text, now()) where k.id = v_key.id;
  end if;

  perform set_config('request.jwt.claim.sub', v_key.user_id::text, true);
  perform set_config('heeey.api_key', v_key.id::text, true);
  return v_key.user_id;
end;
$$;

revoke all on function public.api_authenticate(text, text) from public, anon, authenticated;

-- Times que a chave atual alcança (e dos quais o usuário ainda participa)
create or replace function public.api_team_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select akt.team_id
  from public.api_key_teams akt
  join public.team_members m on m.team_id = akt.team_id and m.user_id = auth.uid()
  where akt.api_key_id = nullif(current_setting('heeey.api_key', true), '')::uuid;
$$;

revoke all on function public.api_team_ids() from public, anon, authenticated;

create or replace function public.api_board_summary(b public.boards)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'id', b.id,
    'title', b.title,
    'team_id', b.team_id,
    'project_id', b.project_id,
    'folder_id', b.folder_id,
    'access_level', b.access_level,
    'created_at', b.created_at,
    'updated_at', b.updated_at,
    'deleted_at', b.deleted_at,
    'element_count', (
      select count(*) from jsonb_array_elements(b.elements) e
      where coalesce((e->>'isDeleted')::boolean, false) = false
    )
  );
$$;

revoke all on function public.api_board_summary(public.boards) from public, anon, authenticated;

-- Quadro alcançado pela chave (bloqueado para edição quando p_write) ou 404
drop function if exists public.api_own_board(uuid, uuid, boolean);
create or replace function public.api_board(p_board_id uuid, p_write boolean default false)
returns public.boards
language plpgsql
security definer
set search_path = ''
as $$
declare
  b public.boards;
  v_perm text;
begin
  if p_write then
    select * into b from public.boards x
    where x.id = p_board_id and x.team_id in (select public.api_team_ids()) for update;
  else
    select * into b from public.boards x
    where x.id = p_board_id and x.team_id in (select public.api_team_ids());
  end if;
  v_perm := case when b.id is not null then public.board_member_permission(b.id) end;
  if v_perm is null then
    raise exception 'Quadro não encontrado.' using errcode = 'P0002';
  end if;
  if p_write and v_perm not in ('manage', 'edit') then
    raise exception 'Você só pode ler este quadro.' using errcode = '42501';
  end if;
  return b;
end;
$$;

revoke all on function public.api_board(uuid, boolean) from public, anon, authenticated;

-- Projeto de destino da API: o informado, o da pasta, o padrão do time pessoal ou o do
-- primeiro time da chave
create or replace function public.api_target_project(p_project_id uuid, p_folder_id uuid)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_project uuid := p_project_id;
begin
  if v_project is null and p_folder_id is not null then
    select f.project_id into v_project from public.folders f where f.id = p_folder_id;
    if v_project is null then
      raise exception 'Pasta de destino não encontrada.' using errcode = 'P0002';
    end if;
  end if;
  if v_project is null then
    select p.id into v_project from public.projects p
    join public.teams t on t.id = p.team_id
    where p.is_default and p.team_id in (select public.api_team_ids())
    order by (t.is_personal and t.created_by = auth.uid()) desc, t.created_at
    limit 1;
  end if;
  if v_project is null or not exists (
    select 1 from public.projects p where p.id = v_project and p.team_id in (select public.api_team_ids())
  ) or coalesce(public.project_access(v_project), '') not in ('manage', 'edit') then
    raise exception 'Projeto não encontrado ou sem permissão de edição.' using errcode = 'P0002';
  end if;
  return v_project;
end;
$$;

revoke all on function public.api_target_project(uuid, uuid) from public, anon, authenticated;

drop function if exists public.api_list_boards(text, uuid, boolean, integer, integer);
create or replace function public.api_list_boards(
  p_key text,
  p_folder_id uuid default null,
  p_include_trashed boolean default false,
  p_limit integer default 50,
  p_offset integer default 0,
  p_project_id uuid default null,
  p_team_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := public.api_authenticate(p_key, 'read');
begin
  return coalesce((
    select jsonb_agg(public.api_board_summary(b) order by b.updated_at desc)
    from (
      select * from public.boards b
      where b.team_id in (select public.api_team_ids())
        and b.project_id in (select public.readable_project_ids())
        and (p_team_id is null or b.team_id = p_team_id)
        and (p_project_id is null or b.project_id = p_project_id)
        and (p_folder_id is null or b.folder_id = p_folder_id)
        and (p_include_trashed or b.deleted_at is null)
      order by b.updated_at desc
      limit least(greatest(coalesce(p_limit, 50), 1), 200)
      offset greatest(coalesce(p_offset, 0), 0)
    ) b
  ), '[]'::jsonb);
end;
$$;

create or replace function public.api_get_board(p_key text, p_board_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := public.api_authenticate(p_key, 'read');
  b public.boards := public.api_board(p_board_id);
begin
  return public.api_board_summary(b) || jsonb_build_object(
    'elements', (
      select coalesce(jsonb_agg(e), '[]'::jsonb) from jsonb_array_elements(b.elements) e
      where coalesce((e->>'isDeleted')::boolean, false) = false
    ),
    'app_state', b.app_state,
    'files', b.files
  );
end;
$$;

drop function if exists public.api_create_board(text, text, jsonb, uuid);
create or replace function public.api_create_board(
  p_key text,
  p_title text default null,
  p_elements jsonb default '[]'::jsonb,
  p_folder_id uuid default null,
  p_project_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := public.api_authenticate(p_key, 'write');
  v_project uuid;
  b public.boards;
begin
  perform public.api_check_elements(p_elements);
  v_project := public.api_target_project(p_project_id, p_folder_id);
  -- Quadros novos nascem restritos: só o time/projeto e quem for convidado acessam
  insert into public.boards (title, owner_id, elements, folder_id, project_id, access_level)
  values (
    coalesce(nullif(btrim(p_title), ''), 'Quadro sem título'),
    v_user,
    coalesce(p_elements, '[]'::jsonb),
    p_folder_id,
    v_project,
    'restricted'
  )
  returning * into b;
  return public.api_board_summary(b);
end;
$$;

create or replace function public.api_update_board(
  p_key text,
  p_board_id uuid,
  p_title text default null,
  p_elements jsonb default null,
  p_delete_element_ids text[] default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := public.api_authenticate(p_key, 'write');
  b public.boards := public.api_board(p_board_id, true);
  v_now bigint := (extract(epoch from clock_timestamp()) * 1000)::bigint;
  v_merged jsonb;
  v_changed jsonb;
begin
  perform public.api_check_elements(p_elements);

  with current_elements as (
    select e, e->>'id' as id, ord
    from jsonb_array_elements(b.elements) with ordinality t(e, ord)
  ),
  incoming as (
    select distinct on (e->>'id') e, e->>'id' as id, ord
    from jsonb_array_elements(coalesce(p_elements, '[]'::jsonb)) with ordinality t(e, ord)
    order by e->>'id', ord desc
  ),
  bump as (
    -- New or updated elements from the request
    select
      i.id,
      coalesce(c.ord, 1000000 + i.ord) as ord,
      i.e || jsonb_build_object(
        'version', greatest(coalesce((c.e->>'version')::bigint, 0), coalesce((i.e->>'version')::bigint, 0)) + 1,
        'versionNonce', floor(random() * 2147483647)::bigint,
        'updated', v_now,
        'isDeleted', coalesce((i.e->>'isDeleted')::boolean, false)
      ) as e,
      true as changed
    from incoming i
    left join current_elements c on c.id = i.id
    union all
    -- Removed elements become tombstones
    select
      c.id,
      c.ord,
      c.e || jsonb_build_object(
        'isDeleted', true,
        'version', coalesce((c.e->>'version')::bigint, 0) + 1,
        'versionNonce', floor(random() * 2147483647)::bigint,
        'updated', v_now
      ),
      true
    from current_elements c
    where c.id = any(coalesce(p_delete_element_ids, array[]::text[]))
      and not exists (select 1 from incoming i where i.id = c.id)
      and coalesce((c.e->>'isDeleted')::boolean, false) = false
    union all
    -- Untouched elements
    select c.id, c.ord, c.e, false
    from current_elements c
    where not exists (select 1 from incoming i where i.id = c.id)
      and not (
        c.id = any(coalesce(p_delete_element_ids, array[]::text[]))
        and coalesce((c.e->>'isDeleted')::boolean, false) = false
      )
  )
  select
    coalesce(jsonb_agg(e order by ord), '[]'::jsonb),
    coalesce(jsonb_agg(e order by ord) filter (where changed), '[]'::jsonb)
  into v_merged, v_changed
  from bump;

  update public.boards
  set
    title = coalesce(nullif(btrim(p_title), ''), title),
    elements = v_merged
  where id = b.id
  returning * into b;

  perform public.api_broadcast_elements(b.id, v_changed);
  return public.api_board_summary(b);
end;
$$;

create or replace function public.api_trash_board(p_key text, p_board_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := public.api_authenticate(p_key, 'write');
  b public.boards := public.api_board(p_board_id, true);
begin
  update public.boards set deleted_at = timezone('utc'::text, now())
  where id = b.id and deleted_at is null
  returning * into b;
  return public.api_board_summary(coalesce(b, public.api_board(p_board_id)));
end;
$$;

create or replace function public.api_move_board(p_key text, p_board_id uuid, p_folder_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := public.api_authenticate(p_key, 'write');
  b public.boards := public.api_board(p_board_id, true);
begin
  update public.boards set folder_id = p_folder_id where id = b.id returning * into b;
  return public.api_board_summary(b);
end;
$$;

create or replace function public.api_search_boards(p_key text, p_query text, p_limit integer default 20)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := public.api_authenticate(p_key, 'read');
begin
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', s.id,
      'title', s.title,
      'team_id', s.team_id,
      'project_id', s.project_id,
      'folder_id', s.folder_id,
      'updated_at', s.updated_at,
      'text', left(s.content, 500)
    ) order by s.rank desc)
    from public.search_boards(p_query, 50) s
    where s.team_id in (select public.api_team_ids())
  ), '[]'::jsonb);
end;
$$;

drop function if exists public.api_list_folders(text);
create or replace function public.api_list_folders(p_key text, p_project_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := public.api_authenticate(p_key, 'read');
begin
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', f.id, 'name', f.name, 'parent_id', f.parent_id, 'project_id', f.project_id) order by f.name)
    from public.folders f
    where f.team_id in (select public.api_team_ids())
      and f.project_id in (select public.readable_project_ids())
      and (p_project_id is null or f.project_id = p_project_id)
  ), '[]'::jsonb);
end;
$$;

drop function if exists public.api_create_folder(text, text, uuid);
create or replace function public.api_create_folder(p_key text, p_name text, p_parent_id uuid default null, p_project_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := public.api_authenticate(p_key, 'write');
  v_project uuid;
  f public.folders;
begin
  if p_project_id is null and p_parent_id is not null then
    select x.project_id into v_project from public.folders x where x.id = p_parent_id;
  end if;
  v_project := public.api_target_project(coalesce(p_project_id, v_project), null);
  insert into public.folders (owner_id, name, parent_id, project_id)
  values (v_user, btrim(p_name), p_parent_id, v_project)
  returning * into f;
  return jsonb_build_object('id', f.id, 'name', f.name, 'parent_id', f.parent_id, 'project_id', f.project_id);
end;
$$;

-- Times e projetos que a chave alcança, para o agente saber onde criar quadros
create or replace function public.api_list_projects(p_key text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := public.api_authenticate(p_key, 'read');
begin
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', p.id, 'name', p.name, 'visibility', p.visibility, 'is_default', p.is_default,
      'team_id', t.id, 'team_name', t.name, 'team_is_personal', t.is_personal,
      'access', public.project_access(p.id)
    ) order by t.is_personal desc, t.name, p.is_default desc, p.name)
    from public.projects p
    join public.teams t on t.id = p.team_id
    where p.team_id in (select public.api_team_ids())
      and p.id in (select public.readable_project_ids())
  ), '[]'::jsonb);
end;
$$;

grant execute on function public.api_list_boards(text, uuid, boolean, integer, integer, uuid, uuid) to anon, authenticated;
grant execute on function public.api_get_board(text, uuid) to anon, authenticated;
grant execute on function public.api_create_board(text, text, jsonb, uuid, uuid) to anon, authenticated;
grant execute on function public.api_update_board(text, uuid, text, jsonb, text[]) to anon, authenticated;
grant execute on function public.api_trash_board(text, uuid) to anon, authenticated;
grant execute on function public.api_move_board(text, uuid, uuid) to anon, authenticated;
grant execute on function public.api_search_boards(text, text, integer) to anon, authenticated;
grant execute on function public.api_list_folders(text, uuid) to anon, authenticated;
grant execute on function public.api_create_folder(text, text, uuid, uuid) to anon, authenticated;
grant execute on function public.api_list_projects(text) to anon, authenticated;

-- ------------------------------------------------------------------------------
-- 14. Auditoria
-- ------------------------------------------------------------------------------
create or replace function public.audit_board_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_system boolean := public.is_system_change();
begin
  if tg_op = 'INSERT' then
    insert into public.audit_log (actor_id, action, entity, entity_id, team_id, details)
    values (v_actor, 'board.created', 'board', new.id, new.team_id,
      jsonb_build_object('owner_id', new.owner_id, 'project_id', new.project_id, 'access_level', new.access_level));
    return new;
  end if;

  if tg_op = 'DELETE' then
    insert into public.audit_log (actor_id, action, entity, entity_id, team_id, details)
    values (
      v_actor,
      case when current_setting('heeey.audit_purge', true) = 'on' then 'board.purged' else 'board.deleted' end,
      'board', old.id, old.team_id,
      jsonb_build_object('owner_id', old.owner_id, 'trashed_at', old.deleted_at)
    );
    return old;
  end if;

  if old.owner_id is null and new.owner_id is not null then
    insert into public.audit_log (actor_id, action, entity, entity_id, team_id, details)
    values (v_actor, 'board.claimed', 'board', new.id, new.team_id,
      jsonb_build_object('owner_id', new.owner_id, 'project_id', new.project_id, 'access_level', new.access_level));
  elsif old.access_level is distinct from new.access_level then
    insert into public.audit_log (actor_id, action, entity, entity_id, team_id, details)
    values (
      case when v_system and v_actor is null then null else v_actor end,
      case when v_system and new.access_level = 'restricted' and old.restrict_link_at is not null
           then 'board.link_restricted' else 'board.access_changed' end,
      'board', new.id, new.team_id,
      jsonb_build_object('from', old.access_level, 'to', new.access_level, 'system', v_system));
  end if;
  if old.team_id is not null and (old.team_id is distinct from new.team_id or old.project_id is distinct from new.project_id) then
    insert into public.audit_log (actor_id, action, entity, entity_id, team_id, details)
    values (v_actor, 'board.moved', 'board', new.id, new.team_id,
      jsonb_build_object('from_team', old.team_id, 'to_team', new.team_id,
        'from_project', old.project_id, 'to_project', new.project_id));
  end if;
  if old.restrict_link_at is not null and new.restrict_link_at is null and old.access_level = new.access_level then
    insert into public.audit_log (actor_id, action, entity, entity_id, team_id)
    values (v_actor, 'board.link_kept_open', 'board', new.id, new.team_id);
  end if;
  if old.deleted_at is null and new.deleted_at is not null then
    insert into public.audit_log (actor_id, action, entity, entity_id, team_id)
    values (v_actor, 'board.trashed', 'board', new.id, new.team_id);
  elsif old.deleted_at is not null and new.deleted_at is null then
    insert into public.audit_log (actor_id, action, entity, entity_id, team_id)
    values (v_actor, 'board.restored', 'board', new.id, new.team_id);
  end if;
  return new;
end;
$$;

revoke all on function public.audit_board_change() from public, anon, authenticated;

drop trigger if exists audit_boards_update on public.boards;
create trigger audit_boards_update
  after update on public.boards
  for each row
  when (
    (old.owner_id is null and new.owner_id is not null)
    or old.access_level is distinct from new.access_level
    or (old.deleted_at is null) <> (new.deleted_at is null)
    or (old.team_id is not null and (old.team_id is distinct from new.team_id or old.project_id is distinct from new.project_id))
    or (old.restrict_link_at is not null and new.restrict_link_at is null)
  )
  execute function public.audit_board_change();

-- Times, membros, convites, projetos e compartilhamentos
create or replace function public.audit_team_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_row jsonb := to_jsonb(coalesce(new, old));
  v_old jsonb := case when tg_op = 'UPDATE' then to_jsonb(old) end;
  v_team uuid;
  v_action text;
  v_entity text;
  v_entity_id uuid;
  v_details jsonb := '{}'::jsonb;
begin
  case tg_table_name
    when 'teams' then
      v_entity := 'team'; v_entity_id := (v_row->>'id')::uuid; v_team := v_entity_id;
      v_action := case tg_op when 'INSERT' then 'team.created' when 'DELETE' then 'team.deleted' else 'team.updated' end;
      v_details := jsonb_build_object('name', v_row->>'name', 'is_personal', v_row->'is_personal',
        'editors_can_share', v_row->'editors_can_share');
    when 'team_members' then
      v_entity := 'team_member'; v_entity_id := (v_row->>'user_id')::uuid; v_team := (v_row->>'team_id')::uuid;
      v_action := case tg_op when 'INSERT' then 'team.member_added' when 'DELETE' then 'team.member_removed' else 'team.member_role_changed' end;
      v_details := jsonb_build_object('role', v_row->>'role', 'from', v_old->>'role');
    when 'team_invites' then
      v_entity := 'team_invite'; v_entity_id := (v_row->>'id')::uuid; v_team := (v_row->>'team_id')::uuid;
      v_action := case
        when tg_op = 'INSERT' then 'team.invite_created'
        when v_row->>'accepted_at' is not null and v_old->>'accepted_at' is null then 'team.invite_accepted'
        else 'team.invite_revoked' end;
      v_details := jsonb_build_object('role', v_row->>'role', 'accepted_by', v_row->>'accepted_by');
    when 'projects' then
      v_entity := 'project'; v_entity_id := (v_row->>'id')::uuid; v_team := (v_row->>'team_id')::uuid;
      v_action := case tg_op when 'INSERT' then 'project.created' when 'DELETE' then 'project.deleted' else 'project.updated' end;
      v_details := jsonb_build_object('visibility', v_row->>'visibility', 'from_visibility', v_old->>'visibility');
    when 'project_members' then
      v_entity := 'project_member'; v_entity_id := (v_row->>'user_id')::uuid;
      select p.team_id into v_team from public.projects p where p.id = (v_row->>'project_id')::uuid;
      v_action := case tg_op when 'INSERT' then 'project.member_added' when 'DELETE' then 'project.member_removed' else 'project.member_role_changed' end;
      v_details := jsonb_build_object('project_id', v_row->>'project_id', 'role', v_row->>'role');
    when 'board_members' then
      v_entity := 'board'; v_entity_id := (v_row->>'board_id')::uuid;
      select b.team_id into v_team from public.boards b where b.id = v_entity_id;
      v_action := case
        when tg_op = 'INSERT' then 'board.shared'
        when tg_op = 'DELETE' then 'board.unshared'
        when v_row->>'role' is distinct from v_old->>'role' then 'board.share_role_changed'
        else 'board.share_activated' end;
      v_details := jsonb_build_object('member_id', v_row->>'id', 'user_id', v_row->>'user_id', 'role', v_row->>'role');
  end case;

  -- Na exclusão em cascata de um time ou quadro, os registros filhos não precisam de evento próprio
  if tg_op = 'DELETE' and tg_table_name <> 'teams' and (
    (v_team is not null and not exists (select 1 from public.teams t where t.id = v_team))
    or (tg_table_name = 'board_members' and v_team is null)
  ) then
    return old;
  end if;

  insert into public.audit_log (actor_id, action, entity, entity_id, team_id, details)
  values (v_actor, v_action, v_entity, v_entity_id, v_team, v_details);
  return coalesce(new, old);
end;
$$;

revoke all on function public.audit_team_change() from public, anon, authenticated;

drop trigger if exists audit_teams on public.teams;
create trigger audit_teams after insert or delete or update of name, editors_can_share on public.teams
  for each row execute function public.audit_team_change();
drop trigger if exists audit_team_members on public.team_members;
create trigger audit_team_members after insert or delete or update of role on public.team_members
  for each row execute function public.audit_team_change();
drop trigger if exists audit_team_invites on public.team_invites;
create trigger audit_team_invites after insert or update of revoked_at, accepted_at on public.team_invites
  for each row execute function public.audit_team_change();
drop trigger if exists audit_projects on public.projects;
create trigger audit_projects after insert or delete or update of visibility on public.projects
  for each row execute function public.audit_team_change();
drop trigger if exists audit_project_members on public.project_members;
create trigger audit_project_members after insert or delete or update of role on public.project_members
  for each row execute function public.audit_team_change();
drop trigger if exists audit_board_members on public.board_members;
create trigger audit_board_members after insert or delete or update of role, user_id on public.board_members
  for each row execute function public.audit_team_change();
