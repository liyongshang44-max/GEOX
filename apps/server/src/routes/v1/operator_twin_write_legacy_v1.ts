// Purpose: preserve the two legacy scenario-to-recommendation POST routes through an independent physical registration module.
// Boundary: only POST handlers are registered on the real Fastify instance; no Proxy, no GET registration, and no canonical MCFT `/runtime` route.

import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { registerOperatorTwinReadRoutes as collectLegacyOperatorTwinHandlersV1 } from "./operator_twin.js";

const LEGACY_POST_PATHS_V1 = [
  "/api/v1/operator/twin/fields/:field_id/root-zone-scenarios/:scenario_set_id/options/:option_id/submit-recommendation",
  "/api/v1/operator/twin/fields/:field_id/scenarios/:scenario_set_id/options/:option_id/submit-recommendation",
] as const;

function capturePostHandlersV1(pool: Pool): ReadonlyMap<string, unknown> {
  const handlers = new Map<string, unknown>();
  const collector = {
    get() { return collector; },
    post(path: string, handler: unknown) { handlers.set(path, handler); return collector; },
  } as unknown as FastifyInstance;
  collectLegacyOperatorTwinHandlersV1(collector, pool);
  return handlers;
}

export function registerOperatorTwinWriteLegacyRoutesV1(app: FastifyInstance, pool: Pool): void {
  const handlers = capturePostHandlersV1(pool);
  for (const path of LEGACY_POST_PATHS_V1) {
    const handler = handlers.get(path);
    if (!handler) throw new Error(`LEGACY_OPERATOR_TWIN_POST_HANDLER_MISSING:${path}`);
    app.post(path, handler as Parameters<FastifyInstance["post"]>[1]);
  }
  if (handlers.size !== LEGACY_POST_PATHS_V1.length) throw new Error("LEGACY_OPERATOR_TWIN_POST_INVENTORY_DIVERGENCE");
}
