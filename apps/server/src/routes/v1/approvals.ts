import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { registerApprovalRequestV1Routes } from "../control_approval_request_v1.js";

// Approvals v1 primary routes.
// New business endpoints must be registered here, not under legacy prefixes.
export function registerApprovalsV1PrimaryRoutes(app: FastifyInstance, pool: Pool): void {
  registerApprovalRequestV1Routes(app, pool);
}
