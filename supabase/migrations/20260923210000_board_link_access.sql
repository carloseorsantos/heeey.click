-- ==============================================================================
-- Quadros compartilhados por link sem permitir listar a tabela inteira
-- ==============================================================================
-- Antes, a leitura de public.boards era `using (true)`: com a chave anon (pública,
-- presente no JavaScript do site) qualquer pessoa fazia `GET /rest/v1/boards?select=*`
-- e baixava todos os quadros de todos os usuários. O segredo de um quadro compartilhado
-- é o seu id (o link); agora só lê a linha quem é o dono ou quem informa esse id no
-- cabeçalho `x-board-id` da requisição (o app faz isso ao abrir um quadro pelo link).
--
-- O bucket board-media também deixava listar todos os objetos, o que revelava os ids
-- de todos os quadros (a primeira pasta de cada caminho). O bucket é público, então as
-- imagens continuam acessíveis pela URL pública sem política de leitura.

-- 1. Id do quadro pedido pelo cliente (cabeçalho repassado pelo PostgREST)
create or replace function public.requested_board_id()
returns uuid
language plpgsql
stable
set search_path = ''
as $$
begin
  return (nullif(current_setting('request.headers', true), '')::json ->> 'x-board-id')::uuid;
exception when others then
  return null;
end;
$$;

grant execute on function public.requested_board_id() to anon, authenticated;

-- 2. Permissão do usuário atual sobre um quadro, sem depender do RLS de boards:
--    'owner' | 'edit' | 'view', ou null quando o quadro não existe.
--    Usada pelas políticas de storage e do histórico, que não recebem o cabeçalho.
create or replace function public.board_permission(p_board_id text)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_owner uuid;
  v_access text;
begin
  select b.owner_id, b.access_level into v_owner, v_access
  from public.boards b
  where b.id = p_board_id::uuid;
  if not found then
    return null;
  end if;
  if auth.uid() is not null and v_owner = auth.uid() then
    return 'owner';
  end if;
  return v_access;
exception when invalid_text_representation then
  return null;
end;
$$;

revoke execute on function public.board_permission(text) from public;
grant execute on function public.board_permission(text) to anon, authenticated;

-- 3. Leitura de quadros: dono, ou quem abriu o quadro pelo link
drop policy if exists "Permitir leitura pública dos quadros" on public.boards;
drop policy if exists "Permitir leitura pelo dono ou pelo link do quadro" on public.boards;
create policy "Permitir leitura pelo dono ou pelo link do quadro"
  on public.boards
  for select
  using (
    (auth.uid() is not null and owner_id = auth.uid())
    or id = public.requested_board_id()
  );

-- 4. Histórico: mesma regra de antes (quem edita o quadro), sem depender do cabeçalho
drop policy if exists "Permitir leitura do histórico a quem edita o quadro" on public.board_versions;
create policy "Permitir leitura do histórico a quem edita o quadro"
  on public.board_versions
  for select
  using (public.board_permission(board_id::text) in ('owner', 'edit'));

-- 5. Storage board-media
-- Leitura (e portanto listagem) apenas pelo dono do quadro; o público usa a URL pública
drop policy if exists "Permitir leitura pública de imagens no board-media" on storage.objects;
drop policy if exists "Permitir leitura de imagens no board-media pelo dono do quadro" on storage.objects;
create policy "Permitir leitura de imagens no board-media pelo dono do quadro"
  on storage.objects
  for select
  using (
    bucket_id = 'board-media'
    and public.board_permission(split_part(name, '/', 1)) = 'owner'
  );

-- Upload: dono, quadro editável, ou quadro ainda não salvo no banco (rascunho local)
drop policy if exists "Permitir upload de imagens no board-media" on storage.objects;
create policy "Permitir upload de imagens no board-media"
  on storage.objects
  for insert
  with check (
    bucket_id = 'board-media'
    and coalesce(public.board_permission(split_part(name, '/', 1)), 'edit') in ('owner', 'edit')
  );

drop policy if exists "Permitir atualização de imagens no board-media" on storage.objects;
create policy "Permitir atualização de imagens no board-media"
  on storage.objects
  for update
  using (
    bucket_id = 'board-media'
    and public.board_permission(split_part(name, '/', 1)) in ('owner', 'edit')
  );

drop policy if exists "Permitir exclusão de imagens no board-media" on storage.objects;
create policy "Permitir exclusão de imagens no board-media"
  on storage.objects
  for delete
  using (
    bucket_id = 'board-media'
    and public.board_permission(split_part(name, '/', 1)) = 'owner'
  );
