import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";

import { registerAuthV1Routes } from "../../routes/auth_v1.js";
import { registerBillingV1Routes } from "../../routes/billing_v1.js";
import { registerSlaV1Routes } from "../../routes/sla_v1.js";

export function registerCommercialModule(app: FastifyInstance, pool: Pool): void {
  registerAuthV1Routes(app);
  registerBillingV1Routes(app, pool);
  registerSlaV1Routes(app, pool);
}
