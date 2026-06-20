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
    return { allowed_fields: ["device_id", "binding_status", "online_status", "last_seen", "capability", "source_evidence_refs"], devices: [{ device_id: "DEVICE_DEMO", online_status: "UNKNOWN", capability: "READ_ONLY_DEMO", last_seen: null }], semantic_boundary: "online_status is connectivity only, not crop or field health" };
  }
  if (kind === "operations") {
    return { allowed_fields: ["operation_id", "plan_status", "approval_status", "task_status", "receipt_status", "as_executed_status", "acceptance_status", "blocking_reason"], operations: [{ operation_id: "OP_DEMO", plan_status: "SEEDED_OR_PENDING", approval_status: "READ_ONLY", task_status: "READ_ONLY", receipt_status: "READ_ONLY" }], action_boundary: "no approve, dispatch, or create task controls" };
  }
  if (kind === "evidence") {
    return { allowed_fields: ["evidence_artifact_refs", "acceptance_result_refs", "data_quality_status", "missing_evidence_reasons"], evidence_artifact_refs: [], acceptance_result_refs: [], missing_reasons: ["NO_CONFIRMED_SOURCE_FACT"], semantic_boundary: "evidence quality is not an agronomy conclusion" };
  }
  if (kind === "skills") {
    return { allowed_fields: ["skill_registry", "worker_state", "last_run", "failure_reason", "queue_lag"], registry: [], worker_state: "observable", last_run: null, failure_reason: null, semantic_boundary: "skill success is not forecast correctness, agronomy correctness, or operation effectiveness" };
  }
  if (kind === "fields") {
    return { field_binding_state: "observable", field_count: 1, fields: [{ field_id: "FIELD_DEMO", binding_state: "SEEDED_OR_PENDING", read_only: true }] };
  }
  if (kind === "acceptance") {
    return { acceptance_gate_status: "observable", gates: [{ gate_id: "THREE_SURFACE_LOCAL_DEMO", status: "READ_ONLY" }] };
  }
  if (kind === "healthz") {
    return { system_health: "observable", db_health: "observable", worker_heartbeat: "observable", queue_status: "observable" };
  }
  if (kind === "alerts") {
    return { alert_lanes: ["system_health", "device_offline", "evidence_missing", "worker_failure"], read_only: true };
  }
  return { allowed_surface: kind, read_model: true };
}

export function registerAdminControlPlaneV1Routes(app: FastifyInstance, _pool: Pool): void {
  for (const kind of paths) {
    app.get(`/api/v1/admin/${kind}`, async () => adminControlPlaneEnvelope(kind, payloadFor(kind), boundaryRules));
  }
}
