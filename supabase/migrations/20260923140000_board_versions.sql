-- ==============================================================================
-- Histórico de versões dos quadros
-- Snapshots automáticos (no máximo 1 a cada 10 min de edição) + snapshot antes de restaurar.
-- Retenção: 30 versões mais recentes por quadro, por até 30 dias.
-- ==============================================================================

-- 1. Tabela de versões
create table if not exists public.board_versions (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards(id) on delete cascade,
  title text not null,
  elements jsonb not null default '[]'::jsonb,
  app_state jsonb not null default '{}'::jsonb,
  files jsonb not null default '{}'::jsonb,
  thumbnail text,
  element_count integer not null default 0,
  reason text not null default 'auto' check (reason in ('auto', 'before_restore')),
  -- Momento em que este estado do quadro foi salvo (exibido no histórico)
  created_at timestamptz not null default timezone('utc'::text, now()),
  -- Momento em que a versão entrou no histórico (usado no intervalo e na retenção)
  inserted_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists idx_board_versions_board_created
  on public.board_versions(board_id, created_at desc);
create index if not exists idx_board_versions_board_inserted
  on public.board_versions(board_id, inserted_at desc);

-- 2. RLS: quem pode editar o quadro pode ver o histórico; escrita só pelo servidor
alter table public.board_versions enable row level security;

drop policy if exists "Permitir leitura do histórico a quem edita o quadro" on public.board_versions;
create policy "Permitir leitura do histórico a quem edita o quadro"
  on public.board_versions
  for select
  using (
    exists (
      select 1 from public.boards b
      where b.id = board_versions.board_id
        and (
          (auth.uid() is not null and b.owner_id = auth.uid())
          or b.access_level = 'edit'
        )
    )
  );

-- 3. Função interna: grava um estado do quadro no histórico e aplica a retenção
create or replace function public.insert_board_version(
  p_board public.boards,
  p_reason text,
  p_created_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.board_versions (board_id, title, elements, app_state, files, thumbnail, element_count, reason, created_at)
  values (
    p_board.id,
    p_board.title,
    p_board.elements,
    p_board.app_state,
    p_board.files,
    p_board.thumbnail,
    (
      select count(*)::integer
      from jsonb_array_elements(p_board.elements) e
      where coalesce((e->>'isDeleted')::boolean, false) = false
    ),
    p_reason,
    p_created_at
  );

  delete from public.board_versions v
  where v.board_id = p_board.id
    and (
      v.inserted_at < timezone('utc'::text, now()) - interval '30 days'
      or v.id in (
        select v2.id from public.board_versions v2
        where v2.board_id = p_board.id
        order by v2.inserted_at desc
        offset 30
      )
    );
end;
$$;

revoke all on function public.insert_board_version(public.boards, text, timestamptz) from public, anon, authenticated;

-- 4. Snapshot automático: ao salvar mudanças na cena, guarda o estado anterior
--    se a última versão tiver mais de 10 minutos
create or replace function public.snapshot_board_version()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  last_version_at timestamptz;
begin
  if old.elements is not distinct from new.elements then
    return new;
  end if;
  -- Quadro sem conteúdo não gera versão
  if jsonb_array_length(old.elements) = 0 then
    return new;
  end if;

  select max(v.inserted_at) into last_version_at
  from public.board_versions v
  where v.board_id = old.id;

  if last_version_at is null or last_version_at < timezone('utc'::text, now()) - interval '10 minutes' then
    perform public.insert_board_version(old, 'auto', old.updated_at);
  end if;
  return new;
end;
$$;

drop trigger if exists snapshot_board_version on public.boards;
create trigger snapshot_board_version
  after update of elements on public.boards
  for each row
  execute function public.snapshot_board_version();

-- 5. Snapshot sob demanda (antes de restaurar uma versão), para que a restauração possa ser desfeita
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
  if not ((auth.uid() is not null and target.owner_id = auth.uid()) or target.access_level = 'edit') then
    raise exception 'Sem permissão para salvar versões deste quadro.';
  end if;

  perform public.insert_board_version(target, 'before_restore', timezone('utc'::text, now()));
end;
$$;

grant execute on function public.snapshot_board(uuid) to anon, authenticated;
