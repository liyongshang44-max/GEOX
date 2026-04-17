import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { registerAoActV1Routes } from "../control_ao_act.js";

// AO-ACT v1 primary routes.
// New business endpoints must be registered here, not under legacy prefixes.
export function registerAoActV1PrimaryRoutes(app: FastifyInstance, pool: Pool): void {
  registerAoActV1Routes(app, pool);
}
