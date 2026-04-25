import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";

import { registerAsExecutedV1Routes } from "../../routes/as_executed_v1.js";

export function registerAsExecutedModule(app: FastifyInstance, pool: Pool): void {
  registerAsExecutedV1Routes(app, pool);
}
