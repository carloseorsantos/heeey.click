/**
 * Interoperability: the official MCP TypeScript client talks to our handler over
 * Streamable HTTP (fetch is routed straight to handleMcpRequest).
 */
import { describe, it, expect, vi } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { handleMcpRequest } from '../server/mcpHandler';
import type { Rpc } from '../server/apiHandler';

describe('MCP interop with the official SDK client', () => {
  it('connects, lists tools and calls one', async () => {
    const rpc = vi.fn(async (fn: string) => ({
      data: fn === 'api_list_boards' ? [{ id: '10000000-0000-4000-8000-000000000001', title: 'Roadmap' }] : null,
      error: null,
    })) as unknown as Rpc;

    const transport = new StreamableHTTPClientTransport(new URL('https://heeey.click/api/mcp'), {
      requestInit: { headers: { Authorization: 'Bearer hk_interop' } },
      fetch: (input, init) => handleMcpRequest(new Request(input, init), rpc, { appOrigin: 'https://heeey.click' }),
    });
    const client = new Client({ name: 'interop-test', version: '1.0.0' });
    await client.connect(transport);

    expect(client.getServerVersion()?.name).toBe('heeey.click');
    expect(client.getInstructions()).toContain('Excalidraw');

    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name)).toContain('create_board');

    const result = await client.callTool({ name: 'list_boards', arguments: {} });
    expect(result.isError).toBeFalsy();
    expect((result.structuredContent as any).boards[0]).toMatchObject({ title: 'Roadmap', url: expect.stringContaining('/b/') });
    expect((rpc as any).mock.calls[0][1].p_key).toBe('hk_interop');

    await client.close();
  });
});
