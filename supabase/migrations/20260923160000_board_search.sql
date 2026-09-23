-- ==============================================================================
-- Busca de texto completo nos quadros (título + textos do canvas), sem acentos
-- ==============================================================================

create extension if not exists unaccent with schema extensions;

-- 1. Texto pesquisável de um quadro: textos visíveis do canvas (inclui rótulos de formas)
create or replace function public.board_plain_text(p_elements jsonb)
returns text
language sql
immutable
set search_path = ''
as $$
  select coalesce(string_agg(e->>'text', ' '), '')
  from jsonb_array_elements(coalesce(p_elements, '[]'::jsonb)) e
  where e->>'type' = 'text'
    and coalesce((e->>'isDeleted')::boolean, false) = false
    and coalesce(e->>'text', '') <> '';
$$;

-- 2. Vetor de busca: título com peso A, conteúdo com peso B
alter table public.boards add column if not exists search_vector tsvector;
create index if not exists idx_boards_search on public.boards using gin(search_vector);

create or replace function public.board_search_vector(p_title text, p_elements jsonb)
returns tsvector
language sql
stable
set search_path = ''
as $$
  select
    setweight(to_tsvector('simple', extensions.unaccent('extensions.unaccent'::regdictionary, lower(coalesce(p_title, '')))), 'A')
    || setweight(to_tsvector('simple', extensions.unaccent('extensions.unaccent'::regdictionary, lower(public.board_plain_text(p_elements)))), 'B');
$$;

create or replace function public.update_board_search_vector()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT'
     or new.title is distinct from old.title
     or new.elements is distinct from old.elements
     or new.search_vector is null then
    new.search_vector := public.board_search_vector(new.title, new.elements);
  end if;
  return new;
end;
$$;

drop trigger if exists update_board_search_vector on public.boards;
create trigger update_board_search_vector
  before insert or update on public.boards
  for each row
  execute function public.update_board_search_vector();

-- 3. Atualizar o índice não conta como edição do quadro
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
  -- Lixeira, pasta, miniatura e índice de busca não contam como edição
  if (to_jsonb(new) - 'deleted_at' - 'updated_at' - 'thumbnail' - 'folder_id' - 'search_vector')
     = (to_jsonb(old) - 'deleted_at' - 'updated_at' - 'thumbnail' - 'folder_id' - 'search_vector') then
    new.updated_at = old.updated_at;
  else
    new.updated_at = timezone('utc'::text, now());
  end if;
  return new;
end;
$$;

-- 4. Preencher o índice dos quadros existentes (não altera updated_at)
update public.boards
set search_vector = public.board_search_vector(title, elements)
where search_vector is null;

-- 5. Busca nos quadros do usuário autenticado (prefixo por palavra, sem acentos)
create or replace function public.search_boards(p_query text, p_limit integer default 20)
returns table (
  id uuid,
  title text,
  owner_id uuid,
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
    b.id,
    b.title,
    b.owner_id,
    b.folder_id,
    b.access_level,
    b.thumbnail,
    b.created_at,
    b.updated_at,
    left(public.board_plain_text(b.elements), 2000) as content,
    ts_rank(b.search_vector, q) as rank
  from public.boards b
  where b.owner_id = auth.uid()
    and b.deleted_at is null
    and b.search_vector @@ q
  order by rank desc, b.updated_at desc
  limit least(greatest(coalesce(p_limit, 20), 1), 50);
end;
$$;

grant execute on function public.search_boards(text, integer) to authenticated;
