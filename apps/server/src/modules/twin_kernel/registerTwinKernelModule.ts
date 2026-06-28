// apps/server/src/modules/twin_kernel/registerTwinKernelModule.ts
// Purpose: register Twin Kernel v1 routes, production ingestion routes, explicit formalization routes, operator workflow routes, and read-only trace readback routes.
// Boundary: module registration only; no runtime work is executed during registration.

import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";

import { registerTwinKernelV1Routes } from "../../routes/v1/twin_kernel.js";
import { registerTwinKernelProductionIngestionRoutes } from "../../routes/v1/twin_kernel_production_ingestion.js";
import { registerTwinKernelFormalizationRoutes } from "../../routes/v1/twin_kernel_formalization.js";
import { registerTwinKernelOperatorWorkflowRoutes } from "../../routes/v1/twin_kernel_operator_workflow.js";
import { registerTwinKernelTraceReadModelRoutes } from "../../routes/v1/twin_kernel_trace.js";

export function registerTwinKernelModule(app: FastifyInstance, pool: Pool): void {
  registerTwinKernelV1Routes(app, pool);
  registerTwinKernelProductionIngestionRoutes(app, pool);
  registerTwinKernelFormalizationRoutes(app, pool);
  registerTwinKernelOperatorWorkflowRoutes(app, pool);
  registerTwinKernelTraceReadModelRoutes(app, pool);
}
