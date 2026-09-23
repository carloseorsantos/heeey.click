/**
 * Vercel Function for the MCP server (Streamable HTTP): https://<app>/api/mcp
 * All logic lives in src/server/mcpHandler.ts.
 */
import { handleMcpRequest } from '../src/server/mcpHandler';
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
  return handleMcpRequest(request, rpc, { appOrigin: appOrigin(request, env) });
}

export default handle;
export const GET = handle;
export const POST = handle;
export const DELETE = handle;
export const OPTIONS = handle;
