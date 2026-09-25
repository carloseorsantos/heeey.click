/**
 * Vercel Function: public health check polled by the uptime monitor (status.heeey.click).
 * All logic lives in src/server/health.ts.
 */
import { createHealthChecks, handleHealth } from '../src/server/health';

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
  return handleHealth(request, createHealthChecks(getEnv()));
}

export default handle;
export const GET = handle;
export const HEAD = handle;
