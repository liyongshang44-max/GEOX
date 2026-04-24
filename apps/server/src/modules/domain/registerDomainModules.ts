import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";

import { registerV1Routes } from "../../routes/registerV1Routes.js";

type RegisterDomainModulesOptions = {
  mediaDir: string;
};

export function registerDomainModules(app: FastifyInstance, pool: Pool, options: RegisterDomainModulesOptions): void {
  registerV1Routes(app, pool, { mediaDir: options.mediaDir });
}
