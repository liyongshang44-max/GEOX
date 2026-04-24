import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";

import { registerAoActV1PrimaryRoutes } from "./v1/ao_act.js";
import { registerApprovalsV1PrimaryRoutes } from "./v1/approvals.js";
import { registerDevicesV1PrimaryCompatibilityRoutes } from "./v1/devices.js";
import { registerSenseV1PrimaryRoutes } from "./v1/sense.js";

export function registerV1Routes(app: FastifyInstance, pool: Pool): void {
  registerAoActV1PrimaryRoutes(app, pool);
  registerApprovalsV1PrimaryRoutes(app, pool);
  registerDevicesV1PrimaryCompatibilityRoutes(app, pool);
  registerSenseV1PrimaryRoutes(app, pool);
}
