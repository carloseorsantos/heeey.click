/**
 * heeey.click public REST API (v1). Framework-free: takes a Web Request, returns a
 * Response. Authentication is a personal API key (Authorization: Bearer hk_...);
 * every operation runs in the database as the key's user (see public_api migration).
 */
import { toExcalidrawElements, ElementSpec } from '../lib/elementSkeleton';

export type RpcResult = { data: any; error: { message: string; code?: string } | null };
export type Rpc = (fn: string, args: Record<string, unknown>) => PromiseLike<RpcResult>;

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string
  ) {
    super(message);
  }
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-API-Key',
  'Access-Control-Max-Age': '86400',
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...CORS_HEADERS },
  });
}

/** Maps Postgres/PostgREST errors raised by the api_* functions to HTTP errors */
export function toApiError(error: { message: string; code?: string }): ApiError {
  switch (error.code) {
    case '28000':
      return new ApiError(401, 'unauthorized', error.message);
    case '42501':
      return new ApiError(403, 'forbidden', error.message);
    case 'P0002':
      return new ApiError(404, 'not_found', error.message);
    case '22023':
    case '22P02':
    case '23503':
    case '23514':
      return new ApiError(400, 'invalid_request', error.message);
    case 'P0001':
      return /lixeira/.test(error.message)
        ? new ApiError(409, 'conflict', error.message)
        : new ApiError(400, 'invalid_request', error.message);
    default:
      return new ApiError(500, 'server_error', 'Erro inesperado. Tente novamente.');
  }
}

export function getApiKey(request: Request): string | null {
  const auth = request.headers.get('authorization');
  const bearer = auth?.match(/^Bearer\s+(\S+)$/i)?.[1];
  return bearer || request.headers.get('x-api-key') || null;
}

async function readBody(request: Request): Promise<Record<string, any>> {
  if (!request.body) return {};
  try {
    const body = await request.json();
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error();
    return body;
  } catch {
    throw new ApiError(400, 'invalid_json', 'O corpo da requisição deve ser um objeto JSON.');
  }
}

function uuidParam(value: unknown, name: string, optional = false): string | null {
  if (value === undefined || value === null || value === '') {
    if (optional) return null;
    throw new ApiError(400, 'invalid_request', `${name} é obrigatório.`);
  }
  if (typeof value !== 'string' || !UUID.test(value)) {
    throw new ApiError(400, 'invalid_request', `${name} deve ser um UUID.`);
  }
  return value;
}

function intParam(value: string | null, fallback: number): number {
  const n = value === null ? NaN : Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
}

function elementsParam(value: unknown, existing: readonly any[] = []): any[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.some((e) => !e || typeof e !== 'object' || typeof e.type !== 'string')) {
    throw new ApiError(400, 'invalid_request', 'elements deve ser uma lista de objetos com type.');
  }
  return toExcalidrawElements(value as ElementSpec[], existing);
}

/** Wraps an RPC so database errors become ApiErrors */
export function caller(rpc: Rpc, key: string) {
  return async (fn: string, args: Record<string, unknown> = {}) => {
    const { data, error } = await rpc(fn, { p_key: key, ...args });
    if (error) throw toApiError(error);
    return data;
  };
}

export interface ApiContext {
  /** Public origin of the web app, used to build board links */
  appOrigin: string;
}

export const withUrl = (board: any, ctx: ApiContext) => (board?.id ? { ...board, url: `${ctx.appOrigin}/b/${board.id}` } : board);

const API_INDEX = {
  name: 'heeey.click API',
  version: 'v1',
  auth: 'Authorization: Bearer <chave de API criada em heeey.click>',
  endpoints: [
    'GET    /api/v1/boards?folder_id=&include_trashed=&limit=&offset=',
    'POST   /api/v1/boards { title, elements?, folder_id? }',
    'GET    /api/v1/boards/:id',
    'PATCH  /api/v1/boards/:id { title?, elements?, delete_element_ids? }',
    'DELETE /api/v1/boards/:id  (move para a lixeira)',
    'POST   /api/v1/boards/:id/move { folder_id }',
    'GET    /api/v1/search?q=',
    'GET    /api/v1/folders',
    'POST   /api/v1/folders { name, parent_id? }',
  ],
};

export async function handleApiRequest(request: Request, rpc: Rpc, ctx: ApiContext): Promise<Response> {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS_HEADERS });

  try {
    const url = new URL(request.url);
    // Vercel rewrites /api/v1/<path> to /api/v1?path=<path>
    const rawPath = url.searchParams.get('path') ?? url.pathname.replace(/^\/api\/v1\/?/, '');
    const segments = rawPath.split('/').filter(Boolean);
    const method = request.method.toUpperCase();

    if (segments.length === 0 && method === 'GET') return json(API_INDEX);

    const key = getApiKey(request);
    if (!key) throw new ApiError(401, 'unauthorized', 'Envie sua chave de API em Authorization: Bearer <chave>.');
    const call = caller(rpc, key);
    const [resource, id, action] = segments;

    if (resource === 'boards' && !id) {
      if (method === 'GET') {
        const boards = await call('api_list_boards', {
          p_folder_id: uuidParam(url.searchParams.get('folder_id'), 'folder_id', true),
          p_include_trashed: url.searchParams.get('include_trashed') === 'true',
          p_limit: intParam(url.searchParams.get('limit'), 50),
          p_offset: intParam(url.searchParams.get('offset'), 0),
        });
        return json({ boards: (boards as any[]).map((b) => withUrl(b, ctx)) });
      }
      if (method === 'POST') {
        const body = await readBody(request);
        const board = await call('api_create_board', {
          p_title: typeof body.title === 'string' ? body.title : null,
          p_elements: elementsParam(body.elements) ?? [],
          p_folder_id: uuidParam(body.folder_id, 'folder_id', true),
        });
        return json({ board: withUrl(board, ctx) }, 201);
      }
    }

    if (resource === 'boards' && id) {
      const boardId = uuidParam(id, 'id');
      if (!action && method === 'GET') {
        return json({ board: withUrl(await call('api_get_board', { p_board_id: boardId }), ctx) });
      }
      if (!action && method === 'PATCH') {
        const body = await readBody(request);
        let elements: any[] | undefined;
        if (body.elements !== undefined) {
          // Arrows may point at shapes already on the board
          const current = await call('api_get_board', { p_board_id: boardId });
          elements = elementsParam(body.elements, current.elements);
        }
        const deleteIds = body.delete_element_ids;
        if (deleteIds !== undefined && (!Array.isArray(deleteIds) || deleteIds.some((d) => typeof d !== 'string'))) {
          throw new ApiError(400, 'invalid_request', 'delete_element_ids deve ser uma lista de ids.');
        }
        const board = await call('api_update_board', {
          p_board_id: boardId,
          p_title: typeof body.title === 'string' ? body.title : null,
          p_elements: elements ?? null,
          p_delete_element_ids: deleteIds ?? null,
        });
        return json({ board: withUrl(board, ctx) });
      }
      if (!action && method === 'DELETE') {
        return json({ board: withUrl(await call('api_trash_board', { p_board_id: boardId }), ctx) });
      }
      if (action === 'move' && method === 'POST') {
        const body = await readBody(request);
        const board = await call('api_move_board', {
          p_board_id: boardId,
          p_folder_id: uuidParam(body.folder_id, 'folder_id', true),
        });
        return json({ board: withUrl(board, ctx) });
      }
    }

    if (resource === 'search' && !id && method === 'GET') {
      const q = url.searchParams.get('q')?.trim();
      if (!q) throw new ApiError(400, 'invalid_request', 'Informe o termo de busca em q.');
      const results = await call('api_search_boards', { p_query: q, p_limit: intParam(url.searchParams.get('limit'), 20) });
      return json({ results: (results as any[]).map((r) => withUrl(r, ctx)) });
    }

    if (resource === 'folders' && !id) {
      if (method === 'GET') return json({ folders: await call('api_list_folders') });
      if (method === 'POST') {
        const body = await readBody(request);
        if (typeof body.name !== 'string' || !body.name.trim()) {
          throw new ApiError(400, 'invalid_request', 'name é obrigatório.');
        }
        const folder = await call('api_create_folder', {
          p_name: body.name,
          p_parent_id: uuidParam(body.parent_id, 'parent_id', true),
        });
        return json({ folder }, 201);
      }
    }

    throw new ApiError(404, 'not_found', `Rota não encontrada: ${method} /api/v1/${segments.join('/')}`);
  } catch (e) {
    if (e instanceof ApiError) return json({ error: { code: e.code, message: e.message } }, e.status);
    console.error('Erro na API:', e);
    return json({ error: { code: 'server_error', message: 'Erro inesperado. Tente novamente.' } }, 500);
  }
}
