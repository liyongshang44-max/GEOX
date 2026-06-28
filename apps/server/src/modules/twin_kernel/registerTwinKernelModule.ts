// apps/server/src/modules/twin_kernel/registerTwinKernelModule.ts
// Purpose: register Twin Kernel v1 routes.
// Boundary: module registration only; no runtime work is executed during registration.

import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";

import { registerTwinKernelV1Routes } from "../../routes/v1/twin_kernel.js";

export function registerTwinKernelModule(app: FastifyInstance, pool: Pool): void {
  registerTwinKernelV1Routes(app, pool);
}
