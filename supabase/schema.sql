-- ==============================================================================
-- Schema para o Heeey (heeey.click) — Lousa Interativa com Excalidraw e Multiplayer
-- Tabela: public.boards
-- ==============================================================================

-- 1. Criação da tabela boards
create table if not exists public.boards (
  id uuid primary key default gen_random_uuid(),
  title text not null default 'Quadro sem título',
  owner_id uuid references auth.users(id) on delete set null,
  elements jsonb not null default '[]'::jsonb,
  app_state jsonb not null default '{}'::jsonb,
  files jsonb not null default '{}'::jsonb,
  access_level text not null default 'edit' check (access_level in ('edit', 'view')),
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

-- 2. Índices de performance
create index if not exists idx_boards_owner_id on public.boards(owner_id);
create index if not exists idx_boards_updated_at on public.boards(updated_at desc);

-- 3. Função e trigger para atualização automática de updated_at e integridade de owner_id
create or replace function public.handle_board_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Impedir sequestro ou substituição de owner_id se o quadro já possui proprietário
  if old.owner_id is not null and new.owner_id is distinct from old.owner_id then
    raise exception 'Não é permitido alterar ou sequestrar o proprietário de um quadro já associado.';
  end if;
  -- Reivindicação de quadro anônimo: apenas o usuário autenticado atual pode se definir como proprietário
  if old.owner_id is null and new.owner_id is not null then
    if auth.uid() is null or new.owner_id != auth.uid() then
      raise exception 'Apenas o próprio usuário autenticado pode reivindicar a posse do quadro.';
    end if;
  end if;
  -- Integridade de access_level: apenas o proprietário pode alterar o nível de acesso
  if old.access_level is distinct from new.access_level then
    if old.owner_id is not null and (auth.uid() is null or auth.uid() != old.owner_id) then
      raise exception 'Apenas o proprietário do quadro pode alterar o nível de acesso.';
    end if;
    if old.owner_id is null and new.owner_id is null and new.access_level = 'view' then
      raise exception 'Um quadro anônimo sem proprietário não pode ser bloqueado como somente leitura.';
    end if;
  end if;
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$;

drop trigger if exists set_boards_updated_at on public.boards;
create trigger set_boards_updated_at
  before update on public.boards
  for each row
  execute function public.handle_board_update();

-- 4. Habilitação de Row Level Security (RLS)
alter table public.boards enable row level security;

-- 5. Políticas de Segurança (RLS)

-- Leitura pública: qualquer pessoa com o link do quadro pode visualizá-lo
drop policy if exists "Permitir leitura pública dos quadros" on public.boards;
create policy "Permitir leitura pública dos quadros"
  on public.boards
  for select
  using (true);

-- Criação pública e segura: anônimos criam com owner_id nulo; logados com seu próprio auth.uid()
drop policy if exists "Permitir criação pública de quadros" on public.boards;
create policy "Permitir criação pública de quadros"
  on public.boards
  for insert
  with check (
    -- Se anônimo, não permite forjar owner_id de terceiros
    (auth.uid() is null and owner_id is null)
    or
    -- Se autenticado, owner_id deve ser o próprio usuário ou null
    (auth.uid() is not null and (owner_id = auth.uid() or owner_id is null))
  );

-- Atualização: permitida ao proprietário OU se o quadro estiver com access_level = 'edit'
-- Protegido contra sequestro de propriedade (owner_id) e bloqueio não autorizado
drop policy if exists "Permitir atualização por proprietário ou em quadros editáveis" on public.boards;
create policy "Permitir atualização por proprietário ou em quadros editáveis"
  on public.boards
  for update
  using (
    (auth.uid() is not null and auth.uid() = owner_id)
    or access_level = 'edit'
    or (owner_id is null and access_level = 'edit')
  )
  with check (
    -- Permissão de escrita na nova linha: deve ser o proprietário OU permanecer editável
    (
      (auth.uid() is not null and auth.uid() = owner_id)
      or access_level = 'edit'
    )
    and
    (
      -- Se o quadro já tiver proprietário, o owner_id não pode ser alterado por terceiros
      (
        (select b.owner_id from public.boards b where b.id = boards.id) is not null
        and owner_id = (select b.owner_id from public.boards b where b.id = boards.id)
      )
      or
      -- Se o quadro for anônimo (owner_id is null), pode ser mantido null ou reivindicado pelo próprio usuário logado
      (
        (select b.owner_id from public.boards b where b.id = boards.id) is null
        and (
          owner_id is null 
          or (auth.uid() is not null and owner_id = auth.uid())
        )
      )
    )
  );

-- Exclusão: permitida ao proprietário autenticado OU para quadros anônimos (sem proprietário)
drop policy if exists "Permitir exclusão apenas pelo proprietário" on public.boards;
drop policy if exists "Permitir exclusão por proprietário ou quadros anônimos" on public.boards;
create policy "Permitir exclusão por proprietário ou quadros anônimos"
  on public.boards
  for delete
  using (
    (auth.uid() is not null and auth.uid() = owner_id)
    or (owner_id is null)
  );

-- 6. Habilitar Supabase Realtime para a tabela boards (opcional para tracking de DB)
alter publication supabase_realtime add table public.boards;
