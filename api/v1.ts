/**
 * Vercel Function for the public REST API: /api/v1/* is rewritten here (vercel.json).
 * All logic lives in src/server/apiHandler.ts.
 */
import { handleApiRequest } from '../src/server/apiHandler';
import { createRpc, appOrigin } from '../src/server/supabaseRpc';

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
  const rpc = createRpc(env);
  return handleApiRequest(request, rpc, { appOrigin: appOrigin(request, env) });
}

export default handle;
export const GET = handle;
export const POST = handle;
export const PATCH = handle;
export const DELETE = handle;
export const OPTIONS = handle;
