// apps/server/src/projections/twin_runtime/feedback_persistence_projection_v1.ts
// Purpose: derive deterministic rebuildable PostgreSQL projection rows from MCFT-CAP-05 canonical Decision, Action Feedback and Forecast Residual objects plus approved-Plan Replay Evidence.
// Boundary: pure row construction only; no database, canonical append, approval authority, causal inference, clock, filesystem, environment or network.

import {
  WATER_AMOUNT_SCALE_V1,
  formatFixedDecimalV1,
  parseFixedDecimalV1,
} from "../../domain/soil_water/fixed_point_water_decimal_v1.js";
import type {
  Cap05ActionFeedbackEnvelopeV1,
  Cap05DecisionEnvelopeV1,
} from "../../domain/twin_runtime/feedback_canonical_contracts_v1.js";
import type { Cap05ForecastResidualEnvelopeV1 } from "../../domain/twin_runtime/forecast_observation_residual_v1.js";
import type { Cap05FeedbackCycleProjectionV1 } from "../../domain/twin_runtime/feedback_cycle_projection_v1.js";

export type Cap05DecisionProjectionRowV1 = {
  decision_object_id: string;
  tenant_id: string;
  project_id: string;
  group_id: string;
  field_id: string;
  season_id: string;
  zone_id: string;
  logical_time: string;
  as_of: string;
  scenario_set_ref: string;
  scenario_set_hash: string;
  selected_option_ref: string;
  selected_option_hash: string;
  selected_option_id: string;
  decision_request_evidence_ref: string;
  decision_request_evidence_hash: string;
  actor_ref: string;
  determinism_hash: string;
  canonical_payload: Record<string, unknown>;
  source_fact_id: string;
};

export type Cap05ActionFeedbackProjectionRowV1 = {
  action_feedback_object_id: string;
  tenant_id: string;
  project_id: string;
  group_id: string;
  field_id: string;
  season_id: string;
  zone_id: string;
  logical_time: string;
  as_of: string;
  decision_ref: string;
  decision_hash: string;
  approved_plan_evidence_ref: string;
  approved_plan_evidence_hash: string;
  dispatch_disposition: string;
  event_id: string;
  source_record_id: string;
  binding_id: string;
  origin_source_id: string;
  execution_status: string;
  validation_status: string;
  source_quality: string;
  eligible_for_state_input: boolean;
  actual_amount_mm: string;
  spatial_coverage_fraction: string;
  target_scope_equivalent_irrigation_mm: string;
  execution_start: string;
  execution_end: string;
  available_to_runtime_at: string;
  determinism_hash: string;
  canonical_payload: Record<string, unknown>;
  source_fact_id: string;
};

export type Cap05ActionFeedbackEvidenceRowV1 = {
  action_feedback_object_id: string;
  evidence_kind: "DECISION" | "APPROVED_PLAN" | "RECEIPT" | "AS_EXECUTED" | "ACCEPTANCE" | "TASK";
  evidence_ref: string;
  evidence_hash: string | null;
  source_fact_id: string;
};

export type Cap05ForecastResidualProjectionRowV1 = {
  residual_object_id: string;
  tenant_id: string;
  project_id: string;
  group_id: string;
  field_id: string;
  season_id: string;
  zone_id: string;
  logical_time: string;
  as_of: string;
  forecast_run_ref: string;
  forecast_run_hash: string;
  forecast_point_ref: string;
  forecast_point_hash: string;
  actual_observation_ref: string;
  actual_observation_hash: string;
  predicted_observation_value: string;
  predicted_observation_variance: string;
  actual_observation_value: string;
  actual_observation_variance: string;
  representativeness_variance: string;
  residual_value: string;
  normalized_residual: string | null;
  assimilation_update_ref: string | null;
  assimilation_update_hash: string | null;
  determinism_hash: string;
  canonical_payload: Record<string, unknown>;
  source_fact_id: string;
};

export type Cap05ApprovedPlanEvidenceV1 = {
  record_type: "approved_irrigation_plan_snapshot_v1";
  source_record_id: string;
  source_record_hash: string;
  binding_id: string;
  tenant_id: string;
  project_id: string;
  group_id: string;
  field_id: string;
  season_id: string;
  zone_id: string;
  canonical_payload: {
    approval_assertion_ref: string;
    approval_assertion_hash: string;
    decision_request_ref: string;
    decision_request_hash: string;
    selected_option_ref: string;
    selected_option_hash: string;
    scenario_amount_mm: string | number;
    approved_amount_mm: string | number;
    supersedes_plan_evidence_ref?: string;
    supersedes_plan_evidence_hash?: string;
    active_for_decision: boolean;
  };
  role_time: {
    plan_effective_from: string;
    plan_effective_to: string;
  };
};

export type Cap05ApprovedPlanBindingProjectionRowV1 = {
  approved_plan_evidence_ref: string;
  approved_plan_evidence_hash: string;
  tenant_id: string;
  project_id: string;
  group_id: string;
  field_id: string;
  season_id: string;
  zone_id: string;
  binding_id: string;
  approval_assertion_ref: string;
  approval_assertion_hash: string;
  decision_request_ref: string;
  decision_request_hash: string;
  selected_option_ref: string;
  selected_option_hash: string;
  scenario_amount_mm: string;
  approved_amount_mm: string;
  plan_effective_from: string;
  plan_effective_to: string;
  active_for_decision: boolean;
  canonical_evidence: Record<string, unknown>;
  source_fact_id: string;
};

export type Cap05FeedbackCycleProjectionRowV1 = {
  projection_id: string;
  projection_hash: string;
  decision_ref: string;
  action_feedback_ref: string;
  approved_plan_ref: string;
  dispatch_disposition: string;
  outcome_observation_ref: string;
  forecast_residual_ref: string;
  assimilation_update_ref: string;
  updated_state_ref: string;
  canonical_projection: Record<string, unknown>;
  source_fact_refs: Record<string, string>;
};

function requiredStringV1(value: unknown, code: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(code);
  return value;
}

function canonicalInstantV1(value: unknown, code: string): string {
  const text = requiredStringV1(value, code);
  const parsed = Date.parse(text);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== text) throw new Error(code);
  return text;
}

function decimalTextV1(value: unknown, code: string): string {
  const text = typeof value === "number" && Number.isFinite(value) ? value.toString() : value;
  return formatFixedDecimalV1(parseFixedDecimalV1(text, WATER_AMOUNT_SCALE_V1, code), WATER_AMOUNT_SCALE_V1);
}

export function buildCap05DecisionProjectionRowV1(
  object: Cap05DecisionEnvelopeV1,
  sourceFactId: string,
): Cap05DecisionProjectionRowV1 {
  return {
    decision_object_id: object.object_id,
    tenant_id: object.tenant_id,
    project_id: object.project_id,
    group_id: object.group_id,
    field_id: object.field_id,
    season_id: object.season_id,
    zone_id: object.zone_id,
    logical_time: canonicalInstantV1(object.logical_time, "CAP05_DECISION_PROJECTION_LOGICAL_TIME_INVALID"),
    as_of: canonicalInstantV1(object.as_of, "CAP05_DECISION_PROJECTION_AS_OF_INVALID"),
    scenario_set_ref: object.payload.scenario_set_ref,
    scenario_set_hash: object.payload.scenario_set_hash,
    selected_option_ref: object.payload.selected_option_ref,
    selected_option_hash: object.payload.selected_option_hash,
    selected_option_id: object.payload.selected_option_id,
    decision_request_evidence_ref: object.payload.decision_request_evidence_ref,
    decision_request_evidence_hash: object.payload.decision_request_evidence_hash,
    actor_ref: object.payload.actor_ref,
    determinism_hash: object.determinism_hash,
    canonical_payload: structuredClone(object.payload),
    source_fact_id: requiredStringV1(sourceFactId, "CAP05_DECISION_PROJECTION_FACT_ID_REQUIRED"),
  };
}

export function buildCap05ActionFeedbackProjectionRowsV1(
  object: Cap05ActionFeedbackEnvelopeV1,
  sourceFactId: string,
): { feedback: Cap05ActionFeedbackProjectionRowV1; evidence: Cap05ActionFeedbackEvidenceRowV1[] } {
  const factId = requiredStringV1(sourceFactId, "CAP05_ACTION_FEEDBACK_PROJECTION_FACT_ID_REQUIRED");
  const payload = object.payload;
  const evidence: Cap05ActionFeedbackEvidenceRowV1[] = [
    {
      action_feedback_object_id: object.object_id,
      evidence_kind: "DECISION",
      evidence_ref: payload.decision_ref,
      evidence_hash: payload.decision_hash,
      source_fact_id: factId,
    },
    {
      action_feedback_object_id: object.object_id,
      evidence_kind: "APPROVED_PLAN",
      evidence_ref: payload.approved_plan_evidence_ref,
      evidence_hash: payload.approved_plan_evidence_hash,
      source_fact_id: factId,
    },
  ];
  for (const [kind, ref, hash] of [
    ["RECEIPT", payload.receipt_ref, null],
    ["AS_EXECUTED", payload.as_executed_ref, null],
    ["ACCEPTANCE", payload.acceptance_ref, null],
    ["TASK", payload.task_ref, null],
  ] as const) {
    if (ref) evidence.push({ action_feedback_object_id: object.object_id, evidence_kind: kind, evidence_ref: ref, evidence_hash: hash, source_fact_id: factId });
  }
  return {
    feedback: {
      action_feedback_object_id: object.object_id,
      tenant_id: object.tenant_id,
      project_id: object.project_id,
      group_id: object.group_id,
      field_id: object.field_id,
      season_id: object.season_id,
      zone_id: object.zone_id,
      logical_time: canonicalInstantV1(object.logical_time, "CAP05_ACTION_FEEDBACK_PROJECTION_LOGICAL_TIME_INVALID"),
      as_of: canonicalInstantV1(object.as_of, "CAP05_ACTION_FEEDBACK_PROJECTION_AS_OF_INVALID"),
      decision_ref: payload.decision_ref,
      decision_hash: payload.decision_hash,
      approved_plan_evidence_ref: payload.approved_plan_evidence_ref,
      approved_plan_evidence_hash: payload.approved_plan_evidence_hash,
      dispatch_disposition: payload.dispatch_disposition,
      event_id: payload.event_id,
      source_record_id: payload.source_record_id,
      binding_id: payload.binding_id,
      origin_source_id: payload.origin_source_id,
      execution_status: payload.execution_status,
      validation_status: payload.validation_status,
      source_quality: payload.source_quality,
      eligible_for_state_input: payload.eligible_for_state_input,
      actual_amount_mm: payload.actual_amount_mm,
      spatial_coverage_fraction: payload.spatial_coverage_fraction,
      target_scope_equivalent_irrigation_mm: payload.target_scope_equivalent_irrigation_mm,
      execution_start: canonicalInstantV1(payload.execution_start, "CAP05_ACTION_FEEDBACK_PROJECTION_START_INVALID"),
      execution_end: canonicalInstantV1(payload.execution_end, "CAP05_ACTION_FEEDBACK_PROJECTION_END_INVALID"),
      available_to_runtime_at: canonicalInstantV1(payload.available_to_runtime_at, "CAP05_ACTION_FEEDBACK_PROJECTION_AVAILABLE_INVALID"),
      determinism_hash: object.determinism_hash,
      canonical_payload: structuredClone(payload),
      source_fact_id: factId,
    },
    evidence,
  };
}

export function buildCap05ForecastResidualProjectionRowV1(
  object: Cap05ForecastResidualEnvelopeV1,
  sourceFactId: string,
): Cap05ForecastResidualProjectionRowV1 {
  const payload = object.payload;
  return {
    residual_object_id: object.object_id,
    tenant_id: object.tenant_id,
    project_id: object.project_id,
    group_id: object.group_id,
    field_id: object.field_id,
    season_id: object.season_id,
    zone_id: object.zone_id,
    logical_time: canonicalInstantV1(object.logical_time, "CAP05_RESIDUAL_PROJECTION_LOGICAL_TIME_INVALID"),
    as_of: canonicalInstantV1(object.as_of, "CAP05_RESIDUAL_PROJECTION_AS_OF_INVALID"),
    forecast_run_ref: payload.forecast_run_ref,
    forecast_run_hash: payload.forecast_run_hash,
    forecast_point_ref: payload.forecast_point_ref,
    forecast_point_hash: payload.forecast_point_hash,
    actual_observation_ref: payload.actual_observation_ref,
    actual_observation_hash: payload.actual_observation_hash,
    predicted_observation_value: payload.predicted_observation_value,
    predicted_observation_variance: payload.predicted_observation_variance,
    actual_observation_value: payload.actual_observation_value,
    actual_observation_variance: payload.actual_observation_variance,
    representativeness_variance: payload.representativeness_variance,
    residual_value: payload.residual_value,
    normalized_residual: payload.normalized_residual,
    assimilation_update_ref: payload.assimilation_update_ref,
    assimilation_update_hash: payload.assimilation_update_hash,
    determinism_hash: object.determinism_hash,
    canonical_payload: structuredClone(payload),
    source_fact_id: requiredStringV1(sourceFactId, "CAP05_RESIDUAL_PROJECTION_FACT_ID_REQUIRED"),
  };
}

export function buildCap05ApprovedPlanBindingProjectionRowV1(
  evidence: Cap05ApprovedPlanEvidenceV1,
  sourceFactId: string,
): Cap05ApprovedPlanBindingProjectionRowV1 {
  if (evidence.record_type !== "approved_irrigation_plan_snapshot_v1") throw new Error("CAP05_APPROVED_PLAN_RECORD_TYPE_MISMATCH");
  const payload = evidence.canonical_payload;
  return {
    approved_plan_evidence_ref: requiredStringV1(evidence.source_record_id, "CAP05_APPROVED_PLAN_SOURCE_RECORD_ID_REQUIRED"),
    approved_plan_evidence_hash: requiredStringV1(evidence.source_record_hash, "CAP05_APPROVED_PLAN_SOURCE_HASH_REQUIRED"),
    tenant_id: requiredStringV1(evidence.tenant_id, "CAP05_APPROVED_PLAN_TENANT_REQUIRED"),
    project_id: requiredStringV1(evidence.project_id, "CAP05_APPROVED_PLAN_PROJECT_REQUIRED"),
    group_id: requiredStringV1(evidence.group_id, "CAP05_APPROVED_PLAN_GROUP_REQUIRED"),
    field_id: requiredStringV1(evidence.field_id, "CAP05_APPROVED_PLAN_FIELD_REQUIRED"),
    season_id: requiredStringV1(evidence.season_id, "CAP05_APPROVED_PLAN_SEASON_REQUIRED"),
    zone_id: requiredStringV1(evidence.zone_id, "CAP05_APPROVED_PLAN_ZONE_REQUIRED"),
    binding_id: requiredStringV1(evidence.binding_id, "CAP05_APPROVED_PLAN_BINDING_REQUIRED"),
    approval_assertion_ref: requiredStringV1(payload.approval_assertion_ref, "CAP05_APPROVED_PLAN_ASSERTION_REF_REQUIRED"),
    approval_assertion_hash: requiredStringV1(payload.approval_assertion_hash, "CAP05_APPROVED_PLAN_ASSERTION_HASH_REQUIRED"),
    decision_request_ref: requiredStringV1(payload.decision_request_ref, "CAP05_APPROVED_PLAN_DECISION_REF_REQUIRED"),
    decision_request_hash: requiredStringV1(payload.decision_request_hash, "CAP05_APPROVED_PLAN_DECISION_HASH_REQUIRED"),
    selected_option_ref: requiredStringV1(payload.selected_option_ref, "CAP05_APPROVED_PLAN_OPTION_REF_REQUIRED"),
    selected_option_hash: requiredStringV1(payload.selected_option_hash, "CAP05_APPROVED_PLAN_OPTION_HASH_REQUIRED"),
    scenario_amount_mm: decimalTextV1(payload.scenario_amount_mm, "CAP05_APPROVED_PLAN_SCENARIO_AMOUNT_INVALID"),
    approved_amount_mm: decimalTextV1(payload.approved_amount_mm, "CAP05_APPROVED_PLAN_APPROVED_AMOUNT_INVALID"),
    plan_effective_from: canonicalInstantV1(evidence.role_time.plan_effective_from, "CAP05_APPROVED_PLAN_EFFECTIVE_FROM_INVALID"),
    plan_effective_to: canonicalInstantV1(evidence.role_time.plan_effective_to, "CAP05_APPROVED_PLAN_EFFECTIVE_TO_INVALID"),
    active_for_decision: payload.active_for_decision === true,
    canonical_evidence: structuredClone(evidence as unknown as Record<string, unknown>),
    source_fact_id: requiredStringV1(sourceFactId, "CAP05_APPROVED_PLAN_FACT_ID_REQUIRED"),
  };
}

export function buildCap05FeedbackCycleProjectionRowV1(
  projection: Cap05FeedbackCycleProjectionV1,
  sourceFactRefs: Record<string, string>,
): Cap05FeedbackCycleProjectionRowV1 {
  return {
    projection_id: projection.projection_id,
    projection_hash: projection.projection_hash,
    decision_ref: projection.decision.ref,
    action_feedback_ref: projection.execution.action_feedback_ref,
    approved_plan_ref: projection.approval.plan_ref,
    dispatch_disposition: projection.dispatch.disposition,
    outcome_observation_ref: projection.outcome_observation.ref,
    forecast_residual_ref: projection.forecast_residual.ref,
    assimilation_update_ref: projection.assimilation.ref,
    updated_state_ref: projection.updated_state.ref,
    canonical_projection: structuredClone(projection as unknown as Record<string, unknown>),
    source_fact_refs: structuredClone(sourceFactRefs),
  };
}
