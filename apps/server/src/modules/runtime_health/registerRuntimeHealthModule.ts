// apps/server/src/modules/runtime_health/registerRuntimeHealthModule.ts

import type { FastifyInstance } from "fastify";
import { registerRuntimeHealthServiceGateV1Routes } from "../../routes/runtime_health_service_gate_v1.js";

export function registerRuntimeHealthModule(app: FastifyInstance): void {
  registerRuntimeHealthServiceGateV1Routes(app);
}
