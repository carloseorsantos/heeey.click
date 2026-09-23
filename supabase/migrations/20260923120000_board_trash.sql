-- ==============================================================================
-- Lixeira (soft delete) de quadros + correção das políticas de exclusão
-- Aplicar em bancos existentes (SQL Editor ou `supabase db push`).
-- Instalações novas já recebem tudo isso via schema.sql e storage.sql.
-- ==============================================================================

-- 1. Coluna de arquivamento: quadros com deleted_at preenchido estão na lixeira
alter table public.boards add column if not exists deleted_at timestamptz;

-- Suporte à limpeza futura de itens antigos da lixeira
create index if not exists idx_boards_deleted_at
  on public.boards(deleted_at)
  where deleted_at is not null;

-- 2. Trigger de integridade com as regras da lixeira
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
  -- Mover para a lixeira ou restaurar não conta como edição
  if (to_jsonb(new) - 'deleted_at' - 'updated_at') = (to_jsonb(old) - 'deleted_at' - 'updated_at') then
    new.updated_at = old.updated_at;
  else
    new.updated_at = timezone('utc'::text, now());
  end if;
  return new;
end;
$$;

-- 3. Exclusão definitiva: somente o proprietário autenticado.
-- Antes, qualquer pessoa podia apagar quadros anônimos (owner_id nulo).
-- Quadros anônimos agora só vão para a lixeira; ao entrar na conta, o criador os reivindica.
drop policy if exists "Permitir exclusão apenas pelo proprietário" on public.boards;
drop policy if exists "Permitir exclusão por proprietário ou quadros anônimos" on public.boards;
create policy "Permitir exclusão apenas pelo proprietário"
  on public.boards
  for delete
  using (auth.uid() is not null and auth.uid() = owner_id);

-- 4. Imagens do board-media: mesma regra de exclusão (somente o proprietário do quadro)
drop policy if exists "Permitir exclusão de imagens no board-media" on storage.objects;
create policy "Permitir exclusão de imagens no board-media"
  on storage.objects
  for delete
  using (
    bucket_id = 'board-media'
    and exists (
      select 1 from public.boards b
      where b.id::text = split_part(name, '/', 1)
        and auth.uid() is not null
        and b.owner_id = auth.uid()
    )
  );
