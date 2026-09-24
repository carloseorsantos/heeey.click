-- ==============================================================================
-- Histórico de versões só pelo dono ou pelo link do quadro
-- ==============================================================================
-- A migration 20260923210000_board_link_access fechou a listagem de public.boards, mas
-- manteve a leitura de public.board_versions como `board_permission(...) in ('owner',
-- 'edit')`. Como board_permission devolve o access_level do quadro para qualquer um,
-- `GET /rest/v1/board_versions?select=*` com a chave anon listava o histórico de todos
-- os quadros editáveis, com o conteúdo e os ids (que são o segredo do link).
--
-- Agora quem não é dono só lê o histórico do quadro que informa no cabeçalho
-- `x-board-id`, e snapshot_board exige o mesmo para quem não é dono.

-- 1. Leitura do histórico
drop policy if exists "Permitir leitura do histórico a quem edita o quadro" on public.board_versions;
create policy "Permitir leitura do histórico a quem edita o quadro"
  on public.board_versions
  for select
  using (
    public.board_permission(board_id::text) = 'owner'
    or (
      board_id = public.requested_board_id()
      and public.board_permission(board_id::text) = 'edit'
    )
  );

-- 2. Snapshot sob demanda: quem não é dono precisa ter aberto o quadro pelo link
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
  -- coalesce: sem cabeçalho a comparação é null, e `not (... or null)` não bloquearia
  if not coalesce(
    (auth.uid() is not null and target.owner_id = auth.uid())
    or (target.access_level = 'edit' and p_board_id = public.requested_board_id()),
    false
  ) then
    raise exception 'Sem permissão para salvar versões deste quadro.';
  end if;

  perform public.insert_board_version(target, 'before_restore', timezone('utc'::text, now()));
end;
$$;

grant execute on function public.snapshot_board(uuid) to anon, authenticated;
