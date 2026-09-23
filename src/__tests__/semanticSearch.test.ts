import { describe, it, expect, vi } from 'vitest';
import { handleSemanticSearch, buildQuestions, MAX_RESULTS } from '../server/semanticSearch';
import { AI_GATEWAY_EVALUATE_URL, JEV_MODEL, gatewayToken, zeroDataRetentionEnabled } from '../server/jev';
import type { Rpc } from '../server/apiHandler';

const board = (id: string, title: string, content = '') => ({ id, title, content, updated_at: '2026-09-23T00:00:00Z' });

function request(body: unknown, headers: Record<string, string> = { Authorization: 'Bearer user-jwt' }, method = 'POST') {
  return new Request('https://heeey.click/api/ai-search', {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: method === 'POST' ? JSON.stringify(body) : undefined,
  });
}

const rpcWith = (rows: unknown[] | Error) =>
  vi.fn(async () => (rows instanceof Error ? { data: null, error: { message: rows.message } } : { data: rows, error: null })) as unknown as Rpc &
    ReturnType<typeof vi.fn>;

/** Fake AI Gateway: answers each boolean question with the given probability */
function gateway(probabilities: Record<string, number>, status = 200) {
  return vi.fn(async (_url: string, init: RequestInit) => {
    if (status !== 200) return new Response('nope', { status });
    const { questions } = JSON.parse(String(init.body));
    const answers = Object.fromEntries(
      Object.keys(questions).map((key) => [key, { type: 'boolean', probability: probabilities[key] ?? 0 }])
    );
    return Response.json({ model: JEV_MODEL, answers, usage: { inputTokens: 10, outputTokens: 1 } });
  }) as unknown as typeof fetch & ReturnType<typeof vi.fn>;
}

describe('handleSemanticSearch', () => {
  it('asks Jev one question per candidate in a single gateway call and ranks by probability', async () => {
    const rpc = rpcWith([board('a', 'Roadmap julho–setembro', 'metas do trimestre'), board('b', 'Receitas'), board('c', 'OKRs Q3')]);
    const fetchImpl = gateway({ b0: 0.9, b1: 0.02, b2: 0.97 });
    const res = await handleSemanticSearch(request({ query: 'planejamento Q3' }), { rpc, gatewayToken: 'gw', fetch: fetchImpl });

    expect(res.status).toBe(200);
    const { results } = await res.json();
    expect(results.map((r: any) => r.id)).toEqual(['c', 'a']);
    expect(results[0].relevance).toBe(0.97);

    expect(rpc).toHaveBeenCalledWith('search_candidates', { p_limit: 40 });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe(AI_GATEWAY_EVALUATE_URL);
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer gw');
    const sent = JSON.parse(String(init.body));
    expect(sent.model).toBe('typesafe-ai/jev');
    expect(sent.providerOptions).toBeUndefined();
    expect(sent.state).toEqual({
      query: 'planejamento Q3',
      boards: {
        b0: { title: 'Roadmap julho–setembro', text: 'metas do trimestre' },
        b1: { title: 'Receitas', text: '' },
        b2: { title: 'OKRs Q3', text: '' },
      },
    });
    expect(Object.keys(sent.questions)).toEqual(['b0', 'b1', 'b2']);
  });

  it('requires zero data retention only when enabled (Vercel Pro/Enterprise)', async () => {
    const fetchImpl = gateway({});
    await handleSemanticSearch(request({ query: 'q' }), {
      rpc: rpcWith([board('a', 'A')]),
      gatewayToken: 'gw',
      zeroDataRetention: true,
      fetch: fetchImpl,
    });
    expect(JSON.parse(String(fetchImpl.mock.calls[0][1].body)).providerOptions).toEqual({ gateway: { zeroDataRetention: true } });
    expect(zeroDataRetentionEnabled({ AI_GATEWAY_ZDR: 'true' })).toBe(true);
    expect(zeroDataRetentionEnabled({})).toBe(false);
  });

  it('skips boards the keyword search already found, and does not call Jev when none are left', async () => {
    const fetchImpl = gateway({});
    const res = await handleSemanticSearch(request({ query: 'x', exclude: ['a'] }), {
      rpc: rpcWith([board('a', 'A')]),
      gatewayToken: 'gw',
      fetch: fetchImpl,
    });
    expect(await res.json()).toEqual({ results: [] });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it(`returns at most ${MAX_RESULTS} results`, async () => {
    const rows = Array.from({ length: 12 }, (_, i) => board(`id${i}`, `T${i}`));
    const all = Object.fromEntries(rows.map((_, i) => [`b${i}`, 0.9]));
    const res = await handleSemanticSearch(request({ query: 'q' }), { rpc: rpcWith(rows), gatewayToken: 'gw', fetch: gateway(all) });
    expect((await res.json()).results).toHaveLength(MAX_RESULTS);
  });

  it('validates the request', async () => {
    const deps = { rpc: rpcWith([]), gatewayToken: 'gw', fetch: gateway({}) };
    expect((await handleSemanticSearch(request({ query: 'q' }, {}, 'POST'), deps)).status).toBe(401);
    expect((await handleSemanticSearch(request(undefined, undefined, 'GET'), deps)).status).toBe(405);
    expect((await handleSemanticSearch(request({ query: '  ' }), deps)).status).toBe(400);
    expect((await handleSemanticSearch(request({ query: 'x'.repeat(201) }), deps)).status).toBe(400);
  });

  it('reports a missing gateway credential and upstream failures', async () => {
    const rows = [board('a', 'A')];
    const notConfigured = await handleSemanticSearch(request({ query: 'q' }), { rpc: rpcWith(rows), gatewayToken: undefined });
    expect(notConfigured.status).toBe(503);

    const rateLimited = await handleSemanticSearch(request({ query: 'q' }), { rpc: rpcWith(rows), gatewayToken: 'gw', fetch: gateway({}, 429) });
    expect(rateLimited.status).toBe(429);

    const down = await handleSemanticSearch(request({ query: 'q' }), { rpc: rpcWith(rows), gatewayToken: 'gw', fetch: gateway({}, 500) });
    expect(down.status).toBe(502);

    const dbError = await handleSemanticSearch(request({ query: 'q' }), { rpc: rpcWith(new Error('boom')), gatewayToken: 'gw' });
    expect(dbError.status).toBe(502);
  });
});

describe('buildQuestions', () => {
  it('builds a boolean question per board key that points at that board', () => {
    const questions = buildQuestions(['b0', 'b1']);
    expect(Object.keys(questions)).toEqual(['b0', 'b1']);
    expect(questions.b1.type).toBe('boolean');
    expect(questions.b1.instructions).toContain('boards.b1');
  });
});

describe('gatewayToken', () => {
  const req = (headers: Record<string, string> = {}) => new Request('https://heeey.click/api/ai-search', { headers });

  it('prefers an API key, then the OIDC header Vercel sends, then the pulled OIDC env var', () => {
    expect(gatewayToken(req({ 'x-vercel-oidc-token': 'oidc-h' }), { AI_GATEWAY_API_KEY: 'key' })).toBe('key');
    expect(gatewayToken(req({ 'x-vercel-oidc-token': 'oidc-h' }), { VERCEL_OIDC_TOKEN: 'oidc-e' })).toBe('oidc-h');
    expect(gatewayToken(req(), { VERCEL_OIDC_TOKEN: 'oidc-e' })).toBe('oidc-e');
    expect(gatewayToken(req(), {})).toBeUndefined();
  });
});
