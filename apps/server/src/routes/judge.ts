// apps/server/src/routes/judge.ts

import type { FastifyInstance } from "fastify"; // Fastify instance type for route registration.

/**
 * Register Judge routes for the API server.
 *
 * Governance / safety notes:
 * - Default behavior is NO-OP (no new externally visible endpoints).
 * - This file exists mainly to satisfy server.ts require("./routes/judge").
 * - Any future endpoints added here must preserve:
 *   - append-only discipline (reads only, no writes),
 *   - non-enumerability (no existence leakage),
 *   - no cross-tenant leakage (must rely on authz + token context).
 */
export function registerJudgeRoutes(
  ...args: any[] // Accept any signature to remain compatible with server.ts call-site.
): void {
  const app = args[0] as FastifyInstance | undefined; // The Fastify app instance is expected as first arg.

  // If server.ts called us without a Fastify instance, do nothing (safe no-op).
  if (!app) return;

  // Intentionally register NOTHING here.
}
