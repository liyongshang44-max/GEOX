import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";

import { registerFieldMemoryV1Routes } from "../../routes/field_memory_v1.js";

export function registerFieldMemoryModule(app: FastifyInstance, pool: Pool): void {
  registerFieldMemoryV1Routes(app, pool);
}
