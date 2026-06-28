// apps/server/src/domain/twin_kernel/decision_cycle_v1.ts
// Purpose: build deterministic TK6 decision_cycle_v1 records as human-in-the-loop Twin Kernel cycle/bus objects.
// Boundary: this file records references and cycle state only; it does not write recommendations, approvals, tasks, receipts, acceptance, ROI, Field Memory, model parameters, or downstream operations.

import { createHash } from "node:crypto";

export type DecisionForecastRunRowV1 = {
  forecast_run_id: string;
  snapshot_id: string;
  tenant_id: string;
  project_id: string;
  group_id: string;
  field_id: string;
  as_of_ts: string | Date;
  status: string;
  determinism_hash: string;
};

export type DecisionScenarioSetRowV1 = {
  scenario_set_id: string;
  forecast_run_id: string;
  tenant_id: string;
  project_id: string;
  group_id: string;
  field_id: string;
  as_of_ts: string | Date;
  status: string;
  determinism_hash: string;
};

export type DecisionCalibrationReplayRowV1 = {
  calibration_replay_id: string;
  forecast_run_id: string;
  scenario_set_id: string;
  tenant_id: string;
  project_id: string;
  group_id: string;
  field_id: string;
  as_of_ts: string | Date;
  status: string;
  determinism_hash: string;
};

export type DecisionForecastErrorRowV1 = {
  forecast_error_id: string;
  calibration_replay_id: string;
  forecast_run_id: string;
  scenario_set_id: string;
  tenant_id: string;
  project_id: string;
  group_id: string;
  field_id: string;
  as_of_ts: string | Date;
  error_direction: string;
  determinism_hash: string;
};

export type DecisionFieldLearningCandidateRowV1 = {
  field_learning_candidate_id: string;
  calibration_replay_id: string;
  forecast_error_id: string;
  tenant_id: string;
  project_id: string;
  group_id: string;
  field_id: string;
  as_of_ts: string | Date;
  candidate_status: string;
  determinism_hash: string;
};

export type DecisionExternalRefsV1 = {
  recommendation_id?: string;
  approval_id?: string;
  operation_plan_id?: string;
  act_task_id?: string;
  receipt_id?: string;
  as_executed_id?: string;
  acceptance_id?: string;
  post_irrigation_verification_id?: string;
  roi_entry_id?: string;
  field_memory_id?: string;
};

export type DecisionCycleV1 = {
  decision_cycle_id: string;
  snapshot_id: string;
  forecast_run_id: string;
  scenario_set_id: string;
  calibration_replay_id: string;
  forecast_error_id: string;
  field_learning_candidate_id: string;
  tenant_id: string;
  project_id: string;
  group_id: string;
  field_id: string;
  as_of_ts: string;
  cycle_status: "DECISION_CYCLE_READY" | "DECISION_CYCLE_BLOCKED";
  current_stage: string;
  external_refs_json: Record<string, unknown>;
  state_machine_json: Array<Record<string, unknown>>;
  human_gate_json: Record<string, unknown>;
  boundary_flags_json: Record<string, unknown>;
  blocking_reasons_json: string[];
  determinism_hash: string;
};

export type BuildDecisionCycleArgsV1 = {
  forecastRun: DecisionForecastRunRowV1;
  scenarioSet: DecisionScenarioSetRowV1;
  calibrationReplay: DecisionCalibrationReplayRowV1;
  forecastError: DecisionForecastErrorRowV1;
  fieldLearningCandidate: DecisionFieldLearningCandidateRowV1;
  external_refs?: DecisionExternalRefsV1;
};

const STAGES = [
  "OBSERVED",
  "STATE_ESTIMATED",
  "FORECASTED",
  "SCENARIO_COMPARED",
  "RECOMMENDATION_CANDIDATE_CREATED",
  "APPROVAL_REQUIRED",
  "APPROVED",
  "TASK_CREATED",
  "DISPATCHED",
  "RECEIPT_RECEIVED",
  "ACCEPTED",
  "ROI_FORMALIZED",
  "MEMORY_CANDIDATE_CREATED",
  "FORMAL_MEMORY_WRITTEN",
  "CALIBRATED",
] as const;

function text(value: unknown): string {
  return String(value ?? "").trim();
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

function hasRef(value: unknown): boolean {
  return text(value).length > 0;
}

function cleanExternalRefs(refs: DecisionExternalRefsV1 | undefined): Record<string, string | null> {
  return {
    recommendation_id: text(refs?.recommendation_id) || null,
    approval_id: text(refs?.approval_id) || null,
    operation_plan_id: text(refs?.operation_plan_id) || null,
    act_task_id: text(refs?.act_task_id) || null,
    receipt_id: text(refs?.receipt_id) || null,
    as_executed_id: text(refs?.as_executed_id) || null,
    acceptance_id: text(refs?.acceptance_id) || null,
    post_irrigation_verification_id: text(refs?.post_irrigation_verification_id) || null,
    roi_entry_id: text(refs?.roi_entry_id) || null,
    field_memory_id: text(refs?.field_memory_id) || null,
  };
}

function buildStateMachine(snapshotId: string, refs: Record<string, string | null>, candidateId: string, calibrationReplayId: string, forecastErrorId: string): Array<Record<string, unknown>> {
  const complete: Record<string, boolean> = {
    OBSERVED: hasRef(snapshotId),
    STATE_ESTIMATED: hasRef(snapshotId),
    FORECASTED: true,
    SCENARIO_COMPARED: true,
    RECOMMENDATION_CANDIDATE_CREATED: hasRef(refs.recommendation_id),
    APPROVAL_REQUIRED: hasRef(refs.recommendation_id),
    APPROVED: hasRef(refs.approval_id),
    TASK_CREATED: hasRef(refs.operation_plan_id) || hasRef(refs.act_task_id),
    DISPATCHED: hasRef(refs.act_task_id),
    RECEIPT_RECEIVED: hasRef(refs.receipt_id),
    ACCEPTED: hasRef(refs.acceptance_id),
    ROI_FORMALIZED: hasRef(refs.roi_entry_id),
    MEMORY_CANDIDATE_CREATED: hasRef(candidateId),
    FORMAL_MEMORY_WRITTEN: hasRef(refs.field_memory_id),
    CALIBRATED: hasRef(calibrationReplayId) && hasRef(forecastErrorId),
  };
  return STAGES.map((stage) => ({ stage, complete: complete[stage] === true }));
}

function currentStage(stateMachine: Array<Record<string, unknown>>): string {
  const incomplete = stateMachine.find((stage) => stage.complete !== true);
  if (incomplete) return text(incomplete.stage);
  return "CALIBRATED";
}

function boundaryFlags(): Record<string, unknown> {
  return {
    forecast_to_task_autojump_allowed: false,
    scenario_to_task_autojump_allowed: false,
    recommendation_to_task_autojump_allowed: false,
    human_approval_required_before_task: true,
    automatic_recommendation_created: false,
    automatic_approval_created: false,
    automatic_task_created: false,
    automatic_receipt_created: false,
    automatic_acceptance_created: false,
    automatic_roi_created: false,
    automatic_field_memory_created: false,
    model_updated: false,
  };
}

function humanGate(refs: Record<string, string | null>): Record<string, unknown> {
  return {
    human_approval_required_before_task: true,
    approval_ref_present: hasRef(refs.approval_id),
    task_ref_present: hasRef(refs.operation_plan_id) || hasRef(refs.act_task_id),
    task_ref_without_approval_ref: (hasRef(refs.operation_plan_id) || hasRef(refs.act_task_id)) && !hasRef(refs.approval_id),
    receipt_requires_task_ref: true,
    acceptance_requires_receipt_ref: true,
    formal_memory_requires_acceptance_ref: true,
  };
}

export function buildDecisionCycleV1(args: BuildDecisionCycleArgsV1): DecisionCycleV1 {
  const forecastRun = args.forecastRun;
  const scenarioSet = args.scenarioSet;
  const calibrationReplay = args.calibrationReplay;
  const forecastError = args.forecastError;
  const candidate = args.fieldLearningCandidate;
  const refs = cleanExternalRefs(args.external_refs);
  const blockingReasons: string[] = [];
  if (scenarioSet.forecast_run_id !== forecastRun.forecast_run_id) blockingReasons.push("SCENARIO_FORECAST_LINK_MISMATCH");
  if (calibrationReplay.forecast_run_id !== forecastRun.forecast_run_id) blockingReasons.push("REPLAY_FORECAST_LINK_MISMATCH");
  if (calibrationReplay.scenario_set_id !== scenarioSet.scenario_set_id) blockingReasons.push("REPLAY_SCENARIO_LINK_MISMATCH");
  if (forecastError.calibration_replay_id !== calibrationReplay.calibration_replay_id) blockingReasons.push("ERROR_REPLAY_LINK_MISMATCH");
  if (candidate.calibration_replay_id !== calibrationReplay.calibration_replay_id) blockingReasons.push("CANDIDATE_REPLAY_LINK_MISMATCH");
  if (candidate.forecast_error_id !== forecastError.forecast_error_id) blockingReasons.push("CANDIDATE_ERROR_LINK_MISMATCH");
  if (forecastRun.status !== "FORECAST_READY") blockingReasons.push("FORECAST_NOT_READY");
  if (scenarioSet.status !== "SCENARIO_SET_READY") blockingReasons.push("SCENARIO_SET_NOT_READY");
  if (calibrationReplay.status !== "CALIBRATION_REPLAY_READY") blockingReasons.push("CALIBRATION_REPLAY_NOT_READY");
  if (candidate.candidate_status !== "LEARNING_CANDIDATE_READY") blockingReasons.push("LEARNING_CANDIDATE_NOT_READY");
  const gate = humanGate(refs);
  if (gate.task_ref_without_approval_ref === true) blockingReasons.push("TASK_REF_WITHOUT_APPROVAL_REF");
  if (hasRef(refs.receipt_id) && !(hasRef(refs.operation_plan_id) || hasRef(refs.act_task_id))) blockingReasons.push("RECEIPT_REF_WITHOUT_TASK_REF");
  if (hasRef(refs.acceptance_id) && !hasRef(refs.receipt_id)) blockingReasons.push("ACCEPTANCE_REF_WITHOUT_RECEIPT_REF");
  if (hasRef(refs.field_memory_id) && !hasRef(refs.acceptance_id)) blockingReasons.push("FIELD_MEMORY_REF_WITHOUT_ACCEPTANCE_REF");
  const stateMachine = buildStateMachine(forecastRun.snapshot_id, refs, candidate.field_learning_candidate_id, calibrationReplay.calibration_replay_id, forecastError.forecast_error_id);
  const flags = boundaryFlags();
  const hashInput = {
    snapshot_id: forecastRun.snapshot_id,
    forecast_run_id: forecastRun.forecast_run_id,
    scenario_set_id: scenarioSet.scenario_set_id,
    calibration_replay_id: calibrationReplay.calibration_replay_id,
    forecast_error_id: forecastError.forecast_error_id,
    field_learning_candidate_id: candidate.field_learning_candidate_id,
    external_refs_json: refs,
    state_machine_json: stateMachine,
    human_gate_json: gate,
    boundary_flags_json: flags,
    blocking_reasons_json: blockingReasons,
  };
  const determinismHash = hashPayload(hashInput);
  return {
    decision_cycle_id: `dc_${determinismHash.slice(0, 24)}`,
    snapshot_id: forecastRun.snapshot_id,
    forecast_run_id: forecastRun.forecast_run_id,
    scenario_set_id: scenarioSet.scenario_set_id,
    calibration_replay_id: calibrationReplay.calibration_replay_id,
    forecast_error_id: forecastError.forecast_error_id,
    field_learning_candidate_id: candidate.field_learning_candidate_id,
    tenant_id: candidate.tenant_id,
    project_id: candidate.project_id,
    group_id: candidate.group_id,
    field_id: candidate.field_id,
    as_of_ts: new Date(candidate.as_of_ts).toISOString(),
    cycle_status: blockingReasons.length === 0 ? "DECISION_CYCLE_READY" : "DECISION_CYCLE_BLOCKED",
    current_stage: currentStage(stateMachine),
    external_refs_json: refs,
    state_machine_json: stateMachine,
    human_gate_json: gate,
    boundary_flags_json: flags,
    blocking_reasons_json: blockingReasons,
    determinism_hash: determinismHash,
  };
}
