import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";

import { registerLegacyMonitoringModule } from "../modules/legacy/registerLegacyMonitoringModule.js";
import { registerAoActLegacyCompatibilityRoutes } from "./legacy/ao_act.js";
import { registerApprovalsLegacyCompatibilityRoutes } from "./legacy/approvals.js";
import { registerDevicesLegacyCompatibilityRoutesOnly } from "./legacy/devices.js";
import { registerSenseLegacyCompatibilityRoutes } from "./legacy/sense.js";

type LegacyRouteOptions = {
  mediaDir: string;
};

export const LEGACY_CANOPY_UPLOAD_COMMERCIAL_AUTHORITY_ERROR =
  "LEGACY_CANOPY_UPLOAD_COMMERCIAL_AUTHORITY_UNAVAILABLE";

function registerCommercialLegacyMonitoringModule(
  app: FastifyInstance,
  pool: Pool,
  mediaDir: string,
): void {
  const originalPost = app.post.bind(app) as any;
  const guardedApp = new Proxy(app as any, {
    get(target, property) {
      if (property === "post") {
        return (path: unknown, ...args: unknown[]) => {
          if (path === "/api/canopy/upload") {
            return originalPost(path, async (_req: unknown, reply: any) =>
              reply.code(403).send({
                ok: false,
                error: LEGACY_CANOPY_UPLOAD_COMMERCIAL_AUTHORITY_ERROR,
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

  registerLegacyMonitoringModule(guardedApp, pool, mediaDir);
}

export function registerLegacyRoutes(app: FastifyInstance, pool: Pool, options: LegacyRouteOptions): void {
  registerAoActLegacyCompatibilityRoutes(app, pool);
  registerApprovalsLegacyCompatibilityRoutes(app, pool);
  registerDevicesLegacyCompatibilityRoutesOnly(app, pool);
  registerSenseLegacyCompatibilityRoutes(app, pool);
  registerCommercialLegacyMonitoringModule(app, pool, options.mediaDir);
}
