/**
 * Vercel Function for semantic board search with Jev (via Vercel AI Gateway).
 * All logic lives in src/server/semanticSearch.ts.
 */
import { handleSemanticSearch } from '../src/server/semanticSearch';
import { createRpc } from '../src/server/supabaseRpc';
import { gatewayToken, zeroDataRetentionEnabled } from '../src/server/jev';

export const config = {
  runtime: 'edge',
};

declare const process: { env?: Record<string, string | undefined> };

function getEnv(): Record<string, string | undefined> {
  try {
    return typeof process !== 'undefined' && process.env ? process.env : {};
  } catch {
    return {};
  }
}

function handle(request: Request): Promise<Response> {
  const env = getEnv();
  // The caller's Supabase session token, so search_candidates only sees their boards
  const accessToken = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  return handleSemanticSearch(request, {
    rpc: createRpc(env, accessToken || undefined),
    gatewayToken: gatewayToken(request, env),
    zeroDataRetention: zeroDataRetentionEnabled(env),
  });
}

export default handle;
export const POST = handle;
