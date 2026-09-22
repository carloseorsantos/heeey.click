-- ==============================================================================
-- Supabase Storage Setup para o Heeey (heeey.click)
-- Bucket: board-media
-- ==============================================================================

-- 1. Criação do bucket público 'board-media' caso não exista
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'board-media',
  'board-media',
  true,
  5242880, -- Limite máximo de 5MB por arquivo (o app comprime client-side para < 150KB)
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml']
)
on conflict (id) do update set
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml'];

-- 2. Políticas de Acesso (RLS) para o bucket board-media

-- Leitura pública irrestrita: qualquer pessoa visualizando ou colaborando na lousa pode carregar as imagens
drop policy if exists "Permitir leitura pública de imagens no board-media" on storage.objects;
create policy "Permitir leitura pública de imagens no board-media"
  on storage.objects
  for select
  using (bucket_id = 'board-media');

-- Upload público permitido: convidados e usuários logados podem enviar imagens otimizadas para as lousas
drop policy if exists "Permitir upload de imagens no board-media" on storage.objects;
create policy "Permitir upload de imagens no board-media"
  on storage.objects
  for insert
  with check (bucket_id = 'board-media');

-- Atualização e sobrescrita de imagem com o mesmo identificador
drop policy if exists "Permitir atualização de imagens no board-media" on storage.objects;
create policy "Permitir atualização de imagens no board-media"
  on storage.objects
  for update
  using (bucket_id = 'board-media');

-- Exclusão de imagens
drop policy if exists "Permitir exclusão de imagens no board-media" on storage.objects;
create policy "Permitir exclusão de imagens no board-media"
  on storage.objects
  for delete
  using (bucket_id = 'board-media');
