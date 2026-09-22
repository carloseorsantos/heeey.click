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

-- 3. Função e trigger para atualização automática de updated_at
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_boards_updated_at on public.boards;
create trigger set_boards_updated_at
  before update on public.boards
  for each row
  execute function public.handle_updated_at();

-- 4. Habilitação de Row Level Security (RLS)
alter table public.boards enable row level security;

-- 5. Políticas de Segurança (RLS)

-- Leitura pública: qualquer pessoa com o link do quadro pode visualizá-lo
drop policy if exists "Permitir leitura pública dos quadros" on public.boards;
create policy "Permitir leitura pública dos quadros"
  on public.boards
  for select
  using (true);

-- Criação pública: anônimos e usuários autenticados podem criar quadros
drop policy if exists "Permitir criação pública de quadros" on public.boards;
create policy "Permitir criação pública de quadros"
  on public.boards
  for insert
  with check (true);

-- Atualização: permitida se for o proprietário OU se o quadro estiver com access_level = 'edit'
drop policy if exists "Permitir atualização por proprietário ou em quadros editáveis" on public.boards;
create policy "Permitir atualização por proprietário ou em quadros editáveis"
  on public.boards
  for update
  using (
    auth.uid() = owner_id 
    or access_level = 'edit'
    or (owner_id is null and access_level = 'edit')
  )
  with check (
    auth.uid() = owner_id 
    or access_level = 'edit'
    or (owner_id is null and access_level = 'edit')
  );

-- Exclusão: permitida apenas ao proprietário do quadro
drop policy if exists "Permitir exclusão apenas pelo proprietário" on public.boards;
create policy "Permitir exclusão apenas pelo proprietário"
  on public.boards
  for delete
  using (auth.uid() = owner_id);

-- 6. Habilitar Supabase Realtime para a tabela boards (opcional para tracking de DB)
alter publication supabase_realtime add table public.boards;
