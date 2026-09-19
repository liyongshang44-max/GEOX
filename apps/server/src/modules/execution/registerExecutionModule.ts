import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";

import { registerHumanExecutorV1Routes } from "../../routes/human_executors_v1.js";
import { registerHumanOpsV1Routes } from "../../routes/human_ops_v1.js";
import { registerControlPlaneV1Routes } from "../../routes/controlplane_v1.js";
import { registerSchedulingConflictV1Routes } from "../../routes/scheduling_conflicts_v1.js";
import { registerAlertsV1Routes } from "../../routes/alerts_v1.js";
import { registerAlertWorkflowV1Routes } from "../../routes/alert_workflow_v1.js";

export const INTERNAL_AUTO_FALLBACK_COMMERCIAL_AUTHORITY_ERROR =
  "INTERNAL_AUTO_FALLBACK_COMMERCIAL_AUTHORITY_UNAVAILABLE";

function registerCommercialHumanExecutorV1Routes(app: FastifyInstance, pool: Pool): void {
  const originalPost = app.post.bind(app) as any;
  const guardedApp = new Proxy(app as any, {
    get(target, property) {
      if (property === "post") {
        return (path: unknown, ...args: unknown[]) => {
          if (path === "/api/internal/work-assignments/auto-fallback") {
            return originalPost(path, async (_req: unknown, reply: any) =>
              reply.code(403).send({
                ok: false,
                error: INTERNAL_AUTO_FALLBACK_COMMERCIAL_AUTHORITY_ERROR,
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

  registerHumanExecutorV1Routes(guardedApp, pool);
}

export function registerExecutionModule(app: FastifyInstance, pool: Pool): void {
  registerCommercialHumanExecutorV1Routes(app, pool);
  registerHumanOpsV1Routes(app, pool);
  registerControlPlaneV1Routes(app, pool);
  registerSchedulingConflictV1Routes(app, pool);
  registerAlertsV1Routes(app, pool);
  registerAlertWorkflowV1Routes(app, pool);
}
