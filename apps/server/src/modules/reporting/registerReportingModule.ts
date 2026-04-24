import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";

import { registerOperationStateV1Routes } from "../../routes/operation_state_v1.js";
import { registerReportsV1Routes } from "../../routes/reports_v1.js";
import { registerReportsDashboardV1Routes } from "../../routes/reports_dashboard_v1.js";
import { registerDashboardV1Routes } from "../../routes/dashboard_v1.js";

export function registerReportingModule(app: FastifyInstance, pool: Pool): void {
  registerOperationStateV1Routes(app, pool);
  registerReportsV1Routes(app, pool);
  registerReportsDashboardV1Routes(app, pool);
  registerDashboardV1Routes(app, pool);
}
