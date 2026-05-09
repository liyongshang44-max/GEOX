import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";

import { registerOperatorV1FacadeRoutes } from "../../routes/v1/operator.js";
import { registerOperatorApprovalActionRoutes } from "../../routes/v1/operator_approval_actions.js";

export function registerOperatorModule(app: FastifyInstance, pool: Pool): void {
  registerOperatorV1FacadeRoutes(app, pool);
  registerOperatorApprovalActionRoutes(app, pool);
}
