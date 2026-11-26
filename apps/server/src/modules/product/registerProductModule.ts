import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";

import { registerProductV1Routes } from "../../routes/product_v1.js";

export function registerProductModule(app: FastifyInstance, pool: Pool): void {
  registerProductV1Routes(app, pool);
}
