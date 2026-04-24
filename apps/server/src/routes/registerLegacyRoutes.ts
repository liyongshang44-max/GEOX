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

export function registerLegacyRoutes(app: FastifyInstance, pool: Pool, options: LegacyRouteOptions): void {
  registerAoActLegacyCompatibilityRoutes(app, pool);
  registerApprovalsLegacyCompatibilityRoutes(app, pool);
  registerDevicesLegacyCompatibilityRoutesOnly(app, pool);
  registerSenseLegacyCompatibilityRoutes(app, pool);
  registerLegacyMonitoringModule(app, pool, options.mediaDir);
}
