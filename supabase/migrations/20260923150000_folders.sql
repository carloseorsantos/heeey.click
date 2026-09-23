-- ==============================================================================
-- Pastas (aninháveis) para organizar os quadros de cada usuário
-- ==============================================================================

-- 1. Tabela de pastas
create table if not exists public.folders (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  parent_id uuid references public.folders(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 100),
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists idx_folders_owner on public.folders(owner_id);
create index if not exists idx_folders_parent on public.folders(parent_id);

-- 2. Quadros apontam para uma pasta; ao excluir a pasta, os quadros voltam para a raiz
alter table public.boards add column if not exists folder_id uuid references public.folders(id) on delete set null;
create index if not exists idx_boards_folder on public.boards(folder_id);

-- 3. RLS de pastas: somente o dono
alter table public.folders enable row level security;

drop policy if exists "Pastas visíveis apenas para o dono" on public.folders;
create policy "Pastas visíveis apenas para o dono"
  on public.folders for select
  using (auth.uid() is not null and owner_id = auth.uid());

drop policy if exists "Pastas criadas apenas pelo dono" on public.folders;
create policy "Pastas criadas apenas pelo dono"
  on public.folders for insert
  with check (auth.uid() is not null and owner_id = auth.uid());

drop policy if exists "Pastas alteradas apenas pelo dono" on public.folders;
create policy "Pastas alteradas apenas pelo dono"
  on public.folders for update
  using (auth.uid() is not null and owner_id = auth.uid())
  with check (auth.uid() is not null and owner_id = auth.uid());

drop policy if exists "Pastas excluídas apenas pelo dono" on public.folders;
create policy "Pastas excluídas apenas pelo dono"
  on public.folders for delete
  using (auth.uid() is not null and owner_id = auth.uid());

-- 4. Integridade das pastas: pai do mesmo dono, sem ciclos, profundidade máxima 8
create or replace function public.check_folder_parent()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  cursor_id uuid := new.parent_id;
  depth integer := 0;
begin
  if tg_op = 'UPDATE' and new.owner_id is distinct from old.owner_id then
    raise exception 'Não é permitido transferir uma pasta para outro usuário.';
  end if;
  new.updated_at = timezone('utc'::text, now());

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
    where f.id = cursor_id and f.owner_id = new.owner_id;
    if not found then
      raise exception 'Pasta de destino não encontrada.';
    end if;
  end loop;
  return new;
end;
$$;

drop trigger if exists check_folder_parent on public.folders;
create trigger check_folder_parent
  before insert or update of parent_id, owner_id on public.folders
  for each row
  execute function public.check_folder_parent();

-- 5. Quadros só entram em pastas do próprio dono, e só o dono move quadros entre pastas
create or replace function public.check_board_folder()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.folder_id is not distinct from old.folder_id then
    return new;
  end if;
  if tg_op = 'UPDATE' and (auth.uid() is null or auth.uid() is distinct from new.owner_id) then
    raise exception 'Apenas o proprietário pode mover o quadro entre pastas.';
  end if;
  if new.folder_id is not null and not exists (
    select 1 from public.folders f
    where f.id = new.folder_id and f.owner_id = new.owner_id
  ) then
    raise exception 'Pasta de destino não encontrada.';
  end if;
  return new;
end;
$$;

drop trigger if exists check_board_folder on public.boards;
create trigger check_board_folder
  before insert or update of folder_id on public.boards
  for each row
  execute function public.check_board_folder();

-- 6. Mover um quadro de pasta não altera updated_at
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
  -- Lixeira: apenas o proprietário move ou restaura quadros que têm dono
  if new.deleted_at is distinct from old.deleted_at then
    if old.owner_id is not null and (auth.uid() is null or auth.uid() != old.owner_id) then
      raise exception 'Apenas o proprietário pode mover o quadro para a lixeira ou restaurá-lo.';
    end if;
    -- O horário do arquivamento vem do servidor, não do cliente
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
    or new.access_level is distinct from old.access_level
  ) then
    raise exception 'Quadro na lixeira é somente leitura. Restaure-o para editar.';
  end if;
  -- Mover para a lixeira, restaurar, mover de pasta ou atualizar a miniatura não conta como edição
  if (to_jsonb(new) - 'deleted_at' - 'updated_at' - 'thumbnail' - 'folder_id')
     = (to_jsonb(old) - 'deleted_at' - 'updated_at' - 'thumbnail' - 'folder_id') then
    new.updated_at = old.updated_at;
  else
    new.updated_at = timezone('utc'::text, now());
  end if;
  return new;
end;
$$;
