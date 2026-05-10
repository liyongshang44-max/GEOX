import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";

import { registerSimConfigRoutes } from "../../routes/sim_config.js";
import { registerDeviceSimulatorV1Routes } from "../../routes/device_simulator_v1.js";
import { registerFlightTableV1Routes } from "../../routes/dev/flight_table_v1.js";
import { registerFlightTableSkillRoutesV1 } from "../../routes/dev/flight_table_skills_v1.js";

export function registerDevtoolsModule(app: FastifyInstance, pool: Pool): void {
  registerSimConfigRoutes(app);
  registerDeviceSimulatorV1Routes(app, pool);
  registerFlightTableV1Routes(app, pool);
  registerFlightTableSkillRoutesV1(app, pool);
}
