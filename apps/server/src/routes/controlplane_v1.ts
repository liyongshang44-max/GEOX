import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { registerControlPlaneV1Routes as registerControlPlaneTaskServiceRoutes } from "../domain/controlplane/task_service.js";
import { registerControlplaneDispatchQueueService } from "../domain/controlplane/dispatch_queue_service.js";
import { registerControlplanePlanService } from "../domain/controlplane/plan_service.js";
import { registerControlplaneReceiptService } from "../domain/controlplane/receipt_service.js";

// Route module is intentionally thin: only delegates wiring to service layer.
export function registerControlPlaneV1Routes(app: FastifyInstance, pool: Pool): void {
  registerControlplaneDispatchQueueService();
  registerControlplanePlanService();
  registerControlplaneReceiptService();
  registerControlPlaneTaskServiceRoutes(app, pool);
}
