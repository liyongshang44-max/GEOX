// Purpose: preserve the eight legacy Operator Twin GET routes through an independent physical registration module.
// Boundary: only GET handlers are registered on the real Fastify instance; no Proxy, no POST registration, and no canonical MCFT `/runtime` route.

import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { registerOperatorTwinReadRoutes as collectLegacyOperatorTwinHandlersV1 } from "./operator_twin.js";

const LEGACY_GET_PATHS_V1 = [
  "/api/v1/operator/twin",
  "/api/v1/operator/twin/source-indexes",
  "/api/v1/operator/twin/fields/:field_id",
  "/api/v1/operator/twin/fields/:field_id/post-irrigation",
  "/api/v1/operator/twin/fields/:field_id/calibration",
  "/api/v1/operator/twin/fields/:field_id/evidence",
  "/api/v1/operator/twin/fields/:field_id/forecast",
  "/api/v1/operator/twin/fields/:field_id/scenarios",
] as const;

function captureGetHandlersV1(pool: Pool): ReadonlyMap<string, unknown> {
  const handlers = new Map<string, unknown>();
  const collector = {
    get(path: string, handler: unknown) { handlers.set(path, handler); return collector; },
    post() { return collector; },
  } as unknown as FastifyInstance;
  collectLegacyOperatorTwinHandlersV1(collector, pool);
  return handlers;
}

export function registerOperatorTwinReadLegacyRoutesV1(app: FastifyInstance, pool: Pool): void {
  const handlers = captureGetHandlersV1(pool);
  for (const path of LEGACY_GET_PATHS_V1) {
    const handler = handlers.get(path);
    if (!handler) throw new Error(`LEGACY_OPERATOR_TWIN_GET_HANDLER_MISSING:${path}`);
    app.get(path, handler as Parameters<FastifyInstance["get"]>[1]);
  }
  if (handlers.size !== LEGACY_GET_PATHS_V1.length) throw new Error("LEGACY_OPERATOR_TWIN_GET_INVENTORY_DIVERGENCE");
}
