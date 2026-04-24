import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";

import { registerPrescriptionsV1Routes } from "../../routes/prescriptions_v1.js";

export function registerPrescriptionModule(app: FastifyInstance, pool: Pool): void {
  registerPrescriptionsV1Routes(app, pool);
}
