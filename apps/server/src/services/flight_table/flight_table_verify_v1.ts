import type { FlightTableRunV1, FlightVerifySummaryV1 } from "./flight_table_manifest_v1.js";

export function buildFlightVerifySummaryV1(run: Pick<FlightTableRunV1, "steps" | "status">): FlightVerifySummaryV1 {
  const total_steps = run.steps.length;
  const passed_steps = run.steps.filter((step) => step.status === "PASS").length;
  const failed_steps = run.steps.filter((step) => step.status === "FAIL").length;
  const pending_steps = run.steps.filter((step) => step.status === "PENDING" || step.status === "RUNNING").length;
  const skipped_steps = run.steps.filter((step) => step.status === "SKIPPED").length;
  const errors = run.steps
    .filter((step) => step.status === "FAIL")
    .map((step) => `${step.step_key}:${step.message ?? "VERIFY_FAILED"}`);
  const warnings = run.status === "CLEANED" ? ["RUN_CLEANED"] : [];
  const status = failed_steps > 0 ? "FAIL" : pending_steps > 0 ? "PENDING" : "PASS";
  return {
    ok: failed_steps === 0,
    status,
    total_steps,
    passed_steps,
    failed_steps,
    pending_steps,
    skipped_steps,
    errors,
    warnings,
    updated_at: new Date().toISOString(),
  };
}

export function buildFlightVerifyReportV1(run: FlightTableRunV1): Record<string, unknown> {
  return {
    ok: run.verify_summary.ok,
    run_id: run.run_id,
    status: run.status,
    lane: run.lane,
    verify_summary: run.verify_summary,
    steps: run.steps.map((step) => ({
      step_key: step.step_key,
      label: step.label,
      status: step.status,
      verify_result: step.verify_result ?? "PENDING",
      message: step.message ?? null,
      started_at: step.started_at ?? null,
      finished_at: step.finished_at ?? null,
      updated_at: step.updated_at,
    })),
    manifest_completeness: {
      has_field: Boolean(run.manifest.field_id),
      has_geometry: Boolean(run.manifest.geometry_id),
      device_count: run.manifest.device_ids.length,
      credential_count: run.manifest.credential_ids.length,
      skill_binding_count: run.manifest.skill_binding_ids.length,
      operation_count: run.manifest.operation_plan_ids.length,
      evidence_count: run.manifest.evidence_ids.length,
      acceptance_count: run.manifest.acceptance_ids.length,
      api_snapshot_count: run.manifest.api_snapshot_refs.length,
    },
  };
}
