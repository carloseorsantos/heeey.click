import { describe, it, expect, vi } from 'vitest';
import { handleApiRequest, Rpc } from '../server/apiHandler';

const ctx = { appOrigin: 'https://heeey.click' };
const BOARD = '10000000-0000-4000-8000-000000000001';
const KEY = 'hk_12345678_secret';

function request(method: string, path: string, body?: unknown, headers: Record<string, string> = { Authorization: `Bearer ${KEY}` }) {
  return new Request(`https://heeey.click${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function mockRpc(results: Record<string, any>) {
  return vi.fn(async (fn: string) => {
    const result = results[fn];
    if (result instanceof Error) return { data: null, error: { message: result.message, code: (result as any).code } };
    return { data: result, error: null };
  }) as unknown as Rpc & ReturnType<typeof vi.fn>;
}

const error = (message: string, code: string) => Object.assign(new Error(message), { code });

describe('handleApiRequest', () => {
  it('describes the API at the index without a key', async () => {
    const res = await handleApiRequest(request('GET', '/api/v1', undefined, {}), mockRpc({}), ctx);
    expect(res.status).toBe(200);
    expect((await res.json()).version).toBe('v1');
  });

  it('requires an API key', async () => {
    const res = await handleApiRequest(request('GET', '/api/v1/boards', undefined, {}), mockRpc({}), ctx);
    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe('unauthorized');
  });

  it('lists boards with links, passing the key and query params (also via the Vercel rewrite)', async () => {
    const rpc = mockRpc({ api_list_boards: [{ id: BOARD, title: 'A' }] });
    const res = await handleApiRequest(request('GET', `/api/v1?path=boards&limit=5`), rpc, ctx);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ boards: [{ id: BOARD, title: 'A', url: `https://heeey.click/b/${BOARD}` }] });
    expect(rpc).toHaveBeenCalledWith('api_list_boards', {
      p_key: KEY,
      p_project_id: null,
      p_team_id: null,
      p_folder_id: null,
      p_include_trashed: false,
      p_limit: 5,
      p_offset: 0,
    });
  });

  it('accepts the key in X-API-Key too', async () => {
    const rpc = mockRpc({ api_list_folders: [] });
    const res = await handleApiRequest(request('GET', '/api/v1/folders', undefined, { 'X-API-Key': KEY }), rpc, ctx);
    expect(res.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith('api_list_folders', { p_key: KEY, p_project_id: null });
  });

  it('lists the projects the key reaches and creates boards in a project', async () => {
    const PROJECT = '30000000-0000-4000-8000-000000000001';
    const rpc = mockRpc({ api_list_projects: [{ id: PROJECT, name: 'Geral' }], api_create_board: { id: BOARD, title: 'X' } });
    const listed = await handleApiRequest(request('GET', '/api/v1/projects'), rpc, ctx);
    expect(await listed.json()).toEqual({ projects: [{ id: PROJECT, name: 'Geral' }] });

    const created = await handleApiRequest(request('POST', '/api/v1/boards', { title: 'X', project_id: PROJECT }), rpc, ctx);
    expect(created.status).toBe(201);
    expect(rpc).toHaveBeenCalledWith('api_create_board', expect.objectContaining({ p_project_id: PROJECT }));

    const invalid = await handleApiRequest(request('POST', '/api/v1/boards', { title: 'X', project_id: 'nope' }), rpc, ctx);
    expect(invalid.status).toBe(400);
  });

  it('creates boards from element specs, normalized into Excalidraw elements', async () => {
    const rpc = mockRpc({ api_create_board: { id: BOARD, title: 'Fluxo' } });
    const res = await handleApiRequest(
      request('POST', '/api/v1/boards', { title: 'Fluxo', elements: [{ id: 'a', type: 'rectangle', label: 'Início' }] }),
      rpc,
      ctx
    );
    expect(res.status).toBe(201);
    const args = (rpc as any).mock.calls[0][1];
    expect(args.p_title).toBe('Fluxo');
    expect(args.p_elements.map((e: any) => e.id)).toEqual(['a-label', 'a']);
    expect(args.p_elements[1]).toMatchObject({ type: 'rectangle', version: 1, boundElements: [{ type: 'text', id: 'a-label' }] });
  });

  it('binds new arrows to shapes already on the board when patching', async () => {
    const rpc = mockRpc({
      api_get_board: { id: BOARD, elements: [{ id: 'old', type: 'rectangle', x: 0, y: 0, width: 100, height: 100, version: 3 }] },
      api_update_board: { id: BOARD, title: 'x' },
    });
    const res = await handleApiRequest(
      request('PATCH', `/api/v1/boards/${BOARD}`, {
        elements: [
          { id: 'new', type: 'ellipse', x: 400, y: 0 },
          { id: 'edge', type: 'arrow', start: { id: 'old' }, end: { id: 'new' } },
        ],
        delete_element_ids: ['gone'],
      }),
      rpc,
      ctx
    );
    expect(res.status).toBe(200);
    const update = (rpc as any).mock.calls.find((c: any[]) => c[0] === 'api_update_board')[1];
    const ids = update.p_elements.map((e: any) => e.id);
    expect(ids).toEqual(expect.arrayContaining(['new', 'edge', 'old']));
    expect(update.p_delete_element_ids).toEqual(['gone']);
  });

  it('maps database errors to HTTP statuses', async () => {
    const cases: [Error, number][] = [
      [error('Chave de API inválida ou revogada.', '28000'), 401],
      [error('Esta chave de API não tem permissão de escrita.', '42501'), 403],
      [error('Quadro não encontrado.', 'P0002'), 404],
      [error('Quadro na lixeira é somente leitura.', 'P0001'), 409],
      [error('boom', 'XX000'), 500],
    ];
    for (const [err, status] of cases) {
      const res = await handleApiRequest(request('DELETE', `/api/v1/boards/${BOARD}`), mockRpc({ api_trash_board: err }), ctx);
      expect(res.status).toBe(status);
    }
  });

  it('validates input before calling the database', async () => {
    const rpc = mockRpc({});
    expect((await handleApiRequest(request('GET', '/api/v1/boards/not-a-uuid'), rpc, ctx)).status).toBe(400);
    expect((await handleApiRequest(request('POST', '/api/v1/boards', { elements: 'x' }), rpc, ctx)).status).toBe(400);
    expect((await handleApiRequest(request('POST', '/api/v1/folders', {}), rpc, ctx)).status).toBe(400);
    expect((await handleApiRequest(request('GET', '/api/v1/search'), rpc, ctx)).status).toBe(400);
    expect((await handleApiRequest(request('GET', '/api/v1/nope'), rpc, ctx)).status).toBe(404);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('answers CORS preflight', async () => {
    const res = await handleApiRequest(new Request('https://heeey.click/api/v1/boards', { method: 'OPTIONS' }), mockRpc({}), ctx);
    expect(res.status).toBe(204);
    expect(res.headers.get('access-control-allow-headers')).toContain('Authorization');
  });
});
