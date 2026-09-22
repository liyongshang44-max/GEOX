import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";

import { registerProductCustomerV1Routes } from "../../routes/product_customer_v1.js";

export function registerProductModule(app: FastifyInstance, pool: Pool): void {
  registerProductCustomerV1Routes(app, pool);
}
