/**
 * POST /api/ai-search: finds the signed-in user's boards that are about a query even when
 * they share no words with it ("planejamento Q3" → "Roadmap julho–setembro").
 * The keyword search runs first in the browser; this only ranks the remaining boards.
 */
import type { Rpc } from './apiHandler';
import { evaluate, EvaluationQuestion, JevError } from './jev';

export const MAX_QUERY_LENGTH = 200;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const MAX_CANDIDATES = 40;
export const MAX_RESULTS = 8;
/** Probability above which Jev's "this board is relevant" answer counts as a hit */
export const RELEVANCE_THRESHOLD = 0.5;

export interface SemanticSearchDeps {
  /** Supabase rpc scoped to the caller's session (auth.uid() = the user) */
  rpc: Rpc;
  /** AI Gateway credential; undefined when the deployment has none */
  gatewayToken: string | undefined;
  /** Require zero data retention at the provider (Vercel Pro/Enterprise only) */
  zeroDataRetention?: boolean;
  fetch?: typeof fetch;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

const fail = (status: number, code: string, message: string) => json({ error: { code, message } }, status);

/** One yes/no question per board, all answered against the same state in a single call */
export function buildQuestions(boardKeys: readonly string[]): Record<string, EvaluationQuestion> {
  const questions: Record<string, EvaluationQuestion> = {};
  for (const key of boardKeys) {
    questions[key] = {
      type: 'boolean',
      instructions: `Is the whiteboard boards.${key} about what the user searched for in "query"? Compare meaning, not exact words: the query and the board may use synonyms, abbreviations or different languages.`,
      criteria: {
        true: `the title or text of boards.${key} covers the topic, project or thing named in the query`,
        false: `boards.${key} is about something else, or has too little text to tell`,
      },
    };
  }
  return questions;
}

export async function handleSemanticSearch(request: Request, deps: SemanticSearchDeps): Promise<Response> {
  if (request.method !== 'POST') return fail(405, 'method_not_allowed', 'Use POST.');
  if (!/^Bearer\s+\S+/i.test(request.headers.get('Authorization') || '')) {
    return fail(401, 'unauthorized', 'Sign in to use semantic search.');
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return fail(400, 'bad_request', 'Body must be JSON.');
  }
  const query = typeof body?.query === 'string' ? body.query.trim() : '';
  if (!query || query.length > MAX_QUERY_LENGTH) {
    return fail(400, 'bad_request', `query must have 1–${MAX_QUERY_LENGTH} characters.`);
  }
  const exclude = new Set<string>(Array.isArray(body.exclude) ? body.exclude.filter((id: unknown) => typeof id === 'string') : []);
  // Optional: only that team's boards (search_candidates checks the caller is a member)
  const teamId = typeof body.team_id === 'string' && UUID.test(body.team_id) ? body.team_id : null;

  if (!deps.gatewayToken) return fail(503, 'not_configured', 'Semantic search is not configured.');

  const { data, error } = await deps.rpc('search_candidates', { p_limit: MAX_CANDIDATES, ...(teamId ? { p_team_id: teamId } : {}) });
  if (error) return fail(502, 'upstream_error', 'Could not load boards.');
  const candidates = ((data || []) as any[]).filter((row) => !exclude.has(row.id));
  if (candidates.length === 0) return json({ results: [] });

  // Short keys keep the state small; Jev reads boards.bN by name
  const keys = candidates.map((_, i) => `b${i}`);
  const boards: Record<string, { title: string; text: string }> = {};
  candidates.forEach((row, i) => {
    boards[keys[i]] = { title: row.title || '', text: row.content || '' };
  });

  let answers;
  try {
    answers = await evaluate(
      deps.gatewayToken,
      { state: { query, boards }, questions: buildQuestions(keys) },
      { zeroDataRetention: deps.zeroDataRetention, fetch: deps.fetch }
    );
  } catch (e) {
    const status = e instanceof JevError && e.status === 429 ? 429 : 502;
    return fail(status, status === 429 ? 'rate_limited' : 'upstream_error', 'Semantic search is unavailable right now.');
  }

  const results = candidates
    .map((row, i) => {
      const answer = answers[keys[i]];
      return { ...row, relevance: answer?.type === 'boolean' ? answer.probability : 0 };
    })
    .filter((row) => row.relevance > RELEVANCE_THRESHOLD)
    .sort((a, b) => b.relevance - a.relevance)
    .slice(0, MAX_RESULTS);

  return json({ results });
}
