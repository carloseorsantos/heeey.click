import { describe, it, expect, vi } from 'vitest';
import { handleMcpRequest, MCP_TOOLS } from '../server/mcpHandler';
import type { Rpc } from '../server/apiHandler';

const ctx = { appOrigin: 'https://heeey.click' };
const BOARD = '10000000-0000-4000-8000-000000000001';

function post(body: unknown, headers: Record<string, string> = { Authorization: 'Bearer hk_test' }) {
  return new Request('https://heeey.click/api/mcp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

const rpcOk = (data: Record<string, any>): Rpc =>
  vi.fn(async (fn: string) => ({ data: data[fn], error: null })) as unknown as Rpc;

describe('handleMcpRequest', () => {
  it('negotiates the protocol version on initialize', async () => {
    const res = await handleMcpRequest(
      post({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 't', version: '1' } } }),
      rpcOk({}),
      ctx
    );
    const body = await res.json();
    expect(body.result.protocolVersion).toBe('2025-03-26');
    expect(body.result.capabilities.tools).toBeDefined();
    expect(body.result.serverInfo.name).toBe('heeey.click');

    const unknown = await (await handleMcpRequest(post({ jsonrpc: '2.0', id: 2, method: 'initialize', params: { protocolVersion: '1999-01-01' } }), rpcOk({}), ctx)).json();
    expect(unknown.result.protocolVersion).toBe('2025-06-18');
  });

  it('acknowledges notifications with 202 and no body', async () => {
    const res = await handleMcpRequest(post({ jsonrpc: '2.0', method: 'notifications/initialized' }), rpcOk({}), ctx);
    expect(res.status).toBe(202);
    expect(await res.text()).toBe('');
  });

  it('lists tools with JSON schemas', async () => {
    const body = await (await handleMcpRequest(post({ jsonrpc: '2.0', id: 3, method: 'tools/list' }), rpcOk({}), ctx)).json();
    const names = body.result.tools.map((t: any) => t.name);
    expect(names).toEqual(expect.arrayContaining(['list_boards', 'get_board', 'create_board', 'add_elements', 'delete_elements', 'search_boards']));
    for (const tool of body.result.tools) expect(tool.inputSchema.type).toBe('object');
    expect(body.result.tools.find((t: any) => t.name === 'get_board').annotations.readOnlyHint).toBe(true);
  });

  it('calls tools and returns text plus structured content', async () => {
    const rpc = rpcOk({ api_create_board: { id: BOARD, title: 'Mapa' } });
    const body = await (
      await handleMcpRequest(
        post({ jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'create_board', arguments: { title: 'Mapa', elements: [{ type: 'rectangle', label: 'Ideia' }] } } }),
        rpc,
        ctx
      )
    ).json();
    expect(body.result.isError).toBeUndefined();
    expect(body.result.structuredContent.board.url).toBe(`https://heeey.click/b/${BOARD}`);
    expect(JSON.parse(body.result.content[0].text).board.title).toBe('Mapa');
    const args = (rpc as any).mock.calls[0][1];
    expect(args.p_key).toBe('hk_test');
    expect(args.p_elements.some((e: any) => e.type === 'rectangle' && e.boundElements?.length === 1)).toBe(true);
  });

  it('reports tool failures as tool results the model can read', async () => {
    const rpc = vi.fn(async () => ({ data: null, error: { message: 'Esta chave de API não tem permissão de escrita.', code: '42501' } })) as unknown as Rpc;
    const body = await (
      await handleMcpRequest(post({ jsonrpc: '2.0', id: 5, method: 'tools/call', params: { name: 'rename_board', arguments: { board_id: BOARD, title: 'x' } } }), rpc, ctx)
    ).json();
    expect(body.result).toMatchObject({ isError: true, content: [{ type: 'text', text: 'Esta chave de API não tem permissão de escrita.' }] });

    const missingArg = await (
      await handleMcpRequest(post({ jsonrpc: '2.0', id: 6, method: 'tools/call', params: { name: 'get_board', arguments: {} } }), rpc, ctx)
    ).json();
    expect(missingArg.result.isError).toBe(true);
  });

  it('uses JSON-RPC errors for protocol problems', async () => {
    const unknownTool = await (await handleMcpRequest(post({ jsonrpc: '2.0', id: 7, method: 'tools/call', params: { name: 'nope' } }), rpcOk({}), ctx)).json();
    expect(unknownTool.error.code).toBe(-32602);
    const unknownMethod = await (await handleMcpRequest(post({ jsonrpc: '2.0', id: 8, method: 'resources/list' }), rpcOk({}), ctx)).json();
    expect(unknownMethod.error.code).toBe(-32601);
    expect((await handleMcpRequest(post('{not json'), rpcOk({}), ctx)).status).toBe(400);
    expect((await handleMcpRequest(post({ hello: 'world' }), rpcOk({}), ctx)).status).toBe(400);
  });

  it('requires the API key and only accepts POST', async () => {
    const res = await handleMcpRequest(post({ jsonrpc: '2.0', id: 9, method: 'ping' }, {}), rpcOk({}), ctx);
    expect(res.status).toBe(401);
    expect(res.headers.get('www-authenticate')).toContain('Bearer');
    expect((await handleMcpRequest(new Request('https://heeey.click/api/mcp'), rpcOk({}), ctx)).status).toBe(405);
  });

  it('answers batches with one response per request', async () => {
    const body = await (
      await handleMcpRequest(post([{ jsonrpc: '2.0', id: 1, method: 'ping' }, { jsonrpc: '2.0', method: 'notifications/initialized' }, { jsonrpc: '2.0', id: 2, method: 'ping' }]), rpcOk({}), ctx)
    ).json();
    expect(body.map((r: any) => r.id)).toEqual([1, 2]);
  });

  it('every tool has a unique name', () => {
    expect(new Set(MCP_TOOLS.map((t) => t.name)).size).toBe(MCP_TOOLS.length);
  });
});
