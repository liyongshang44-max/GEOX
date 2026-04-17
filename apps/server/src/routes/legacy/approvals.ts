import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { registerApprovalRequestLegacyRoutes } from "../control_approval_request_v1.js";

// Approvals legacy compatibility routes only.
// Do not add new business endpoints here.
export function registerApprovalsLegacyCompatibilityRoutes(app: FastifyInstance, pool: Pool): void {
  registerApprovalRequestLegacyRoutes(app, pool);
}
