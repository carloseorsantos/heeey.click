/**
 * Jev (TypeSafe's System One model) through Vercel AI Gateway's evaluation endpoint.
 * Jev answers typed questions about a state with calibrated probabilities; it does not
 * generate text. Docs: https://vercel.com/docs/ai-gateway/modalities/evaluation
 */

export const AI_GATEWAY_EVALUATE_URL = 'https://ai-gateway.vercel.sh/v1/evaluate';
export const JEV_MODEL = 'typesafe-ai/jev';

export type EvaluationQuestion =
  | { type: 'boolean'; instructions: string; criteria?: { true: string; false: string } }
  | { type: 'choice'; instructions: string; criteria: Record<string, string> }
  | { type: 'score'; instructions: string; criteria: string[] };

export type EvaluationAnswer =
  | { type: 'boolean'; probability: number }
  | { type: 'choice'; choice: string; probabilities: Record<string, number> }
  | { type: 'score'; score: number; probabilities: Record<string, number> };

export interface EvaluateRequest {
  state: unknown;
  questions: Record<string, EvaluationQuestion>;
}

export class JevError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
  }
}

/**
 * Credential for AI Gateway: an API key, or on Vercel the project's OIDC token
 * (sent to functions in the x-vercel-oidc-token header; `vercel env pull` puts it in .env locally).
 */
export function gatewayToken(request: Request, env: Record<string, string | undefined>): string | undefined {
  return env.AI_GATEWAY_API_KEY || request.headers.get('x-vercel-oidc-token') || env.VERCEL_OIDC_TOKEN || undefined;
}

export interface EvaluateOptions {
  /**
   * Make AI Gateway refuse any provider that retains data. Needs a Vercel Pro or
   * Enterprise plan: on Hobby every request fails with 403 when this is set.
   */
  zeroDataRetention?: boolean;
  fetch?: typeof fetch;
}

/** AI_GATEWAY_ZDR=true turns on zeroDataRetention (Vercel Pro/Enterprise only) */
export function zeroDataRetentionEnabled(env: Record<string, string | undefined>): boolean {
  return env.AI_GATEWAY_ZDR === 'true';
}

export async function evaluate(
  token: string,
  body: EvaluateRequest,
  { zeroDataRetention = false, fetch: fetchImpl = fetch }: EvaluateOptions = {}
): Promise<Record<string, EvaluationAnswer>> {
  const res = await fetchImpl(AI_GATEWAY_EVALUATE_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: JEV_MODEL,
      ...body,
      ...(zeroDataRetention && { providerOptions: { gateway: { zeroDataRetention: true } } }),
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new JevError(`AI Gateway ${res.status}: ${detail.slice(0, 200)}`, res.status);
  }
  const data = await res.json();
  return (data?.answers || {}) as Record<string, EvaluationAnswer>;
}
