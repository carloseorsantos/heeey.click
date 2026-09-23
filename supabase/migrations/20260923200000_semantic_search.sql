-- ==============================================================================
-- Busca semântica: quadros candidatos para o Jev (TypeSafe via Vercel AI Gateway)
-- ==============================================================================

-- Quadros recentes do usuário autenticado com um trecho curto do texto do canvas.
-- A função /api/ai-search manda esses trechos ao Jev, que decide quais tratam da busca.
create or replace function public.search_candidates(p_limit integer default 40)
returns table (
  id uuid,
  title text,
  owner_id uuid,
  folder_id uuid,
  access_level text,
  thumbnail text,
  created_at timestamptz,
  updated_at timestamptz,
  content text
)
language sql
stable
set search_path = ''
as $$
  select
    b.id,
    b.title,
    b.owner_id,
    b.folder_id,
    b.access_level,
    b.thumbnail,
    b.created_at,
    b.updated_at,
    left(public.board_plain_text(b.elements), 600) as content
  from public.boards b
  where auth.uid() is not null
    and b.owner_id = auth.uid()
    and b.deleted_at is null
  order by b.updated_at desc
  limit least(greatest(coalesce(p_limit, 40), 1), 60);
$$;

revoke execute on function public.search_candidates(integer) from public, anon;
grant execute on function public.search_candidates(integer) to authenticated;
