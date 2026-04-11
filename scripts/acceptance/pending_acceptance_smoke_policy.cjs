"use strict";

const ACCEPTANCE_DIAGNOSTIC_FIELDS = Object.freeze([
  "operation_plan_id",
  "act_task_id",
  "tenant_id",
  "project_id",
  "group_id",
  "final_status",
  "pending_since_ts",
  "observed_at_ts",
  "pending_duration_ms",
  "max_pending_ms",
  "last_receipt_fact_id",
  "last_acceptance_fact_id",
]);

function normalizeStatus(raw) {
  return String(raw ?? "").trim().toUpperCase();
}

function evaluateChainSmokeExitCode(finalStatus) {
  const status = normalizeStatus(finalStatus);
  if (status === "SUCCEEDED" || status === "FAILED" || status === "PENDING_ACCEPTANCE") return 0;
  return 1;
}

function evaluateAcceptanceSmoke(input) {
  const status = normalizeStatus(input?.final_status);
  const nowTs = Number(input?.observed_at_ts ?? Date.now());
  const pendingSinceTs = Number(input?.pending_since_ts ?? nowTs);
  const maxPendingMs = Number(input?.max_pending_ms ?? 5 * 60 * 1000);
  const pendingDurationMs = Math.max(0, nowTs - pendingSinceTs);

  const diagnostics = {
    operation_plan_id: String(input?.operation_plan_id ?? ""),
    act_task_id: String(input?.act_task_id ?? ""),
    tenant_id: String(input?.tenant_id ?? ""),
    project_id: String(input?.project_id ?? ""),
    group_id: String(input?.group_id ?? ""),
    final_status: status,
    pending_since_ts: pendingSinceTs,
    observed_at_ts: nowTs,
    pending_duration_ms: pendingDurationMs,
    max_pending_ms: maxPendingMs,
    last_receipt_fact_id: input?.last_receipt_fact_id ?? null,
    last_acceptance_fact_id: input?.last_acceptance_fact_id ?? null,
  };

  if (status !== "PENDING_ACCEPTANCE") {
    return { exitCode: 0, diagnostics };
  }
  if (pendingDurationMs > maxPendingMs) {
    return { exitCode: 2, diagnostics };
  }
  return { exitCode: 0, diagnostics };
}

module.exports = {
  ACCEPTANCE_DIAGNOSTIC_FIELDS,
  evaluateChainSmokeExitCode,
  evaluateAcceptanceSmoke,
};
