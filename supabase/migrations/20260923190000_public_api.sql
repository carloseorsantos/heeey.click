-- ==============================================================================
-- API pública: funções chamadas pelo servidor da API (/api/v1) e pelo servidor MCP.
-- Cada função recebe a chave de API, age como o dono da chave e só alcança os
-- quadros e pastas desse usuário.
-- ==============================================================================

-- 1. Resumo de um quadro no formato da API
create or replace function public.api_board_summary(b public.boards)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'id', b.id,
    'title', b.title,
    'folder_id', b.folder_id,
    'access_level', b.access_level,
    'created_at', b.created_at,
    'updated_at', b.updated_at,
    'deleted_at', b.deleted_at,
    'element_count', (
      select count(*) from jsonb_array_elements(b.elements) e
      where coalesce((e->>'isDeleted')::boolean, false) = false
    )
  );
$$;

-- 2. Avisa quem está com o quadro aberto (mesmo canal do app); falhas não impedem a gravação
create or replace function public.api_broadcast_elements(p_board_id uuid, p_elements jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_elements is null or jsonb_array_length(p_elements) = 0 then
    return;
  end if;
  begin
    perform realtime.send(
      jsonb_build_object(
        'type', 'canvas-update',
        'boardId', p_board_id,
        'elements', p_elements,
        'senderId', 'api',
        'timestamp', (extract(epoch from clock_timestamp()) * 1000)::bigint
      ),
      'canvas-update',
      'heeey:room:' || p_board_id::text,
      false
    );
  exception when others then
    null;
  end;
end;
$$;

-- 3. Validação básica dos elementos enviados pela API
create or replace function public.api_check_elements(p_elements jsonb)
returns void
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_elements is null then
    return;
  end if;
  if jsonb_typeof(p_elements) <> 'array' then
    raise exception 'elements deve ser uma lista.' using errcode = '22023';
  end if;
  if jsonb_array_length(p_elements) > 5000 then
    raise exception 'No máximo 5000 elementos por chamada.' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_elements) e
    where jsonb_typeof(e) <> 'object'
      or coalesce(e->>'id', '') = ''
      or coalesce(e->>'type', '') = ''
  ) then
    raise exception 'Cada elemento precisa de id e type.' using errcode = '22023';
  end if;
end;
$$;

-- 4. Quadro do usuário (bloqueado para edição) ou erro 404
create or replace function public.api_own_board(p_user uuid, p_board_id uuid, p_for_update boolean default false)
returns public.boards
language plpgsql
security definer
set search_path = ''
as $$
declare
  b public.boards;
begin
  if p_for_update then
    select * into b from public.boards where id = p_board_id and owner_id = p_user for update;
  else
    select * into b from public.boards where id = p_board_id and owner_id = p_user;
  end if;
  if b.id is null then
    raise exception 'Quadro não encontrado.' using errcode = 'P0002';
  end if;
  return b;
end;
$$;

-- 5. Listar quadros
create or replace function public.api_list_boards(
  p_key text,
  p_folder_id uuid default null,
  p_include_trashed boolean default false,
  p_limit integer default 50,
  p_offset integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := public.api_authenticate(p_key, 'read');
begin
  return coalesce((
    select jsonb_agg(public.api_board_summary(b) order by b.updated_at desc)
    from (
      select * from public.boards b
      where b.owner_id = v_user
        and (p_folder_id is null or b.folder_id = p_folder_id)
        and (p_include_trashed or b.deleted_at is null)
      order by b.updated_at desc
      limit least(greatest(coalesce(p_limit, 50), 1), 200)
      offset greatest(coalesce(p_offset, 0), 0)
    ) b
  ), '[]'::jsonb);
end;
$$;

-- 6. Ler um quadro com a cena completa
create or replace function public.api_get_board(p_key text, p_board_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := public.api_authenticate(p_key, 'read');
  b public.boards := public.api_own_board(v_user, p_board_id);
begin
  return public.api_board_summary(b) || jsonb_build_object(
    'elements', (
      select coalesce(jsonb_agg(e), '[]'::jsonb) from jsonb_array_elements(b.elements) e
      where coalesce((e->>'isDeleted')::boolean, false) = false
    ),
    'app_state', b.app_state,
    'files', b.files
  );
end;
$$;

-- 7. Criar quadro
create or replace function public.api_create_board(
  p_key text,
  p_title text default null,
  p_elements jsonb default '[]'::jsonb,
  p_folder_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := public.api_authenticate(p_key, 'write');
  b public.boards;
begin
  perform public.api_check_elements(p_elements);
  insert into public.boards (title, owner_id, elements, folder_id)
  values (
    coalesce(nullif(btrim(p_title), ''), 'Quadro sem título'),
    v_user,
    coalesce(p_elements, '[]'::jsonb),
    p_folder_id
  )
  returning * into b;
  return public.api_board_summary(b);
end;
$$;

-- 8. Atualizar quadro: título, elementos novos ou alterados (por id) e remoção de elementos.
--    Versões são incrementadas para que a mudança vença a reconciliação nos navegadores.
create or replace function public.api_update_board(
  p_key text,
  p_board_id uuid,
  p_title text default null,
  p_elements jsonb default null,
  p_delete_element_ids text[] default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := public.api_authenticate(p_key, 'write');
  b public.boards := public.api_own_board(v_user, p_board_id, true);
  v_now bigint := (extract(epoch from clock_timestamp()) * 1000)::bigint;
  v_merged jsonb;
  v_changed jsonb;
begin
  perform public.api_check_elements(p_elements);

  with current_elements as (
    select e, e->>'id' as id, ord
    from jsonb_array_elements(b.elements) with ordinality t(e, ord)
  ),
  incoming as (
    select distinct on (e->>'id') e, e->>'id' as id, ord
    from jsonb_array_elements(coalesce(p_elements, '[]'::jsonb)) with ordinality t(e, ord)
    order by e->>'id', ord desc
  ),
  bump as (
    -- New or updated elements from the request
    select
      i.id,
      coalesce(c.ord, 1000000 + i.ord) as ord,
      i.e || jsonb_build_object(
        'version', greatest(coalesce((c.e->>'version')::bigint, 0), coalesce((i.e->>'version')::bigint, 0)) + 1,
        'versionNonce', floor(random() * 2147483647)::bigint,
        'updated', v_now,
        'isDeleted', coalesce((i.e->>'isDeleted')::boolean, false)
      ) as e,
      true as changed
    from incoming i
    left join current_elements c on c.id = i.id
    union all
    -- Removed elements become tombstones
    select
      c.id,
      c.ord,
      c.e || jsonb_build_object(
        'isDeleted', true,
        'version', coalesce((c.e->>'version')::bigint, 0) + 1,
        'versionNonce', floor(random() * 2147483647)::bigint,
        'updated', v_now
      ),
      true
    from current_elements c
    where c.id = any(coalesce(p_delete_element_ids, array[]::text[]))
      and not exists (select 1 from incoming i where i.id = c.id)
      and coalesce((c.e->>'isDeleted')::boolean, false) = false
    union all
    -- Untouched elements
    select c.id, c.ord, c.e, false
    from current_elements c
    where not exists (select 1 from incoming i where i.id = c.id)
      and not (
        c.id = any(coalesce(p_delete_element_ids, array[]::text[]))
        and coalesce((c.e->>'isDeleted')::boolean, false) = false
      )
  )
  select
    coalesce(jsonb_agg(e order by ord), '[]'::jsonb),
    coalesce(jsonb_agg(e order by ord) filter (where changed), '[]'::jsonb)
  into v_merged, v_changed
  from bump;

  update public.boards
  set
    title = coalesce(nullif(btrim(p_title), ''), title),
    elements = v_merged
  where id = b.id
  returning * into b;

  perform public.api_broadcast_elements(b.id, v_changed);
  return public.api_board_summary(b);
end;
$$;

-- 9. Mover para a lixeira (reversível pelo app)
create or replace function public.api_trash_board(p_key text, p_board_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := public.api_authenticate(p_key, 'write');
  b public.boards := public.api_own_board(v_user, p_board_id, true);
begin
  update public.boards set deleted_at = timezone('utc'::text, now())
  where id = b.id and deleted_at is null
  returning * into b;
  return public.api_board_summary(coalesce(b, public.api_own_board(v_user, p_board_id)));
end;
$$;

-- 10. Mover entre pastas (null = raiz)
create or replace function public.api_move_board(p_key text, p_board_id uuid, p_folder_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := public.api_authenticate(p_key, 'write');
  b public.boards := public.api_own_board(v_user, p_board_id, true);
begin
  update public.boards set folder_id = p_folder_id where id = b.id returning * into b;
  return public.api_board_summary(b);
end;
$$;

-- 11. Busca em título e conteúdo
create or replace function public.api_search_boards(p_key text, p_query text, p_limit integer default 20)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := public.api_authenticate(p_key, 'read');
begin
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', s.id,
      'title', s.title,
      'folder_id', s.folder_id,
      'updated_at', s.updated_at,
      'text', left(s.content, 500)
    ) order by s.rank desc)
    from public.search_boards(p_query, p_limit) s
  ), '[]'::jsonb);
end;
$$;

-- 12. Pastas
create or replace function public.api_list_folders(p_key text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := public.api_authenticate(p_key, 'read');
begin
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', f.id, 'name', f.name, 'parent_id', f.parent_id) order by f.name)
    from public.folders f where f.owner_id = v_user
  ), '[]'::jsonb);
end;
$$;

create or replace function public.api_create_folder(p_key text, p_name text, p_parent_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := public.api_authenticate(p_key, 'write');
  f public.folders;
begin
  insert into public.folders (owner_id, name, parent_id)
  values (v_user, btrim(p_name), p_parent_id)
  returning * into f;
  return jsonb_build_object('id', f.id, 'name', f.name, 'parent_id', f.parent_id);
end;
$$;

-- 13. Permissões: helpers internos fechados; funções da API abertas (a chave é a credencial)
revoke all on function public.api_board_summary(public.boards) from public, anon, authenticated;
revoke all on function public.api_broadcast_elements(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.api_check_elements(jsonb) from public, anon, authenticated;
revoke all on function public.api_own_board(uuid, uuid, boolean) from public, anon, authenticated;

grant execute on function public.api_list_boards(text, uuid, boolean, integer, integer) to anon, authenticated;
grant execute on function public.api_get_board(text, uuid) to anon, authenticated;
grant execute on function public.api_create_board(text, text, jsonb, uuid) to anon, authenticated;
grant execute on function public.api_update_board(text, uuid, text, jsonb, text[]) to anon, authenticated;
grant execute on function public.api_trash_board(text, uuid) to anon, authenticated;
grant execute on function public.api_move_board(text, uuid, uuid) to anon, authenticated;
grant execute on function public.api_search_boards(text, text, integer) to anon, authenticated;
grant execute on function public.api_list_folders(text) to anon, authenticated;
grant execute on function public.api_create_folder(text, text, uuid) to anon, authenticated;
