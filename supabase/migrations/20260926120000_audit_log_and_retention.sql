-- ==============================================================================
-- Trilha de auditoria (audit log) e retenção de dados
-- - public.audit_log: eventos de segurança (criação, lixeira, exclusão, mudança de acesso,
--   reivindicação de quadros; criação e revogação de chaves de API). Nunca guarda o conteúdo
--   dos quadros, só quem fez o quê e quando. Somente leitura pelo painel/service_role.
-- - public.purge_expired_data(): exclui quadros na lixeira há mais de 30 dias e eventos de
--   auditoria com mais de 1 ano. Chamada diariamente pelo Vercel Cron (api/cron/purge.ts).
-- ==============================================================================

-- 1. Tabela de auditoria (somente inserção)
create table if not exists public.audit_log (
  id bigint generated always as identity primary key,
  occurred_at timestamptz not null default timezone('utc'::text, now()),
  -- Usuário que fez a ação (auth.uid(); também vale para chaves de API). null = anônimo ou sistema
  actor_id uuid,
  action text not null,
  entity text not null,
  entity_id uuid,
  details jsonb not null default '{}'::jsonb
);

create index if not exists idx_audit_log_occurred_at on public.audit_log(occurred_at);
create index if not exists idx_audit_log_entity on public.audit_log(entity, entity_id);
create index if not exists idx_audit_log_actor on public.audit_log(actor_id) where actor_id is not null;

-- Sem políticas: com RLS ligado e sem grants, anon e authenticated não leem nem escrevem.
-- As funções de gatilho abaixo (security definer) são o único caminho de escrita.
alter table public.audit_log enable row level security;
revoke all on public.audit_log from anon, authenticated;

-- Registros não mudam; só a rotina de retenção pode apagá-los
create or replace function public.audit_log_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' and current_setting('heeey.audit_purge', true) = 'on' then
    return old;
  end if;
  raise exception 'A trilha de auditoria é somente inserção.';
end;
$$;

drop trigger if exists audit_log_immutable on public.audit_log;
create trigger audit_log_immutable
  before update or delete on public.audit_log
  for each row
  execute function public.audit_log_immutable();

-- 2. Eventos dos quadros
create or replace function public.audit_board_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
begin
  if tg_op = 'INSERT' then
    insert into public.audit_log (actor_id, action, entity, entity_id, details)
    values (v_actor, 'board.created', 'board', new.id,
      jsonb_build_object('owner_id', new.owner_id, 'access_level', new.access_level));
    return new;
  end if;

  if tg_op = 'DELETE' then
    insert into public.audit_log (actor_id, action, entity, entity_id, details)
    values (
      v_actor,
      case when current_setting('heeey.audit_purge', true) = 'on' then 'board.purged' else 'board.deleted' end,
      'board', old.id,
      jsonb_build_object('owner_id', old.owner_id, 'trashed_at', old.deleted_at)
    );
    return old;
  end if;

  if old.owner_id is null and new.owner_id is not null then
    insert into public.audit_log (actor_id, action, entity, entity_id, details)
    values (v_actor, 'board.claimed', 'board', new.id, jsonb_build_object('owner_id', new.owner_id));
  end if;
  if old.access_level is distinct from new.access_level then
    insert into public.audit_log (actor_id, action, entity, entity_id, details)
    values (v_actor, 'board.access_changed', 'board', new.id,
      jsonb_build_object('from', old.access_level, 'to', new.access_level));
  end if;
  if old.deleted_at is null and new.deleted_at is not null then
    insert into public.audit_log (actor_id, action, entity, entity_id)
    values (v_actor, 'board.trashed', 'board', new.id);
  elsif old.deleted_at is not null and new.deleted_at is null then
    insert into public.audit_log (actor_id, action, entity, entity_id)
    values (v_actor, 'board.restored', 'board', new.id);
  end if;
  return new;
end;
$$;

revoke all on function public.audit_board_change() from public, anon, authenticated;

drop trigger if exists audit_boards_insert_delete on public.boards;
create trigger audit_boards_insert_delete
  after insert or delete on public.boards
  for each row
  execute function public.audit_board_change();

-- O auto-save atualiza o quadro o tempo todo: o gatilho só dispara nas mudanças auditadas
drop trigger if exists audit_boards_update on public.boards;
create trigger audit_boards_update
  after update on public.boards
  for each row
  when (
    (old.owner_id is null and new.owner_id is not null)
    or old.access_level is distinct from new.access_level
    or (old.deleted_at is null) <> (new.deleted_at is null)
  )
  execute function public.audit_board_change();

-- 3. Eventos das chaves de API (o uso, last_used_at, não é registrado)
create or replace function public.audit_api_key_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.audit_log (actor_id, action, entity, entity_id, details)
    values (auth.uid(), 'api_key.created', 'api_key', new.id,
      jsonb_build_object('user_id', new.user_id, 'prefix', new.prefix, 'scopes', new.scopes));
  else
    insert into public.audit_log (actor_id, action, entity, entity_id, details)
    values (auth.uid(), 'api_key.revoked', 'api_key', new.id,
      jsonb_build_object('user_id', new.user_id, 'prefix', new.prefix));
  end if;
  return new;
end;
$$;

revoke all on function public.audit_api_key_change() from public, anon, authenticated;

drop trigger if exists audit_api_keys_insert on public.api_keys;
create trigger audit_api_keys_insert
  after insert on public.api_keys
  for each row
  execute function public.audit_api_key_change();

drop trigger if exists audit_api_keys_revoke on public.api_keys;
create trigger audit_api_keys_revoke
  after update on public.api_keys
  for each row
  when (old.revoked_at is null and new.revoked_at is not null)
  execute function public.audit_api_key_change();

-- 4. Retenção: lixeira por 30 dias, auditoria por 1 ano.
--    Chamada diariamente pelo Vercel Cron (api/cron/purge.ts) com a service_role, que em
--    seguida apaga as imagens dos quadros devolvidos pela API do Storage (o SQL não pode).
drop function if exists public.purge_expired_data(interval, interval);
create function public.purge_expired_data(
  p_trash_retention interval default interval '30 days',
  p_audit_retention interval default interval '1 year'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_boards uuid[];
  v_events integer;
begin
  perform set_config('heeey.audit_purge', 'on', true);

  with purged as (
    delete from public.boards b
    where b.deleted_at is not null
      and b.deleted_at < timezone('utc'::text, now()) - p_trash_retention
    returning b.id
  )
  select coalesce(array_agg(id), '{}') into v_boards from purged;

  delete from public.audit_log a
  where a.occurred_at < timezone('utc'::text, now()) - p_audit_retention;
  get diagnostics v_events = row_count;

  perform set_config('heeey.audit_purge', 'off', true);
  return jsonb_build_object('purged_board_ids', to_jsonb(v_boards), 'audit_events_purged', v_events);
end;
$$;

revoke all on function public.purge_expired_data(interval, interval) from public, anon, authenticated;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.purge_expired_data(interval, interval) to service_role;
  end if;
end;
$$;
