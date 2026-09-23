/**
 * Vercel Function for the public REST API: /api/v1/* is rewritten here (vercel.json).
 * All logic lives in src/server/apiHandler.ts.
 */
import { handleApiRequest } from '../src/server/apiHandler';
import { createRpc, appOrigin } from '../src/server/supabaseRpc';

declare const process: { env: Record<string, string | undefined> };

const rpc = createRpc(process.env);

function handle(request: Request): Promise<Response> {
  return handleApiRequest(request, rpc, { appOrigin: appOrigin(request, process.env) });
}

export const GET = handle;
export const POST = handle;
export const PATCH = handle;
export const DELETE = handle;
export const OPTIONS = handle;
