/**
 * Vercel Cron: daily data retention (see vercel.json "crons").
 * All logic lives in src/server/retention.ts.
 */
import { createPurgeDeps, handlePurge } from '../../src/server/retention';

export const config = {
  runtime: 'edge',
};

declare const process: { env?: Record<string, string | undefined> };

function getEnv(): Record<string, string | undefined> {
  try {
    return typeof process !== 'undefined' && process.env ? process.env : {};
  } catch {
    return {};
  }
}

function handle(request: Request): Promise<Response> {
  const env = getEnv();
  return handlePurge(request, env.CRON_SECRET, createPurgeDeps(env));
}

export default handle;
export const GET = handle;
