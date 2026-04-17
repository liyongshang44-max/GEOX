import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { registerDevicesV1PrimaryRoutes } from "../devices_v1.js";

export function registerDevicesV1PrimaryCompatibilityRoutes(app: FastifyInstance, pool: Pool) {
  return registerDevicesV1PrimaryRoutes(app, pool);
}
