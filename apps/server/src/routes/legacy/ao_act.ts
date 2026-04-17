import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { registerAoActLegacyRoutes } from "../control_ao_act.js";

// AO-ACT legacy compatibility routes only.
// Do not add new business endpoints here.
export function registerAoActLegacyCompatibilityRoutes(app: FastifyInstance, pool: Pool): void {
  registerAoActLegacyRoutes(app, pool);
}
