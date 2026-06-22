import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";

import { registerAcceptanceV1Routes } from "../../routes/acceptance_v1.js";
import { registerWaterResponseVerificationV1Routes } from "../../routes/water_response_verification_v1.js";

export function registerAcceptanceModule(app: FastifyInstance, pool: Pool): void {
  registerAcceptanceV1Routes(app, pool);
  registerWaterResponseVerificationV1Routes(app, pool);
}
