import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";

import { registerOperatorV1FacadeRoutes } from "../../routes/v1/operator.js";

export function registerOperatorModule(app: FastifyInstance, _pool: Pool): void {
  registerOperatorV1FacadeRoutes(app);
}
