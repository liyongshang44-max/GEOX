import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { registerProgramsReadV1Routes } from "./programs_read_v1";
import { registerProgramsWriteV1Routes } from "./programs_write_v1";

// Route composition layer only.
export function registerProgramsV1Routes(app: FastifyInstance, pool: Pool): void {
  registerProgramsWriteV1Routes(app, pool);
  registerProgramsReadV1Routes(app, pool);
}
