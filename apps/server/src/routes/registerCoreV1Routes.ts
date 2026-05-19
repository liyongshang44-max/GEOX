import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";

import { registerAoActV1PrimaryRoutes } from "./v1/ao_act.js";
import { registerApprovalsV1PrimaryRoutes } from "./v1/approvals.js";
import { registerDevicesV1PrimaryCompatibilityRoutes } from "./v1/devices.js";
import { registerFertilizationV1Routes } from "./v1/fertilization.js";
import { registerInspectionV1Routes } from "./v1/inspection.js";
import { registerSenseV1PrimaryRoutes } from "./v1/sense.js";
import { registerSamplingV1Routes } from "./v1/sampling.js";

export function registerCoreV1Routes(app: FastifyInstance, pool: Pool): void {
  registerAoActV1PrimaryRoutes(app, pool);
  registerApprovalsV1PrimaryRoutes(app, pool);
  registerDevicesV1PrimaryCompatibilityRoutes(app, pool);
  registerSenseV1PrimaryRoutes(app, pool);
  registerSamplingV1Routes(app, pool);
  registerFertilizationV1Routes(app, pool);
  registerInspectionV1Routes(app, pool);
}