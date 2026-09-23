/**
 * Vercel Function for the MCP server (Streamable HTTP): https://<app>/api/mcp
 * All logic lives in src/server/mcpHandler.ts.
 */
import { handleMcpRequest } from '../src/server/mcpHandler';
import { createRpc, appOrigin } from '../src/server/supabaseRpc';

declare const process: { env: Record<string, string | undefined> };

const rpc = createRpc(process.env);

function handle(request: Request): Promise<Response> {
  return handleMcpRequest(request, rpc, { appOrigin: appOrigin(request, process.env) });
}

export const GET = handle;
export const POST = handle;
export const DELETE = handle;
export const OPTIONS = handle;
