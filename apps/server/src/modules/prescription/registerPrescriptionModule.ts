import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";

import { registerPrescriptionsV1Routes } from "../../routes/prescriptions_v1.js";
import { registerFieldCropContextPrescriptionGuardV1 } from "../../routes/field_crop_context_hooks_v1.js";

export function registerPrescriptionModule(app: FastifyInstance, pool: Pool): void {
  registerFieldCropContextPrescriptionGuardV1(app, pool);
  registerPrescriptionsV1Routes(app, pool);
}
