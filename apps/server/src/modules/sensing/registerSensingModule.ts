import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";

import { registerRawRoutes } from "../../routes/raw.js";
import { registerTelemetryV1Routes } from "../../routes/telemetry_v1.js";
import { registerDeviceHeartbeatV1Routes } from "../../routes/device_heartbeat_v1.js";
import { registerDeviceStatusV1Routes } from "../../routes/device_status_v1.js";
import { registerSenseV1PrimaryRoutes } from "../../routes/v1/sense.js";
import { registerDevicesV1PrimaryCompatibilityRoutes } from "../../routes/v1/devices.js";

export function registerSensingModule(app: FastifyInstance, pool: Pool): void {
  registerRawRoutes(app, pool);
  registerTelemetryV1Routes(app, pool);
  registerDeviceHeartbeatV1Routes(app, pool);
  registerDeviceStatusV1Routes(app, pool);
  registerDevicesV1PrimaryCompatibilityRoutes(app, pool);
  registerSenseV1PrimaryRoutes(app, pool);
}
