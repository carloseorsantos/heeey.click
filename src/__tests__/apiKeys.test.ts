import { describe, it, expect, vi, afterEach } from 'vitest';
import { supabase } from '../lib/supabase';
import { createApiKey, revokeApiKey } from '../lib/apiKeys';

describe('apiKeys', () => {
  afterEach(() => vi.restoreAllMocks());

  it('createApiKey returns the one-time key and sends the scopes', async () => {
    const rpc = vi.spyOn(supabase, 'rpc').mockResolvedValue({
      data: [{ id: 'k1', key: 'hk_12345678_abc', prefix: 'hk_12345678' }],
      error: null,
    } as any);
    expect(await createApiKey('  Agente ', ['read'])).toEqual({ key: 'hk_12345678_abc' });
    expect(rpc).toHaveBeenCalledWith('create_api_key', { p_name: 'Agente', p_scopes: ['read'] });
  });

  it('createApiKey surfaces server errors (e.g. the active key limit)', async () => {
    vi.spyOn(supabase, 'rpc').mockResolvedValue({ data: null, error: { message: 'Limite de 20 chaves' } } as any);
    expect(await createApiKey('x', ['read', 'write'])).toEqual({ error: 'Limite de 20 chaves' });
  });

  it('revokeApiKey is true only when a key was revoked', async () => {
    vi.spyOn(supabase, 'rpc').mockResolvedValueOnce({ data: true, error: null } as any);
    expect(await revokeApiKey('k1')).toBe(true);
    vi.spyOn(supabase, 'rpc').mockResolvedValueOnce({ data: false, error: null } as any);
    expect(await revokeApiKey('k1')).toBe(false);
  });
});
