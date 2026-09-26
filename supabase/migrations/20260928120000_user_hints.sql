-- ==============================================================================
-- Dicas na lousa (ex.: balão "Exportar para IA"): o que cada pessoa logada já viu,
-- dispensou ou usou. Cada dica aparece uma vez só e depois não volta.
-- Convidados guardam o mesmo estado só no navegador (localStorage).
--
-- A tabela é genérica (uma linha por hint_key), então dicas novas não pedem migration.
-- O cliente só lê as próprias linhas; as escritas passam pela função abaixo, que grava
-- os horários pelo servidor.
-- ==============================================================================

create table if not exists public.user_hints (
  user_id uuid not null references auth.users(id) on delete cascade,
  hint_key text not null check (hint_key ~ '^[a-z0-9-]{1,64}$'),
  shown_at timestamptz,
  dismissed_at timestamptz,
  used_at timestamptz,
  updated_at timestamptz not null default timezone('utc'::text, now()),
  primary key (user_id, hint_key)
);

alter table public.user_hints enable row level security;

-- Escrita só pela função abaixo
revoke all on public.user_hints from anon, authenticated;
grant select on public.user_hints to authenticated;

drop policy if exists "Dicas visíveis apenas para o dono" on public.user_hints;
create policy "Dicas visíveis apenas para o dono"
  on public.user_hints for select
  using (auth.uid() is not null and user_id = auth.uid());

-- ------------------------------------------------------------------------------
-- Registrar um evento da dica: shown (apareceu), dismissed (fechou no X) ou used (usou a função).
-- Cada horário é gravado uma vez e não muda. Também leva para a conta, no login, o que o
-- convidado tinha neste navegador (o cliente manda um evento para cada coisa que falta).
-- ------------------------------------------------------------------------------
create or replace function public.record_hint_event(p_hint_key text, p_event text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := public.require_user();
  v_row public.user_hints;
begin
  if p_hint_key is null or p_hint_key !~ '^[a-z0-9-]{1,64}$' then
    raise exception 'Chave de dica inválida.' using errcode = '22023';
  end if;
  if p_event is null or p_event not in ('shown', 'dismissed', 'used') then
    raise exception 'Evento de dica inválido.' using errcode = '22023';
  end if;

  -- Evita que uma conta crie linhas sem limite com chaves inventadas. O lock por usuário
  -- impede que chamadas simultâneas passem juntas pela contagem.
  perform pg_advisory_xact_lock(hashtext('user_hints:' || v_user::text));
  if not exists (select 1 from public.user_hints h where h.user_id = v_user and h.hint_key = p_hint_key)
     and (select count(*) from public.user_hints h where h.user_id = v_user) >= 50 then
    raise exception 'Limite de dicas atingido.' using errcode = '22023';
  end if;

  insert into public.user_hints as h (user_id, hint_key, shown_at, dismissed_at, used_at)
  values (
    v_user, p_hint_key,
    case when p_event = 'shown' then now() end,
    case when p_event = 'dismissed' then now() end,
    case when p_event = 'used' then now() end
  )
  on conflict (user_id, hint_key) do update set
    shown_at = coalesce(h.shown_at, excluded.shown_at),
    dismissed_at = coalesce(h.dismissed_at, excluded.dismissed_at),
    used_at = coalesce(h.used_at, excluded.used_at),
    updated_at = now()
  returning * into v_row;

  return jsonb_build_object(
    'hint_key', v_row.hint_key,
    'shown_at', v_row.shown_at,
    'dismissed_at', v_row.dismissed_at,
    'used_at', v_row.used_at
  );
end;
$$;

revoke all on function public.record_hint_event(text, text) from public, anon;
grant execute on function public.record_hint_event(text, text) to authenticated;
