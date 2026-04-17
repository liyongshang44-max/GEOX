import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { registerProgramsCoreV1Routes } from "./programs_core_v1.js";

export function registerProgramsWriteV1Routes(app: FastifyInstance, pool: Pool): void {
  registerProgramsCoreV1Routes(app, pool, { read: false, write: true });
}
