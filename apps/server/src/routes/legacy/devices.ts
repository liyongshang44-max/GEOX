import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { registerDevicesLegacyCompatibilityRoutes } from "../devices_v1.js";

export function registerDevicesLegacyCompatibilityRoutesOnly(app: FastifyInstance, pool: Pool) {
  return registerDevicesLegacyCompatibilityRoutes(app, pool);
}
