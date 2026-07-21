import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";

import { registerOperatorV1FacadeRoutes } from "../../routes/v1/operator.js";
import { registerOperatorApprovalReadRoutes } from "../../routes/v1/operator_approval_read.js";
import { registerOperatorApprovalActionRoutes } from "../../routes/v1/operator_approval_actions.js";
import { registerOperatorAcceptanceActionRoutes } from "../../routes/v1/operator_acceptance_actions.js";
import { registerOperatorDispatchActionRoutes } from "../../routes/v1/operator_dispatch_actions.js";
import { registerOperatorLearningValidationRoutes } from "../../routes/v1/operator_learning_validation.js";
import { registerOperatorDeviceOfflineActionRoutes } from "../../routes/v1/operator_device_offline_actions.js";
import { registerOperatorTwinReadLegacyRoutesV1 } from "../../routes/v1/operator_twin_read_legacy_v1.js";
import { registerOperatorTwinWriteLegacyRoutesV1 } from "../../routes/v1/operator_twin_write_legacy_v1.js";
import { registerMcftFieldTwinReadRoutesV1 } from "../../routes/v1/mcft_field_twin_read_v1.js";
import { installMcftFieldTwinReadOpenApiV1 } from "../../routes/openapi_mcft_field_twin_read_v1.js";
import { PostgresMcftFieldTwinS4ReadApiV1 } from "../../services/mcft_field_twin_s4_read_api_v1.js";
import { registerOperatorEvidenceTwinReadRoutes } from "../../routes/v1/operator_evidence_twin.js";
import { registerOperatorTwinH31H45ClosureRoutes } from "../../routes/v1/operator_twin_h31_h45_closure.js";
import { registerOperationPlanV1Routes } from "../../routes/control_operation_plan_v1.js";

export function registerOperatorModule(app: FastifyInstance, pool: Pool): void {
  installMcftFieldTwinReadOpenApiV1();
  registerOperatorV1FacadeRoutes(app, pool);
  registerOperatorApprovalReadRoutes(app, pool);
  registerOperatorApprovalActionRoutes(app, pool);
  registerOperatorAcceptanceActionRoutes(app, pool);
  registerOperatorDispatchActionRoutes(app, pool);
  registerOperatorLearningValidationRoutes(app, pool);
  registerOperatorDeviceOfflineActionRoutes(app, pool);
  registerOperatorTwinReadLegacyRoutesV1(app, pool);
  registerOperatorTwinWriteLegacyRoutesV1(app, pool);
  registerMcftFieldTwinReadRoutesV1(app, pool, { readApi: new PostgresMcftFieldTwinS4ReadApiV1(pool) });
  registerOperatorEvidenceTwinReadRoutes(app, pool);
  registerOperatorTwinH31H45ClosureRoutes(app, pool);
  registerOperationPlanV1Routes(app, pool);
}
