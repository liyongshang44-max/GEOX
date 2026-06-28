// apps/server/src/domain/twin_kernel/field_learning_candidate_v1.ts
// Purpose: build deterministic TK5 field_learning_candidate_v1 records from TK4 replay and forecast-error evidence.
// Boundary: this file creates learning candidates only; it does not write formal Field Memory, ROI, recommendations, approvals, tasks, receipts, model parameters, or decision cycles.

import { createHash } from "node:crypto";

export type FieldLearningCalibrationReplayRowV1 = {
  calibration_replay_id: string;
  forecast_run_id: string;
  scenario_set_id: string;
  tenant_id: string;
  project_id: string;
  group_id: string;
  field_id: string;
  as_of_ts: string | Date;
  status: string;
  selected_option_id: string | null;
  predicted_json: Record<string, unknown>;
  observed_json: Record<string, unknown>;
  error_summary_json: Record<string, unknown>;
  reason_candidates_json: Array<Record<string, unknown>>;
  evidence_refs_json: Array<Record<string, string>>;
  blocking_reasons_json: string[];
  determinism_hash: string;
};

export type FieldLearningForecastErrorRowV1 = {
  forecast_error_id: string;
  calibration_replay_id: string;
  forecast_run_id: string;
  scenario_set_id: string;
  tenant_id: string;
  project_id: string;
  group_id: string;
  field_id: string;
  as_of_ts: string | Date;
  error_metric: string;
  error_value: number | null;
  error_direction: string;
  predicted_json: Record<string, unknown>;
  observed_json: Record<string, unknown>;
  evidence_refs_json: Array<Record<string, string>>;
  blocking_reasons_json: string[];
  determinism_hash: string;
};

export type FieldLearningFormalGateRefsV1 = {
  acceptance_id?: string;
  post_irrigation_verification_id?: string;
  formal_evidence_ref_id?: string;
  field_memory_gate_route?: string;
  evidence_refs?: Array<Record<string, string>>;
};

export type FieldLearningCandidateV1 = {
  field_learning_candidate_id: string;
  calibration_replay_id: string;
  forecast_error_id: string;
  tenant_id: string;
  project_id: string;
  group_id: string;
  field_id: string;
  as_of_ts: string;
  candidate_status: "LEARNING_CANDIDATE_READY" | "LEARNING_CANDIDATE_BLOCKED";
  learning_scope: string;
  learning_statement_json: Record<string, unknown>;
  supporting_evidence_refs_json: Array<Record<string, string>>;
  counter_evidence_refs_json: Array<Record<string, unknown>>;
  confidence_json: Record<string, unknown>;
  formal_gate_refs_json: Record<string, unknown>;
  h58_gate_status_json: Record<string, unknown>;
  blocking_reasons_json: string[];
  determinism_hash: string;
};

export type BuildFieldLearningCandidateArgsV1 = {
  calibrationReplay: FieldLearningCalibrationReplayRowV1;
  forecastError: FieldLearningForecastErrorRowV1;
  formal_gate_refs?: FieldLearningFormalGateRefsV1;
};

function text(value: unknown): string {
  return String(value ?? "").trim();
}

function numberOrNull(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function canonical(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    const input = value as Record<string, unknown>;
    const output: Record<string, unknown> = {};
    for (const key of Object.keys(input).sort()) output[key] = canonical(input[key]);
    return output;
  }
  return value;
}

function hashPayload(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(canonical(value))).digest("hex");
}

function mergeEvidenceRefs(a: Array<Record<string, string>>, b: Array<Record<string, string>>, c: Array<Record<string, string>>): Array<Record<string, string>> {
  const seen = new Set<string>();
  const out: Array<Record<string, string>> = [];
  for (const item of [...a, ...b, ...c]) {
    const key = JSON.stringify(canonical(item));
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function h58GateStatus(formalGateRefs: FieldLearningFormalGateRefsV1 | undefined): Record<string, unknown> {
  const acceptanceId = text(formalGateRefs?.acceptance_id);
  const verificationId = text(formalGateRefs?.post_irrigation_verification_id);
  const formalEvidenceRefId = text(formalGateRefs?.formal_evidence_ref_id);
  return {
    formal_field_memory_route: text(formalGateRefs?.field_memory_gate_route) || "/api/v1/field-memory/from-acceptance",
    formal_field_memory_write_created: false,
    h58_bypass_allowed: false,
    requires_acceptance_pass: true,
    requires_formal_acceptance: true,
    requires_formal_evidence_passed: true,
    requires_chain_validation_passed: true,
    has_acceptance_ref: Boolean(acceptanceId),
    has_post_irrigation_verification_ref: Boolean(verificationId),
    has_formal_evidence_ref: Boolean(formalEvidenceRefId),
    candidate_can_enter_formal_gate: Boolean(acceptanceId && verificationId && formalEvidenceRefId),
  };
}

function confidence(errorValue: number | null, blockingReasons: string[], gateStatus: Record<string, unknown>): Record<string, unknown> {
  if (blockingReasons.length > 0) return { level: "LOW", basis: "blocking_reasons_present" };
  if (!gateStatus.candidate_can_enter_formal_gate) return { level: "LOW", basis: "formal_gate_refs_incomplete" };
  const magnitude = errorValue === null ? null : Math.abs(errorValue);
  if (magnitude === null) return { level: "LOW", basis: "numeric_error_missing" };
  if (magnitude >= 3) return { level: "MEDIUM", basis: "large_observed_forecast_error_with_formal_refs" };
  return { level: "LOW", basis: "small_error_magnitude" };
}

export function buildFieldLearningCandidateV1(args: BuildFieldLearningCandidateArgsV1): FieldLearningCandidateV1 {
  const calibrationReplay = args.calibrationReplay;
  const forecastError = args.forecastError;
  const formalGateRefs = args.formal_gate_refs ?? {};
  const asOfTs = new Date(forecastError.as_of_ts).toISOString();
  const blockingReasons: string[] = [];
  if (calibrationReplay.status !== "CALIBRATION_REPLAY_READY") blockingReasons.push("CALIBRATION_REPLAY_NOT_READY");
  if (calibrationReplay.calibration_replay_id !== forecastError.calibration_replay_id) blockingReasons.push("REPLAY_ERROR_LINK_MISMATCH");
  if (forecastError.error_direction === "BLOCKED") blockingReasons.push("FORECAST_ERROR_BLOCKED");
  if (forecastError.error_direction === "NO_NUMERIC_OBSERVATION") blockingReasons.push("NO_NUMERIC_ERROR_TO_LEARN_FROM");
  if (numberOrNull(forecastError.error_value) === null) blockingReasons.push("FORECAST_ERROR_VALUE_MISSING");
  const gateStatus = h58GateStatus(formalGateRefs);
  if (!gateStatus.candidate_can_enter_formal_gate) blockingReasons.push("H58_FORMAL_GATE_REFS_INCOMPLETE");
  const errorValue = numberOrNull(forecastError.error_value);
  const learningScope = "water_response_forecast_error";
  const supportingEvidence = mergeEvidenceRefs(calibrationReplay.evidence_refs_json, forecastError.evidence_refs_json, Array.isArray(formalGateRefs.evidence_refs) ? formalGateRefs.evidence_refs : []);
  const counterEvidence: Array<Record<string, unknown>> = [];
  if (calibrationReplay.blocking_reasons_json.length > 0) counterEvidence.push({ source: "calibration_replay_v1", blocking_reasons: calibrationReplay.blocking_reasons_json });
  if (forecastError.blocking_reasons_json.length > 0) counterEvidence.push({ source: "forecast_error_v1", blocking_reasons: forecastError.blocking_reasons_json });
  if (!gateStatus.candidate_can_enter_formal_gate) counterEvidence.push({ source: "h58_gate", reason: "formal_gate_refs_incomplete" });
  const learningStatement = {
    learning_type: "FIELD_WATER_RESPONSE_CANDIDATE",
    learned_from_object_type: "forecast_error_v1",
    candidate_only: true,
    formal_field_memory_created: false,
    model_updated: false,
    statement: "Observed water response differed from the TK4 predicted response; this may indicate a field-specific water-response adjustment candidate.",
    error_metric: forecastError.error_metric,
    error_value: errorValue,
    error_direction: forecastError.error_direction,
    selected_option_id: calibrationReplay.selected_option_id,
    reason_candidates: calibrationReplay.reason_candidates_json,
  };
  const formalGateJson = {
    acceptance_id: text(formalGateRefs.acceptance_id) || null,
    post_irrigation_verification_id: text(formalGateRefs.post_irrigation_verification_id) || null,
    formal_evidence_ref_id: text(formalGateRefs.formal_evidence_ref_id) || null,
    field_memory_gate_route: text(formalGateRefs.field_memory_gate_route) || "/api/v1/field-memory/from-acceptance",
  };
  const confidenceJson = confidence(errorValue, blockingReasons, gateStatus);
  const hashInput = {
    calibration_replay_id: calibrationReplay.calibration_replay_id,
    forecast_error_id: forecastError.forecast_error_id,
    learning_scope: learningScope,
    learning_statement_json: learningStatement,
    supporting_evidence_refs_json: supportingEvidence,
    counter_evidence_refs_json: counterEvidence,
    confidence_json: confidenceJson,
    formal_gate_refs_json: formalGateJson,
    h58_gate_status_json: gateStatus,
    blocking_reasons_json: blockingReasons,
  };
  const determinismHash = hashPayload(hashInput);
  return {
    field_learning_candidate_id: `flc_${determinismHash.slice(0, 24)}`,
    calibration_replay_id: calibrationReplay.calibration_replay_id,
    forecast_error_id: forecastError.forecast_error_id,
    tenant_id: forecastError.tenant_id,
    project_id: forecastError.project_id,
    group_id: forecastError.group_id,
    field_id: forecastError.field_id,
    as_of_ts: asOfTs,
    candidate_status: blockingReasons.length === 0 ? "LEARNING_CANDIDATE_READY" : "LEARNING_CANDIDATE_BLOCKED",
    learning_scope: learningScope,
    learning_statement_json: learningStatement,
    supporting_evidence_refs_json: supportingEvidence,
    counter_evidence_refs_json: counterEvidence,
    confidence_json: confidenceJson,
    formal_gate_refs_json: formalGateJson,
    h58_gate_status_json: gateStatus,
    blocking_reasons_json: blockingReasons,
    determinism_hash: determinismHash,
  };
}
