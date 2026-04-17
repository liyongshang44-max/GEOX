import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { registerAoSenseLegacyRoutes } from "../control_ao_sense.js";

// AO-SENSE legacy compatibility routes only.
// Do not add new business endpoints here.
export function registerSenseLegacyCompatibilityRoutes(app: FastifyInstance, pool: Pool): void {
  registerAoSenseLegacyRoutes(app, pool);
}
