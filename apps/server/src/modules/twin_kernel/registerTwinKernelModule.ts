// apps/server/src/modules/twin_kernel/registerTwinKernelModule.ts
// Purpose: register Twin Kernel v1 routes, production ingestion routes, explicit formalization routes, operator workflow routes, business closure readback routes, and read-only trace readback routes.
// Boundary: module registration only; no runtime work is executed during registration.

import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";

import { registerTwinKernelV1Routes } from "../../routes/v1/twin_kernel.js";
import { registerTwinKernelProductionIngestionRoutes } from "../../routes/v1/twin_kernel_production_ingestion.js";
import { registerTwinKernelFormalizationRoutes } from "../../routes/v1/twin_kernel_formalization.js";
import { registerTwinKernelOperatorWorkflowRoutes } from "../../routes/v1/twin_kernel_operator_workflow.js";
import { registerTwinKernelBusinessClosureRoutes } from "../../routes/v1/twin_kernel_business_closure.js";
import { registerTwinKernelTraceReadModelRoutes } from "../../routes/v1/twin_kernel_trace.js";

const LEGACY_TWIN_BASE_MUTATION_ROUTES = new Set([
  "/api/v1/twin-kernel/field-state-snapshots",
  "/api/v1/twin-kernel/forecast-runs",
  "/api/v1/twin-kernel/scenario-sets",
  "/api/v1/twin-kernel/calibration-replays",
  "/api/v1/twin-kernel/field-learning-candidates",
  "/api/v1/twin-kernel/decision-cycles",
]);

export const LEGACY_TWIN_BASE_MUTATION_COMMERCIAL_AUTHORITY_ERROR =
  "LEGACY_TWIN_BASE_MUTATION_COMMERCIAL_AUTHORITY_UNAVAILABLE";

function registerCommercialTwinKernelV1Routes(app: FastifyInstance, pool: Pool): void {
  const originalPost = app.post.bind(app) as any;
  const guardedApp = new Proxy(app as any, {
    get(target, property) {
      if (property === "post") {
        return (path: unknown, ...args: unknown[]) => {
          const exactPath = typeof path === "string" ? path : "";
          if (LEGACY_TWIN_BASE_MUTATION_ROUTES.has(exactPath)) {
            return originalPost(exactPath, async (_req: unknown, reply: any) =>
              reply.code(403).send({
                ok: false,
                error: LEGACY_TWIN_BASE_MUTATION_COMMERCIAL_AUTHORITY_ERROR,
              }),
            );
          }
          return originalPost(path, ...args);
        };
      }
      const value = Reflect.get(target, property, target);
      return typeof value === "function" ? value.bind(target) : value;
    },
  }) as FastifyInstance;

  registerTwinKernelV1Routes(guardedApp, pool);
}

export function registerTwinKernelModule(app: FastifyInstance, pool: Pool): void {
  registerCommercialTwinKernelV1Routes(app, pool);
  registerTwinKernelProductionIngestionRoutes(app, pool);
  registerTwinKernelFormalizationRoutes(app, pool);
  registerTwinKernelOperatorWorkflowRoutes(app, pool);
  registerTwinKernelBusinessClosureRoutes(app, pool);
  registerTwinKernelTraceReadModelRoutes(app, pool);
}
