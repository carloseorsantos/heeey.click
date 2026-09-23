-- ==============================================================================
-- Miniaturas leves dos quadros para o dashboard (evita baixar a cena inteira)
-- ==============================================================================

-- 1. Prévia WebP em data URL (~5–30 KB); '' = quadro vazio, null = ainda não gerada
alter table public.boards add column if not exists thumbnail text;

-- 2. Atualizar só a miniatura não altera updated_at (não é uma edição do quadro)
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
  -- Mover para a lixeira, restaurar ou atualizar a miniatura não conta como edição
  if (to_jsonb(new) - 'deleted_at' - 'updated_at' - 'thumbnail')
     = (to_jsonb(old) - 'deleted_at' - 'updated_at' - 'thumbnail') then
    new.updated_at = old.updated_at;
  else
    new.updated_at = timezone('utc'::text, now());
  end if;
  return new;
end;
$$;
