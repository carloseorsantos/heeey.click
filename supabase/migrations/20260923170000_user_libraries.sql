-- ==============================================================================
-- Biblioteca pessoal do Excalidraw, sincronizada entre dispositivos
-- (a biblioteca compartilhada com a equipe depende de workspaces e fica para depois)
-- ==============================================================================

create table if not exists public.user_libraries (
  user_id uuid primary key references auth.users(id) on delete cascade,
  items jsonb not null default '[]'::jsonb check (jsonb_typeof(items) = 'array'),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

alter table public.user_libraries enable row level security;

drop policy if exists "Biblioteca visível apenas para o dono" on public.user_libraries;
create policy "Biblioteca visível apenas para o dono"
  on public.user_libraries for select
  using (auth.uid() is not null and user_id = auth.uid());

drop policy if exists "Biblioteca criada apenas pelo dono" on public.user_libraries;
create policy "Biblioteca criada apenas pelo dono"
  on public.user_libraries for insert
  with check (auth.uid() is not null and user_id = auth.uid());

drop policy if exists "Biblioteca alterada apenas pelo dono" on public.user_libraries;
create policy "Biblioteca alterada apenas pelo dono"
  on public.user_libraries for update
  using (auth.uid() is not null and user_id = auth.uid())
  with check (auth.uid() is not null and user_id = auth.uid());

create or replace function public.touch_user_library()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$;

drop trigger if exists touch_user_library on public.user_libraries;
create trigger touch_user_library
  before update on public.user_libraries
  for each row
  execute function public.touch_user_library();
