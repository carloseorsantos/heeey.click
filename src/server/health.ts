import { DEFAULT_SUPABASE_ANON_KEY, DEFAULT_SUPABASE_URL } from './supabaseRpc';

export type HealthCheck = () => Promise<void>;

const TIMEOUT_MS = 5000;

/**
 * Public health check for the uptime monitor behind status.heeey.click (compliance C17).
 * Runs every check in parallel and answers 200 when all pass, 503 otherwise, naming only
 * which check failed: error details stay out of this public response.
 */
export async function handleHealth(request: Request, checks: Record<string, HealthCheck>): Promise<Response> {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return Response.json({ error: 'method_not_allowed' }, { status: 405, headers: { Allow: 'GET, HEAD' } });
  }

  const names = Object.keys(checks);
  const results = await Promise.all(
    names.map(async (name) => {
      const started = Date.now();
      try {
        await withTimeout(checks[name](), TIMEOUT_MS);
        return [name, { ok: true, ms: Date.now() - started }] as const;
      } catch {
        return [name, { ok: false, ms: Date.now() - started }] as const;
      }
    })
  );
  const ok = results.every(([, r]) => r.ok);
  return Response.json(
    { status: ok ? 'ok' : 'degraded', checks: Object.fromEntries(results) },
    { status: ok ? 200 : 503, headers: { 'Cache-Control': 'no-store' } }
  );
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms);
    promise.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); }
    );
  });
}

/** Checks against the public Supabase project: Auth, Storage and a real database query */
export function createHealthChecks(env: Record<string, string | undefined>, fetchImpl: typeof fetch = fetch): Record<string, HealthCheck> {
  const url = (env.SUPABASE_URL || env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL).replace(/\/$/, '');
  const key = env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;
  const headers = { apikey: key };

  async function expectOk(path: string, init?: RequestInit) {
    const res = await fetchImpl(`${url}${path}`, { ...init, headers: { ...headers, ...init?.headers } });
    if (!res.ok) throw new Error(`${path}: ${res.status}`);
  }

  return {
    auth: () => expectOk('/auth/v1/health'),
    storage: () => expectOk('/storage/v1/status'),
    // Any anon-callable RPC that reads a table proves Postgres and PostgREST are up;
    // the nil board id is a primary-key miss, so this is a single index lookup.
    database: () =>
      expectOk('/rest/v1/rpc/realtime_can_edit_board', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_board_id: '00000000-0000-0000-0000-000000000000' }),
      }),
  };
}
