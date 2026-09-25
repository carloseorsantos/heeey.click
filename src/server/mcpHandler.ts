/**
 * heeey.click MCP server (Streamable HTTP transport, stateless, JSON responses).
 * Agents connect with a personal API key (Authorization: Bearer hk_...) and get
 * tools to read, create and edit the user's boards. Tools call the same database
 * functions as the REST API, so the key's scope and the user's rules apply.
 */
import { ApiContext, ApiError, Rpc, caller, withUrl } from './apiHandler';
import { toExcalidrawElements, describeElements, ElementSpec } from '../lib/elementSkeleton';
import { layoutDiagram, relayoutElements, DiagramError, DiagramInput, NODE_COLORS } from '../lib/diagramLayout';

const SUPPORTED_PROTOCOL_VERSIONS = ['2025-06-18', '2025-03-26', '2024-11-05'];
const SERVER_INFO = { name: 'heeey.click', title: 'heeey.click', version: '1.0.0' };

const INSTRUCTIONS = `heeey.click is a collaborative whiteboard built on Excalidraw.
Boards contain Excalidraw elements. When writing elements you can use short specs:
- shapes: {"id":"a","type":"rectangle"|"ellipse"|"diamond","x":0,"y":0,"label":"Text inside"}
- text: {"type":"text","x":0,"y":0,"text":"Hello"}
- arrows: {"type":"arrow","start":{"id":"a"},"end":{"id":"b"},"label":"optional"}
Give shapes stable ids so arrows can connect to them and later edits can update them.
Coordinates are in pixels (x to the right, y down); leave ~80px between shapes.
For flowcharts, architectures, org charts, mind maps and other node-and-arrow diagrams,
prefer create_diagram: describe nodes and edges and the server computes spacing and
routes the arrows. Use layout_board to tidy up an existing board.
Boards live in projects inside teams. Use list_projects to see where you can create boards;
without project_id, new boards go to the default project of the user's personal team (or of
the first team the key reaches). New boards are restricted: only the team and invited people
open them. Every board result includes a url the user can open.`;

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

const DIRECTION_SCHEMA = {
  type: 'string',
  enum: ['TB', 'LR', 'BT', 'RL'],
  description: 'Flow direction: TB top→bottom (default), LR left→right, BT, RL',
};

/** Where to put a new diagram on a board that already has content: to its right */
function originBeside(elements: readonly any[]): { x: number; y: number } {
  const live = elements.filter((e) => !e.isDeleted);
  if (live.length === 0) return { x: 0, y: 0 };
  return {
    x: Math.max(...live.map((e) => e.x + (e.width || 0))) + 160,
    y: Math.min(...live.map((e) => e.y)),
  };
}

function diagramArgs(args: Json): DiagramInput {
  const { nodes, edges, direction } = args as any;
  if (!Array.isArray(nodes)) throw new ApiError(400, 'invalid_request', 'nodes deve ser uma lista.');
  if (edges !== undefined && !Array.isArray(edges)) throw new ApiError(400, 'invalid_request', 'edges deve ser uma lista.');
  return { nodes, edges: edges ?? [], direction };
}

function layoutOrThrow(input: DiagramInput): ElementSpec[] {
  try {
    return layoutDiagram(input);
  } catch (e) {
    if (e instanceof DiagramError) throw new ApiError(400, 'invalid_request', e.message);
    throw e;
  }
}

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

const optionalUuid = (args: Json, name: string) => (typeof args[name] === 'string' && args[name] ? (args[name] as string) : null);

export const MCP_TOOLS: ToolDefinition[] = [
  {
    name: 'list_projects',
    title: 'List teams and projects',
    description:
      "List the teams and projects this key can reach, with the user's access in each (manage, edit or view). Use a project_id to create or list boards and folders there.",
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: true },
    run: async (_args, call) => ({ projects: await call('api_list_projects') }),
  },
  {
    name: 'list_boards',
    title: 'List boards',
    description: "List the boards of the user's teams, most recently edited first.",
    inputSchema: {
      type: 'object',
      properties: {
        project_id: { ...uuid, description: 'Only boards in this project' },
        team_id: { ...uuid, description: 'Only boards of this team' },
        folder_id: { ...uuid, description: 'Only boards in this folder' },
        limit: { type: 'integer', minimum: 1, maximum: 200 },
      },
    },
    annotations: { readOnlyHint: true },
    run: async (args, call, ctx) => {
      const boards = await call('api_list_boards', {
        p_project_id: optionalUuid(args, 'project_id'),
        p_team_id: optionalUuid(args, 'team_id'),
        p_folder_id: optionalUuid(args, 'folder_id'),
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
    description: 'Create a new board, optionally with elements, in a project (see list_projects). Returns the board with its url.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        elements: { type: 'array', items: ELEMENT_SPEC_SCHEMA },
        project_id: { ...uuid, description: 'Project for the new board (default: the default project)' },
        folder_id: uuid,
      },
      required: ['title'],
    },
    run: async (args, call, ctx) => {
      const elements = args.elements === undefined ? [] : toExcalidrawElements(specsArg(args));
      const board = await call('api_create_board', {
        p_title: requireString(args, 'title'),
        p_elements: elements,
        p_folder_id: optionalUuid(args, 'folder_id'),
        p_project_id: optionalUuid(args, 'project_id'),
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
    name: 'create_diagram',
    title: 'Create a laid-out diagram',
    description:
      'Draw a node-and-arrow diagram (flowchart, architecture, process, org chart, mind map) with automatic layout: shapes are sized to their labels, evenly spaced, and arrows are routed around shapes and bound to them. Creates a new board, or adds the diagram next to the existing content of board_id. Re-using node ids on the same board updates those shapes.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Title of the new board (when board_id is not given)' },
        board_id: { ...uuid, description: 'Add the diagram to this existing board instead' },
        project_id: { ...uuid, description: 'Project for the new board' },
        folder_id: { ...uuid, description: 'Folder for the new board' },
        direction: DIRECTION_SCHEMA,
        nodes: {
          type: 'array',
          minItems: 1,
          maxItems: 300,
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              label: { type: 'string' },
              shape: { type: 'string', enum: ['rectangle', 'ellipse', 'diamond'], description: 'diamond for decisions, ellipse for start/end' },
              color: { type: 'string', enum: Object.keys(NODE_COLORS) },
            },
            required: ['id', 'label'],
          },
        },
        edges: {
          type: 'array',
          items: {
            type: 'object',
            properties: { from: { type: 'string' }, to: { type: 'string' }, label: { type: 'string' } },
            required: ['from', 'to'],
          },
        },
      },
      required: ['nodes'],
    },
    run: async (args, call, ctx) => {
      const input = diagramArgs(args);
      const boardId = typeof args.board_id === 'string' && args.board_id ? args.board_id : null;

      if (!boardId) {
        const specs = layoutOrThrow(input);
        const board = await call('api_create_board', {
          p_title: requireString(args, 'title'),
          p_elements: toExcalidrawElements(specs),
          p_folder_id: optionalUuid(args, 'folder_id'),
          p_project_id: optionalUuid(args, 'project_id'),
        });
        return { board: withUrl(board, ctx) };
      }

      const current = await call('api_get_board', { p_board_id: boardId });
      const nodeIds = new Set(input.nodes.map((n) => n.id));
      // Nodes that already exist are redrawn in place of the old diagram; new diagrams go beside the content
      const others = (current.elements as any[]).filter((e) => !nodeIds.has(e.id) && !nodeIds.has(e.containerId));
      const specs = layoutOrThrow({ ...input, origin: originBeside(others) });
      const board = await call('api_update_board', {
        p_board_id: boardId,
        p_elements: toExcalidrawElements(specs, current.elements),
      });
      return { board: withUrl(board, ctx) };
    },
  },
  {
    name: 'layout_board',
    title: 'Tidy up a board',
    description:
      'Automatically re-arrange the shapes of a board and the arrows connecting them into a clean layered layout (no overlaps, arrows routed around shapes). Other elements stay where they are.',
    inputSchema: {
      type: 'object',
      properties: { board_id: uuid, direction: DIRECTION_SCHEMA },
      required: ['board_id'],
    },
    annotations: { idempotentHint: true },
    run: async (args, call, ctx) => {
      const boardId = requireString(args, 'board_id');
      const current = await call('api_get_board', { p_board_id: boardId });
      const changed = relayoutElements(current.elements, { direction: (args.direction as DiagramInput['direction']) ?? 'TB' });
      if (changed.length === 0) return { board: withUrl(current, ctx), moved: 0 };
      const { elements: _e, files: _f, app_state: _a, ...summary } = current;
      const board = await call('api_update_board', { p_board_id: boardId, p_elements: changed });
      return { board: withUrl({ ...summary, ...board }, ctx), moved: changed.length };
    },
  },
  {
    name: 'list_folders',
    title: 'List folders',
    description: "List the folders of the user's projects (parent_id null = top level of the project).",
    inputSchema: { type: 'object', properties: { project_id: { ...uuid, description: 'Only folders of this project' } } },
    annotations: { readOnlyHint: true },
    run: async (args, call) => ({ folders: await call('api_list_folders', { p_project_id: optionalUuid(args, 'project_id') }) }),
  },
  {
    name: 'create_folder',
    title: 'Create a folder',
    description: 'Create a folder in a project, optionally inside another folder.',
    inputSchema: {
      type: 'object',
      properties: { name: { type: 'string' }, parent_id: uuid, project_id: { ...uuid, description: 'Project of the folder (default: the default project)' } },
      required: ['name'],
    },
    run: async (args, call) => ({
      folder: await call('api_create_folder', {
        p_name: requireString(args, 'name'),
        p_parent_id: optionalUuid(args, 'parent_id'),
        p_project_id: optionalUuid(args, 'project_id'),
      }),
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
