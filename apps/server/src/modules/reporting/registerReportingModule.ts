import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";

import { registerOperationStateV1Routes } from "../../routes/operation_state_v1.js";
import { registerReportsV1Routes } from "../../routes/reports_v1.js";
import { registerReportsDashboardV1Routes } from "../../routes/reports_dashboard_v1.js";
import { registerDashboardV1Routes } from "../../routes/dashboard_v1.js";
import { registerCustomerV1Routes } from "../../routes/customer_v1.js";
import { registerOperationReportChainHookV1 } from "../../routes/operation_report_chain_hook_v1.js";
import { registerFieldReportSemanticsHookV1 } from "../../routes/field_report_semantics_hook_v1.js";
import { registerCustomerScopeResponseHookV1 } from "../../routes/customer_scope_response_hook_v1.js";

export function registerReportingModule(app: FastifyInstance, pool: Pool): void {
  registerOperationReportChainHookV1(app, pool);
  registerFieldReportSemanticsHookV1(app, pool);
  registerCustomerScopeResponseHookV1(app);
  registerOperationStateV1Routes(app, pool);
  registerReportsV1Routes(app, pool);
  registerReportsDashboardV1Routes(app, pool);
  registerDashboardV1Routes(app, pool);
  registerCustomerV1Routes(app, pool);
}
