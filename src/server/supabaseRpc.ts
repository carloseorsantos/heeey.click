import { createClient } from '@supabase/supabase-js';
import type { Rpc } from './apiHandler';

// Same public project settings as the web app (src/lib/supabase.ts). The API needs no
// secret: callers authenticate with their personal API key inside each api_* function.
const DEFAULT_SUPABASE_URL = 'https://nsczplggnyuljosvvlml.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'sb_publishable_DcFYEb25HZ7S7qym6K8TxA_ismhm5Sv';

export function createRpc(env: Record<string, string | undefined>): Rpc {
  const client = createClient(
    env.SUPABASE_URL || env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL,
    env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
  return (fn, args) => client.rpc(fn, args);
}

/** Public origin of the app for board links (APP_URL, else the request origin) */
export function appOrigin(request: Request, env: Record<string, string | undefined>): string {
  return (env.APP_URL || new URL(request.url).origin).replace(/\/$/, '');
}
