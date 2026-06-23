import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";

import { registerOperatorV1FacadeRoutes } from "../../routes/v1/operator.js";
import { registerOperatorApprovalReadRoutes } from "../../routes/v1/operator_approval_read.js";
import { registerOperatorApprovalActionRoutes } from "../../routes/v1/operator_approval_actions.js";
import { registerOperatorAcceptanceActionRoutes } from "../../routes/v1/operator_acceptance_actions.js";
import { registerOperatorDispatchActionRoutes } from "../../routes/v1/operator_dispatch_actions.js";
import { registerOperatorLearningValidationRoutes } from "../../routes/v1/operator_learning_validation.js";
import { registerOperatorDeviceOfflineActionRoutes } from "../../routes/v1/operator_device_offline_actions.js";
import { registerOperatorTwinReadRoutes } from "../../routes/v1/operator_twin.js";
import { registerOperatorTwinH31H45ClosureRoutes } from "../../routes/v1/operator_twin_h31_h45_closure.js";
import { registerOperationPlanV1Routes } from "../../routes/control_operation_plan_v1.js";

export function registerOperatorModule(app: FastifyInstance, pool: Pool): void {
  registerOperatorV1FacadeRoutes(app, pool);
  registerOperatorApprovalReadRoutes(app, pool);
  registerOperatorApprovalActionRoutes(app, pool);
  registerOperatorAcceptanceActionRoutes(app, pool);
  registerOperatorDispatchActionRoutes(app, pool);
  registerOperatorLearningValidationRoutes(app, pool);
  registerOperatorDeviceOfflineActionRoutes(app, pool);
  registerOperatorTwinReadRoutes(app, pool);
  registerOperatorTwinH31H45ClosureRoutes(app, pool);
  registerOperationPlanV1Routes(app, pool);
}
