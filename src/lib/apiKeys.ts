import { supabase } from './supabase';

export type ApiKeyScope = 'read' | 'write';

export interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  scopes: ApiKeyScope[];
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
}

export async function listApiKeys(): Promise<ApiKey[] | null> {
  const { data, error } = await supabase
    .from('api_keys')
    .select('id,name,prefix,scopes,created_at,last_used_at,revoked_at')
    .is('revoked_at', null)
    .order('created_at', { ascending: false });
  if (error) {
    console.warn('Erro ao carregar chaves de API:', error.message);
    return null;
  }
  return (data || []) as ApiKey[];
}

/** Returns the full key, which is only available right after creation */
export async function createApiKey(
  name: string,
  scopes: ApiKeyScope[]
): Promise<{ key: string } | { error: string }> {
  const { data, error } = await supabase.rpc('create_api_key', { p_name: name.trim(), p_scopes: scopes });
  const row = Array.isArray(data) ? data[0] : data;
  if (error || !row?.key) return { error: error?.message || 'Não foi possível criar a chave.' };
  return { key: row.key as string };
}

export async function revokeApiKey(id: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('revoke_api_key', { p_id: id });
  if (error) console.warn('Erro ao revogar chave de API:', error.message);
  return !error && data === true;
}
