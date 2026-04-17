import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { registerAoSenseV1Routes } from "../control_ao_sense.js";

// AO-SENSE v1 primary routes.
// New business endpoints must be registered here, not under legacy prefixes.
export function registerSenseV1PrimaryRoutes(app: FastifyInstance, pool: Pool): void {
  registerAoSenseV1Routes(app, pool);
}
