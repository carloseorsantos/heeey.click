-- ==============================================================================
-- Canais Realtime privados: só quem edita o quadro altera a cena ao vivo
-- ==============================================================================
-- A colaboração usava o canal público `heeey:room:<id>`, e qualquer pessoa com o id
-- (inclusive quem recebeu o link somente leitura) podia transmitir `canvas-update`.
-- O navegador do dono aplicava essas mudanças e as gravava no banco com a permissão
-- dele na próxima edição, contornando o modo somente leitura.
--
-- Agora os canais são privados e o Realtime consulta as políticas de realtime.messages
-- ao entrar no canal (por extensão: broadcast ou presence, não por evento):
--   heeey:room:<id>   broadcast (cena, título, permissão): só quem pode editar
--                     presence (quem está online): quem tem o link
--   heeey:peers:<id>  broadcast (cursores, pedido de sincronização): quem tem o link
-- Receber mensagens exige só o id (o link), como a leitura do quadro.
-- Um id que ainda não está no banco (quadro recém-criado, só local) é tratado como
-- editável, como no upload de imagens, para a sala funcionar desde o primeiro instante.

-- 1. Id do quadro de um tópico `heeey:room:<id>` ou `heeey:peers:<id>` (null se não for)
create or replace function public.realtime_topic_board(p_topic text)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
begin
  if split_part(p_topic, ':', 1) <> 'heeey' or split_part(p_topic, ':', 2) not in ('room', 'peers') then
    return null;
  end if;
  return split_part(p_topic, ':', 3)::uuid;
exception when others then
  return null;
end;
$$;

grant execute on function public.realtime_topic_board(text) to anon, authenticated;

-- 2. Se o usuário atual pode alterar a cena do quadro pela sala ao vivo
create or replace function public.realtime_can_edit_board(p_board_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_owner uuid;
  v_access text;
  v_deleted timestamptz;
begin
  select b.owner_id, b.access_level, b.deleted_at into v_owner, v_access, v_deleted
  from public.boards b
  where b.id = p_board_id;
  if not found then
    return true;
  end if;
  if auth.uid() is not null and v_owner = auth.uid() then
    return true;
  end if;
  return v_access = 'edit' and v_deleted is null;
end;
$$;

revoke execute on function public.realtime_can_edit_board(uuid) from public;
grant execute on function public.realtime_can_edit_board(uuid) to anon, authenticated;

-- 3. Políticas de realtime.messages
drop policy if exists "heeey: receber mensagens da sala do quadro" on realtime.messages;
create policy "heeey: receber mensagens da sala do quadro"
  on realtime.messages
  for select
  to anon, authenticated
  using (
    realtime.messages.extension in ('broadcast', 'presence')
    and public.realtime_topic_board(realtime.topic()) is not null
  );

drop policy if exists "heeey: aparecer online na sala do quadro" on realtime.messages;
create policy "heeey: aparecer online na sala do quadro"
  on realtime.messages
  for insert
  to anon, authenticated
  with check (
    realtime.messages.extension = 'presence'
    and split_part(realtime.topic(), ':', 2) = 'room'
    and public.realtime_topic_board(realtime.topic()) is not null
  );

drop policy if exists "heeey: enviar cursores na sala do quadro" on realtime.messages;
create policy "heeey: enviar cursores na sala do quadro"
  on realtime.messages
  for insert
  to anon, authenticated
  with check (
    realtime.messages.extension = 'broadcast'
    and split_part(realtime.topic(), ':', 2) = 'peers'
    and public.realtime_topic_board(realtime.topic()) is not null
  );

drop policy if exists "heeey: alterar a cena pela sala do quadro" on realtime.messages;
create policy "heeey: alterar a cena pela sala do quadro"
  on realtime.messages
  for insert
  to anon, authenticated
  with check (
    realtime.messages.extension = 'broadcast'
    and split_part(realtime.topic(), ':', 2) = 'room'
    and public.realtime_topic_board(realtime.topic()) is not null
    and public.realtime_can_edit_board(public.realtime_topic_board(realtime.topic()))
  );

-- 4. A API pública passa a transmitir no canal privado da sala
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
      true
    );
  exception when others then
    null;
  end;
end;
$$;

revoke all on function public.api_broadcast_elements(uuid, jsonb) from public, anon, authenticated;
