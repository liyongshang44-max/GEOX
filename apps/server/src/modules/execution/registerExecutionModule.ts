import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";

import { registerAoActV1PrimaryRoutes } from "../../routes/v1/ao_act.js";
import { registerApprovalsV1PrimaryRoutes } from "../../routes/v1/approvals.js";
import { registerHumanExecutorV1Routes } from "../../routes/human_executors_v1.js";
import { registerHumanOpsV1Routes } from "../../routes/human_ops_v1.js";
import { registerControlPlaneV1Routes } from "../../routes/controlplane_v1.js";
import { registerSchedulingConflictV1Routes } from "../../routes/scheduling_conflicts_v1.js";
import { registerAlertsV1Routes } from "../../routes/alerts_v1.js";
import { registerAlertWorkflowV1Routes } from "../../routes/alert_workflow_v1.js";

export function registerExecutionModule(app: FastifyInstance, pool: Pool): void {
  registerAoActV1PrimaryRoutes(app, pool);
  registerApprovalsV1PrimaryRoutes(app, pool);
  registerHumanExecutorV1Routes(app, pool);
  registerHumanOpsV1Routes(app, pool);
  registerControlPlaneV1Routes(app, pool);
  registerSchedulingConflictV1Routes(app, pool);
  registerAlertsV1Routes(app, pool);
  registerAlertWorkflowV1Routes(app, pool);
}
