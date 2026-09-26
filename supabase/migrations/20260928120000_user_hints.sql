-- ==============================================================================
-- Dicas na lousa (ex.: balão "Exportar para IA"): o que cada pessoa logada já viu,
-- dispensou ou usou, para a dica aparecer no máximo uma vez por dia e parar de vez.
-- Convidados guardam o mesmo estado só no navegador (localStorage).
--
-- A tabela é genérica (uma linha por hint_key), então dicas novas não pedem migration.
-- O cliente só lê as próprias linhas; as escritas passam pelas funções abaixo, que
-- gravam os horários e contam os dias pelo servidor.
-- ==============================================================================

create table if not exists public.user_hints (
  user_id uuid not null references auth.users(id) on delete cascade,
  hint_key text not null check (hint_key ~ '^[a-z0-9-]{1,64}$'),
  -- Dias diferentes (no fuso da pessoa) em que a dica apareceu; o cliente decide por
  -- shown_days e last_shown_day (um estado importado do convidado não tem os horários)
  shown_days integer not null default 0 check (shown_days between 0 and 366),
  last_shown_day date,
  first_shown_at timestamptz,
  last_shown_at timestamptz,
  dismissed_at timestamptz,
  used_at timestamptz,
  updated_at timestamptz not null default timezone('utc'::text, now()),
  primary key (user_id, hint_key)
);

alter table public.user_hints enable row level security;

-- Escrita só pelas funções abaixo
revoke all on public.user_hints from anon, authenticated;
grant select on public.user_hints to authenticated;

drop policy if exists "Dicas visíveis apenas para o dono" on public.user_hints;
create policy "Dicas visíveis apenas para o dono"
  on public.user_hints for select
  using (auth.uid() is not null and user_id = auth.uid());

-- ------------------------------------------------------------------------------
-- Auxiliares (uso interno das funções abaixo)
-- ------------------------------------------------------------------------------
create or replace function public.check_hint_key(p_hint_key text)
returns void
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_hint_key is null or p_hint_key !~ '^[a-z0-9-]{1,64}$' then
    raise exception 'Chave de dica inválida.' using errcode = '22023';
  end if;
end;
$$;

-- Dia de hoje no fuso informado pelo navegador. Fuso inválido vale UTC, e o resultado fica
-- entre ontem e amanhã em UTC (os fusos reais vão de UTC-12 a UTC+14). Trocar de fuso de
-- propósito só faz a dica sumir mais cedo para a própria pessoa.
create or replace function public.hint_local_day(p_tz text)
returns date
language plpgsql
stable
set search_path = ''
as $$
declare
  v_utc date := (now() at time zone 'UTC')::date;
  v_day date;
begin
  if p_tz is null or char_length(p_tz) > 64 or p_tz !~ '^[A-Za-z][A-Za-z0-9_+-]*(/[A-Za-z0-9_+-]+)*$' then
    return v_utc;
  end if;
  v_day := (now() at time zone p_tz)::date;
  return least(greatest(v_day, v_utc - 1), v_utc + 1);
exception when others then
  return v_utc;
end;
$$;

-- Evita que uma conta crie linhas sem limite com chaves inventadas. O lock por usuário
-- impede que chamadas simultâneas passem juntas pela contagem.
create or replace function public.check_hint_limit(p_user uuid, p_hint_key text)
returns void
language plpgsql
volatile
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtext('user_hints:' || p_user::text));
  if not exists (select 1 from public.user_hints h where h.user_id = p_user and h.hint_key = p_hint_key)
     and (select count(*) from public.user_hints h where h.user_id = p_user) >= 50 then
    raise exception 'Limite de dicas atingido.' using errcode = '22023';
  end if;
end;
$$;

create or replace function public.hint_json(p_user uuid, p_hint_key text)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'hint_key', h.hint_key,
    'shown_days', h.shown_days,
    'last_shown_day', h.last_shown_day,
    'first_shown_at', h.first_shown_at,
    'last_shown_at', h.last_shown_at,
    'dismissed_at', h.dismissed_at,
    'used_at', h.used_at
  )
  from public.user_hints h where h.user_id = p_user and h.hint_key = p_hint_key;
$$;

revoke all on function public.check_hint_key(text) from public, anon, authenticated;
revoke all on function public.hint_local_day(text) from public, anon, authenticated;
revoke all on function public.check_hint_limit(uuid, text) from public, anon, authenticated;
revoke all on function public.hint_json(uuid, text) from public, anon, authenticated;

-- ------------------------------------------------------------------------------
-- Registrar um evento da dica: shown (apareceu), dismissed (fechou no X) ou used (usou a função)
-- ------------------------------------------------------------------------------
create or replace function public.record_hint_event(p_hint_key text, p_event text, p_tz text default 'UTC')
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := public.require_user();
  v_day date := public.hint_local_day(p_tz);
  v_shown boolean := p_event = 'shown';
begin
  perform public.check_hint_key(p_hint_key);
  if p_event is null or p_event not in ('shown', 'dismissed', 'used') then
    raise exception 'Evento de dica inválido.' using errcode = '22023';
  end if;
  perform public.check_hint_limit(v_user, p_hint_key);

  -- Um dia só conta se for depois do último registrado, então voltar o fuso não conta de novo
  insert into public.user_hints as h
    (user_id, hint_key, shown_days, last_shown_day, first_shown_at, last_shown_at, dismissed_at, used_at)
  values (
    v_user, p_hint_key,
    case when v_shown then 1 else 0 end,
    case when v_shown then v_day end,
    case when v_shown then now() end,
    case when v_shown then now() end,
    case when p_event = 'dismissed' then now() end,
    case when p_event = 'used' then now() end
  )
  on conflict (user_id, hint_key) do update set
    shown_days = case
      when v_shown and (h.last_shown_day is null or v_day > h.last_shown_day)
      then least(h.shown_days + 1, 366) else h.shown_days end,
    last_shown_day = case
      when v_shown and (h.last_shown_day is null or v_day > h.last_shown_day)
      then v_day else h.last_shown_day end,
    first_shown_at = case when v_shown then coalesce(h.first_shown_at, now()) else h.first_shown_at end,
    last_shown_at = case when v_shown then now() else h.last_shown_at end,
    dismissed_at = coalesce(h.dismissed_at, excluded.dismissed_at),
    used_at = coalesce(h.used_at, excluded.used_at),
    updated_at = now();

  return public.hint_json(v_user, p_hint_key);
end;
$$;

-- ------------------------------------------------------------------------------
-- Levar para a conta o estado que o convidado tinha neste navegador (no login).
-- Sem registro na conta, o estado do convidado entra inteiro. Com registro, só "dispensou" e
-- "usou" são somados, para a dica não voltar para quem já a encerrou; o contador fica o da conta.
-- Os valores vêm do navegador, então são limitados.
-- ------------------------------------------------------------------------------
create or replace function public.import_guest_hint(
  p_hint_key text,
  p_shown_days integer default 0,
  p_last_shown_day date default null,
  p_dismissed boolean default false,
  p_used boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := public.require_user();
  v_shown integer := least(greatest(coalesce(p_shown_days, 0), 0), 366);
  -- Um dia à frente de UTC ainda é "hoje" em algum fuso; fora do intervalo, é descartado
  v_last date := case
    when p_last_shown_day between date '2020-01-01' and (now() at time zone 'UTC')::date + 1
    then p_last_shown_day end;
  v_dismissed boolean := coalesce(p_dismissed, false);
  v_used boolean := coalesce(p_used, false);
begin
  perform public.check_hint_key(p_hint_key);
  -- Nada para levar
  if v_shown = 0 and v_last is null and not v_dismissed and not v_used then
    return public.hint_json(v_user, p_hint_key);
  end if;
  perform public.check_hint_limit(v_user, p_hint_key);

  insert into public.user_hints as h (user_id, hint_key, shown_days, last_shown_day, dismissed_at, used_at)
  values (
    v_user, p_hint_key, v_shown, v_last,
    case when v_dismissed then now() end,
    case when v_used then now() end
  )
  on conflict (user_id, hint_key) do update set
    dismissed_at = coalesce(h.dismissed_at, excluded.dismissed_at),
    used_at = coalesce(h.used_at, excluded.used_at),
    updated_at = case
      when (h.dismissed_at is null and excluded.dismissed_at is not null)
        or (h.used_at is null and excluded.used_at is not null)
      then now() else h.updated_at end;

  return public.hint_json(v_user, p_hint_key);
end;
$$;

revoke all on function public.record_hint_event(text, text, text) from public, anon;
grant execute on function public.record_hint_event(text, text, text) to authenticated;
revoke all on function public.import_guest_hint(text, integer, date, boolean, boolean) from public, anon;
grant execute on function public.import_guest_hint(text, integer, date, boolean, boolean) to authenticated;
