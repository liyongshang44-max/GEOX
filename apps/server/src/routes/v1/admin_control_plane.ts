import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { adminControlPlaneEnvelope, type AdminControlPlaneKind } from "./admin_control_plane_boundary.js";

const paths: AdminControlPlaneKind[] = ["dashboard", "fields", "operations", "devices", "alerts", "evidence", "skills", "acceptance", "healthz"];

const boundaryRules = [
  "Admin is read-only governance and control-plane observability.",
  "Admin does not render customer reports or Operator Twin workspaces.",
  "Admin does not author recommendations, bypass approvals, create tasks, dispatch work, or write execution records.",
  "Admin does not write ROI ledger, Field Memory, facts, customer projectors, or Operator Twin projectors.",
];

function payloadFor(kind: AdminControlPlaneKind): Record<string, unknown> {
  if (kind === "dashboard") {
    return {
      system_health: "observable",
      db_health: "observable",
      worker_status: "observable",
      queue_status: "observable",
      device_status_summary: "connectivity only",
      operation_status_summary: "state chain only",
      evidence_pipeline_summary: "artifact and quality refs only",
      acceptance_summary: "gate refs only",
      boundary_summary: boundaryRules,
    };
  }
  if (kind === "devices") {
    return { allowed_fields: ["device_id", "binding_status", "online_status", "last_seen", "capability", "source_evidence_refs"], semantic_boundary: "online_status is connectivity only, not crop or field health" };
  }
  if (kind === "operations") {
    return { allowed_fields: ["operation_id", "plan_status", "approval_status", "task_status", "receipt_status", "as_executed_status", "acceptance_status", "blocking_reason"], action_boundary: "no approve, dispatch, or create task controls" };
  }
  if (kind === "evidence") {
    return { allowed_fields: ["evidence_artifact_refs", "acceptance_result_refs", "data_quality_status", "missing_evidence_reasons"], semantic_boundary: "evidence quality is not an agronomy conclusion" };
  }
  if (kind === "skills") {
    return { allowed_fields: ["skill_registry", "worker_state", "last_run", "failure_reason", "queue_lag"], semantic_boundary: "skill success is not forecast correctness, agronomy correctness, or operation effectiveness" };
  }
  return { allowed_surface: kind, read_model: true };
}

export function registerAdminControlPlaneV1Routes(app: FastifyInstance, _pool: Pool): void {
  for (const kind of paths) {
    app.get(`/api/v1/admin/${kind}`, async () => adminControlPlaneEnvelope(kind, payloadFor(kind), boundaryRules));
  }
}
