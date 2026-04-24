import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";

import { registerLegacyRoutes } from "../../routes/registerLegacyRoutes.js";

type RegisterCompatibilityModulesOptions = {
  mediaDir: string;
};

export function registerCompatibilityModules(
  app: FastifyInstance,
  pool: Pool,
  options: RegisterCompatibilityModulesOptions
): void {
  registerLegacyRoutes(app, pool, { mediaDir: options.mediaDir });
}
