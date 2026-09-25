import { describe, it, expect, vi } from 'vitest';
import { handleHealth, createHealthChecks } from '../server/health';

const get = (method = 'GET') => new Request('https://heeey.click/api/health', { method });

describe('health check', () => {
  it('answers 200 when every check passes', async () => {
    const res = await handleHealth(get(), { a: async () => {}, b: async () => {} });
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(Object.keys(body.checks)).toEqual(['a', 'b']);
    expect(body.checks.a.ok).toBe(true);
  });

  it('answers 503 and names the failing check without leaking the error', async () => {
    const res = await handleHealth(get(), {
      a: async () => {},
      b: async () => { throw new Error('secret connection string'); },
    });
    expect(res.status).toBe(503);
    const text = await res.text();
    expect(text).not.toContain('secret');
    expect(JSON.parse(text)).toMatchObject({ status: 'degraded', checks: { a: { ok: true }, b: { ok: false } } });
  });

  it('fails a check that hangs', async () => {
    vi.useFakeTimers();
    const pending = handleHealth(get(), { slow: () => new Promise(() => {}) });
    await vi.advanceTimersByTimeAsync(5000);
    expect((await pending).status).toBe(503);
    vi.useRealTimers();
  });

  it('only allows GET and HEAD', async () => {
    expect((await handleHealth(get('HEAD'), {})).status).toBe(200);
    expect((await handleHealth(get('POST'), {})).status).toBe(405);
  });

  it('probes Supabase Auth, Storage and the database with the public key', async () => {
    const fetchImpl = vi.fn(async () => new Response('{}', { status: 200 }));
    const checks = createHealthChecks({ SUPABASE_URL: 'https://x.supabase.co/', SUPABASE_ANON_KEY: 'pk' }, fetchImpl as unknown as typeof fetch);
    await Promise.all(Object.values(checks).map((c) => c()));
    const calls = fetchImpl.mock.calls as unknown as [string, RequestInit][];
    expect(calls.map(([u]) => u)).toEqual([
      'https://x.supabase.co/auth/v1/health',
      'https://x.supabase.co/storage/v1/status',
      'https://x.supabase.co/rest/v1/rpc/realtime_can_edit_board',
    ]);
    expect(calls.every(([, init]) => (init.headers as Record<string, string>).apikey === 'pk')).toBe(true);

    fetchImpl.mockResolvedValueOnce(new Response('', { status: 500 }));
    await expect(checks.auth()).rejects.toThrow('500');
  });
});
