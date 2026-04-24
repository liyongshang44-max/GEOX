import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";

import { registerAoActLegacyCompatibilityRoutes } from "./legacy/ao_act.js";
import { registerApprovalsLegacyCompatibilityRoutes } from "./legacy/approvals.js";
import { registerDevicesLegacyCompatibilityRoutesOnly } from "./legacy/devices.js";
import { registerSenseLegacyCompatibilityRoutes } from "./legacy/sense.js";

export function registerLegacyRoutes(app: FastifyInstance, pool: Pool): void {
  registerAoActLegacyCompatibilityRoutes(app, pool);
  registerApprovalsLegacyCompatibilityRoutes(app, pool);
  registerDevicesLegacyCompatibilityRoutesOnly(app, pool);
  registerSenseLegacyCompatibilityRoutes(app, pool);
}
