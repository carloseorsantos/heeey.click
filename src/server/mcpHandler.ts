/**
 * heeey.click MCP server (Streamable HTTP transport, stateless, JSON responses).
 * Agents connect with a personal API key (Authorization: Bearer hk_...) and get
 * tools to read, create and edit the user's boards. Tools call the same database
 * functions as the REST API, so the key's scope and the user's rules apply.
 */
import { ApiContext, ApiError, Rpc, caller, withUrl } from './apiHandler';
import { toExcalidrawElements, describeElements, ElementSpec } from '../lib/elementSkeleton';

const SUPPORTED_PROTOCOL_VERSIONS = ['2025-06-18', '2025-03-26', '2024-11-05'];
const SERVER_INFO = { name: 'heeey.click', title: 'heeey.click', version: '1.0.0' };

const INSTRUCTIONS = `heeey.click is a collaborative whiteboard built on Excalidraw.
Boards contain Excalidraw elements. When writing elements you can use short specs:
- shapes: {"id":"a","type":"rectangle"|"ellipse"|"diamond","x":0,"y":0,"label":"Text inside"}
- text: {"type":"text","x":0,"y":0,"text":"Hello"}
- arrows: {"type":"arrow","start":{"id":"a"},"end":{"id":"b"},"label":"optional"}
Give shapes stable ids so arrows can connect to them and later edits can update them.
Coordinates are in pixels (x to the right, y down); leave ~80px between shapes.
Every board result includes a url the user can open.`;

type Json = Record<string, unknown>;

const ELEMENT_SPEC_SCHEMA = {
  type: 'object',
  description:
    'An Excalidraw element or a short spec. Shapes accept "label"; arrows accept "start"/"end" ({"id"}) to connect shapes. Missing fields get defaults.',
  properties: {
    id: { type: 'string', description: 'Stable id; reuse it to update the element later' },
    type: { type: 'string', enum: ['rectangle', 'ellipse', 'diamond', 'text', 'arrow', 'line', 'frame'] },
    x: { type: 'number' },
    y: { type: 'number' },
    width: { type: 'number' },
    height: { type: 'number' },
    label: { type: 'string', description: 'Text inside a shape or on an arrow' },
    text: { type: 'string', description: 'Content of a text element' },
    fontSize: { type: 'number' },
    strokeColor: { type: 'string', description: 'CSS color, e.g. #1971c2' },
    backgroundColor: { type: 'string', description: 'CSS color, e.g. #a5d8ff' },
    start: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
    end: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
    points: { type: 'array', items: { type: 'array', items: { type: 'number' } } },
  },
  required: ['type'],
  additionalProperties: true,
};

const uuid = { type: 'string', format: 'uuid' };

interface ToolDefinition {
  name: string;
  title: string;
  description: string;
  inputSchema: Json;
  annotations?: Json;
  run: (args: Json, call: ReturnType<typeof caller>, ctx: ApiContext) => Promise<unknown>;
}

function requireString(args: Json, name: string): string {
  const value = args[name];
  if (typeof value !== 'string' || !value.trim()) throw new ApiError(400, 'invalid_request', `${name} é obrigatório.`);
  return value;
}

function specsArg(args: Json, name = 'elements'): ElementSpec[] {
  const value = args[name];
  if (!Array.isArray(value) || value.some((e) => !e || typeof e !== 'object' || typeof (e as Json).type !== 'string')) {
    throw new ApiError(400, 'invalid_request', `${name} deve ser uma lista de elementos com type.`);
  }
  return value as ElementSpec[];
}

async function upsertElements(call: ReturnType<typeof caller>, boardId: string, specs: ElementSpec[], deleteIds: string[] = []) {
  const current = await call('api_get_board', { p_board_id: boardId });
  // Deleting a shape also deletes the text bound to it (its label)
  const labels = (current.elements as any[])
    .filter((e) => e.containerId && deleteIds.includes(e.containerId))
    .map((e) => e.id);
  const toDelete = [...deleteIds, ...labels];
  return call('api_update_board', {
    p_board_id: boardId,
    p_elements: specs.length ? toExcalidrawElements(specs, current.elements) : null,
    p_delete_element_ids: toDelete.length ? toDelete : null,
  });
}

export const MCP_TOOLS: ToolDefinition[] = [
  {
    name: 'list_boards',
    title: 'List boards',
    description: "List the user's boards, most recently edited first.",
    inputSchema: {
      type: 'object',
      properties: {
        folder_id: { ...uuid, description: 'Only boards in this folder' },
        limit: { type: 'integer', minimum: 1, maximum: 200 },
      },
    },
    annotations: { readOnlyHint: true },
    run: async (args, call, ctx) => {
      const boards = await call('api_list_boards', {
        p_folder_id: (args.folder_id as string) || null,
        p_limit: (args.limit as number) || 50,
      });
      return { boards: (boards as any[]).map((b) => withUrl(b, ctx)) };
    },
  },
  {
    name: 'search_boards',
    title: 'Search boards',
    description: 'Full-text search over board titles and the text written on the boards (accent-insensitive, prefix match).',
    inputSchema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] },
    annotations: { readOnlyHint: true },
    run: async (args, call, ctx) => {
      const results = await call('api_search_boards', { p_query: requireString(args, 'query'), p_limit: 20 });
      return { results: (results as any[]).map((r) => withUrl(r, ctx)) };
    },
  },
  {
    name: 'get_board',
    title: 'Read a board',
    description:
      'Read a board. By default returns a compact view of the scene (shapes with their labels, arrows with what they connect). Use detail="full" for raw Excalidraw elements.',
    inputSchema: {
      type: 'object',
      properties: { board_id: uuid, detail: { type: 'string', enum: ['compact', 'full'] } },
      required: ['board_id'],
    },
    annotations: { readOnlyHint: true },
    run: async (args, call, ctx) => {
      const board = await call('api_get_board', { p_board_id: requireString(args, 'board_id') });
      const { elements, files: _files, app_state: _appState, ...summary } = board;
      return {
        board: withUrl(summary, ctx),
        elements: args.detail === 'full' ? elements : describeElements(elements),
      };
    },
  },
  {
    name: 'create_board',
    title: 'Create a board',
    description: 'Create a new board, optionally with elements. Returns the board with its url.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        elements: { type: 'array', items: ELEMENT_SPEC_SCHEMA },
        folder_id: uuid,
      },
      required: ['title'],
    },
    run: async (args, call, ctx) => {
      const elements = args.elements === undefined ? [] : toExcalidrawElements(specsArg(args));
      const board = await call('api_create_board', {
        p_title: requireString(args, 'title'),
        p_elements: elements,
        p_folder_id: (args.folder_id as string) || null,
      });
      return { board: withUrl(board, ctx) };
    },
  },
  {
    name: 'add_elements',
    title: 'Add or update elements',
    description:
      'Add elements to a board, or update existing ones by reusing their ids. Arrows can connect to shapes already on the board. People with the board open see the change live.',
    inputSchema: {
      type: 'object',
      properties: { board_id: uuid, elements: { type: 'array', items: ELEMENT_SPEC_SCHEMA, minItems: 1 } },
      required: ['board_id', 'elements'],
    },
    run: async (args, call, ctx) => ({
      board: withUrl(await upsertElements(call, requireString(args, 'board_id'), specsArg(args)), ctx),
    }),
  },
  {
    name: 'delete_elements',
    title: 'Delete elements',
    description: 'Remove elements from a board by id (their labels go with them).',
    inputSchema: {
      type: 'object',
      properties: { board_id: uuid, element_ids: { type: 'array', items: { type: 'string' }, minItems: 1 } },
      required: ['board_id', 'element_ids'],
    },
    annotations: { destructiveHint: true },
    run: async (args, call, ctx) => {
      const ids = args.element_ids;
      if (!Array.isArray(ids) || ids.some((id) => typeof id !== 'string')) {
        throw new ApiError(400, 'invalid_request', 'element_ids deve ser uma lista de ids.');
      }
      return { board: withUrl(await upsertElements(call, requireString(args, 'board_id'), [], ids as string[]), ctx) };
    },
  },
  {
    name: 'rename_board',
    title: 'Rename a board',
    description: 'Change the title of a board.',
    inputSchema: { type: 'object', properties: { board_id: uuid, title: { type: 'string' } }, required: ['board_id', 'title'] },
    annotations: { idempotentHint: true },
    run: async (args, call, ctx) => ({
      board: withUrl(
        await call('api_update_board', { p_board_id: requireString(args, 'board_id'), p_title: requireString(args, 'title') }),
        ctx
      ),
    }),
  },
  {
    name: 'trash_board',
    title: 'Move a board to the trash',
    description: 'Move a board to the trash. The user can restore it from the app.',
    inputSchema: { type: 'object', properties: { board_id: uuid }, required: ['board_id'] },
    annotations: { destructiveHint: true, idempotentHint: true },
    run: async (args, call, ctx) => ({
      board: withUrl(await call('api_trash_board', { p_board_id: requireString(args, 'board_id') }), ctx),
    }),
  },
  {
    name: 'list_folders',
    title: 'List folders',
    description: "List the user's folders (parent_id null = top level).",
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: true },
    run: async (_args, call) => ({ folders: await call('api_list_folders') }),
  },
  {
    name: 'create_folder',
    title: 'Create a folder',
    description: 'Create a folder, optionally inside another one.',
    inputSchema: { type: 'object', properties: { name: { type: 'string' }, parent_id: uuid }, required: ['name'] },
    run: async (args, call) => ({
      folder: await call('api_create_folder', { p_name: requireString(args, 'name'), p_parent_id: (args.parent_id as string) || null }),
    }),
  },
  {
    name: 'move_board',
    title: 'Move a board to a folder',
    description: 'Move a board into a folder (folder_id null = top level).',
    inputSchema: {
      type: 'object',
      properties: { board_id: uuid, folder_id: { anyOf: [uuid, { type: 'null' }] } },
      required: ['board_id'],
    },
    annotations: { idempotentHint: true },
    run: async (args, call, ctx) => ({
      board: withUrl(
        await call('api_move_board', { p_board_id: requireString(args, 'board_id'), p_folder_id: (args.folder_id as string) || null }),
        ctx
      ),
    }),
  },
];

/** Extra tools registered by other modules (e.g. diagram layout) */
export function registerMcpTool(tool: ToolDefinition) {
  if (!MCP_TOOLS.some((t) => t.name === tool.name)) MCP_TOOLS.push(tool);
}
export type { ToolDefinition };

type JsonRpcRequest = { jsonrpc: '2.0'; id?: string | number | null; method: string; params?: Json };

const rpcResult = (id: JsonRpcRequest['id'], result: unknown) => ({ jsonrpc: '2.0', id, result });
const rpcError = (id: JsonRpcRequest['id'], code: number, message: string) => ({ jsonrpc: '2.0', id: id ?? null, error: { code, message } });

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, Accept, Mcp-Session-Id, Mcp-Protocol-Version, X-API-Key',
  'Access-Control-Expose-Headers': 'Mcp-Session-Id',
};

function respond(body: unknown, status = 200, extra: Record<string, string> = {}) {
  return new Response(body === null ? null : JSON.stringify(body), {
    status,
    headers: { ...(body === null ? {} : { 'Content-Type': 'application/json' }), ...CORS_HEADERS, ...extra },
  });
}

async function handleMessage(message: JsonRpcRequest, key: string, rpc: Rpc, ctx: ApiContext) {
  const { id, method, params = {} } = message;

  switch (method) {
    case 'initialize': {
      const requested = String((params as Json).protocolVersion ?? '');
      return rpcResult(id, {
        protocolVersion: SUPPORTED_PROTOCOL_VERSIONS.includes(requested) ? requested : SUPPORTED_PROTOCOL_VERSIONS[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: SERVER_INFO,
        instructions: INSTRUCTIONS,
      });
    }
    case 'ping':
      return rpcResult(id, {});
    case 'tools/list':
      return rpcResult(id, {
        tools: MCP_TOOLS.map(({ name, title, description, inputSchema, annotations }) => ({
          name,
          title,
          description,
          inputSchema,
          ...(annotations ? { annotations } : {}),
        })),
      });
    case 'tools/call': {
      const tool = MCP_TOOLS.find((t) => t.name === (params as Json).name);
      if (!tool) return rpcError(id, -32602, `Unknown tool: ${(params as Json).name}`);
      const args = ((params as Json).arguments ?? {}) as Json;
      try {
        const output = await tool.run(args, caller(rpc, key), ctx);
        return rpcResult(id, {
          content: [{ type: 'text', text: JSON.stringify(output, null, 2) }],
          structuredContent: output,
        });
      } catch (e) {
        // Tool failures are results the model can read and react to, not protocol errors
        const message = e instanceof ApiError ? e.message : 'Erro inesperado. Tente novamente.';
        if (!(e instanceof ApiError)) console.error('Erro na ferramenta MCP:', e);
        return rpcResult(id, { content: [{ type: 'text', text: message }], isError: true });
      }
    }
    default:
      return rpcError(id, -32601, `Method not found: ${method}`);
  }
}

export async function handleMcpRequest(request: Request, rpc: Rpc, ctx: ApiContext): Promise<Response> {
  if (request.method === 'OPTIONS') return respond(null, 204);
  // Stateless server: no server-initiated stream and no sessions to end
  if (request.method !== 'POST') return respond(rpcError(null, -32000, 'Method not allowed'), 405, { Allow: 'POST' });

  const auth = request.headers.get('authorization')?.match(/^Bearer\s+(\S+)$/i)?.[1] || request.headers.get('x-api-key');
  if (!auth) {
    return respond(rpcError(null, -32001, 'Envie sua chave de API do heeey.click em Authorization: Bearer <chave>.'), 401, {
      'WWW-Authenticate': 'Bearer realm="heeey.click"',
    });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return respond(rpcError(null, -32700, 'Parse error'), 400);
  }

  const messages = Array.isArray(payload) ? payload : [payload];
  if (messages.length === 0 || messages.some((m) => !m || typeof m !== 'object' || (m as Json).jsonrpc !== '2.0' || typeof (m as Json).method !== 'string')) {
    return respond(rpcError(null, -32600, 'Invalid Request'), 400);
  }

  const responses = [];
  for (const message of messages as JsonRpcRequest[]) {
    const isNotification = message.id === undefined || message.id === null;
    const response = await handleMessage(message, auth, rpc, ctx);
    if (!isNotification) responses.push(response);
  }

  // Only notifications/responses: acknowledge without a body
  if (responses.length === 0) return respond(null, 202);
  return respond(Array.isArray(payload) ? responses : responses[0]);
}
