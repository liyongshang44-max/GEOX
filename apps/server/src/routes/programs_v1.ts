import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { registerProgramsReadV1Routes } from "./programs_read_v1.js";
import { registerProgramsWriteV1Routes } from "./programs_write_v1.js";

export const SUPPORTED_CROP_MODELS = ["corn", "tomato"] as const;

// Route composition layer only.
export function registerProgramsV1Routes(app: FastifyInstance, pool: Pool): void {
  registerProgramsWriteV1Routes(app, pool);
  registerProgramsReadV1Routes(app, pool);
}
