-- ==============================================================================
-- Chaves de API por usuário (para agentes, integrações e o servidor MCP)
-- A chave herda as permissões do usuário; só o hash SHA-256 fica no banco.
-- ==============================================================================

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.api_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  -- Início da chave, exibido na interface para identificá-la (ex.: hk_1a2b3c4d)
  prefix text not null unique,
  key_hash text not null unique,
  scopes text[] not null default array['read', 'write']
    check (cardinality(scopes) > 0 and scopes <@ array['read', 'write']),
  created_at timestamptz not null default timezone('utc'::text, now()),
  last_used_at timestamptz,
  revoked_at timestamptz
);

create index if not exists idx_api_keys_user on public.api_keys(user_id);

-- Leitura apenas das próprias chaves e sem acesso ao hash; escrita só pelas funções abaixo
alter table public.api_keys enable row level security;

drop policy if exists "Chaves visíveis apenas para o dono" on public.api_keys;
create policy "Chaves visíveis apenas para o dono"
  on public.api_keys for select
  using (auth.uid() is not null and user_id = auth.uid());

revoke all on public.api_keys from anon, authenticated;
grant select (id, user_id, name, prefix, scopes, created_at, last_used_at, revoked_at)
  on public.api_keys to authenticated;

-- 1. Criar chave: devolve o valor completo uma única vez
create or replace function public.create_api_key(p_name text, p_scopes text[] default array['read', 'write'])
returns table (id uuid, key text, prefix text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_secret text;
  v_prefix text;
  v_key text;
begin
  if v_user is null then
    raise exception 'Entre na sua conta para criar chaves de API.';
  end if;
  if (select count(*) from public.api_keys k where k.user_id = v_user and k.revoked_at is null) >= 20 then
    raise exception 'Limite de 20 chaves ativas atingido. Revogue uma chave antes de criar outra.';
  end if;

  v_secret := encode(extensions.gen_random_bytes(24), 'hex');
  v_prefix := 'hk_' || substr(v_secret, 1, 8);
  v_key := v_prefix || '_' || substr(v_secret, 9);

  return query
  insert into public.api_keys as k (user_id, name, prefix, key_hash, scopes)
  values (
    v_user,
    btrim(p_name),
    v_prefix,
    encode(extensions.digest(v_key, 'sha256'), 'hex'),
    coalesce(p_scopes, array['read', 'write'])
  )
  returning k.id, v_key, k.prefix;
end;
$$;

-- 2. Revogar chave (não pode ser desfeito)
create or replace function public.revoke_api_key(p_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.api_keys k
  set revoked_at = timezone('utc'::text, now())
  where k.id = p_id and k.user_id = auth.uid() and k.revoked_at is null;
  return found;
end;
$$;

revoke all on function public.create_api_key(text, text[]) from public, anon;
revoke all on function public.revoke_api_key(uuid) from public, anon;
grant execute on function public.create_api_key(text, text[]) to authenticated;
grant execute on function public.revoke_api_key(uuid) to authenticated;

-- 3. Uso interno das funções da API: valida a chave e o escopo, devolve o usuário
--    e faz auth.uid() valer esse usuário até o fim da transação (triggers e regras)
create or replace function public.api_authenticate(p_key text, p_scope text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_key public.api_keys;
begin
  select * into v_key
  from public.api_keys k
  where k.key_hash = encode(extensions.digest(coalesce(p_key, ''), 'sha256'), 'hex')
    and k.revoked_at is null;

  if v_key.id is null then
    raise exception 'Chave de API inválida ou revogada.' using errcode = '28000';
  end if;
  if not (p_scope = any(v_key.scopes)) then
    raise exception 'Esta chave de API não tem permissão de %.',
      case p_scope when 'write' then 'escrita' else 'leitura' end
      using errcode = '42501';
  end if;

  if v_key.last_used_at is null or v_key.last_used_at < timezone('utc'::text, now()) - interval '1 minute' then
    update public.api_keys k set last_used_at = timezone('utc'::text, now()) where k.id = v_key.id;
  end if;

  perform set_config('request.jwt.claim.sub', v_key.user_id::text, true);
  return v_key.user_id;
end;
$$;

revoke all on function public.api_authenticate(text, text) from public, anon, authenticated;
