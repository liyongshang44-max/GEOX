// apps/server/src/projections/calibration/calibration_governance_projection_v1.ts
// Purpose: derive deterministic rebuildable PostgreSQL rows from MCFT-CAP-06 Calibration Candidate and Shadow Evaluation canonical objects.
// Boundary: pure projection-row construction only; no database access, canonical append, Runtime authority, State, checkpoint, approval, activation, route, scheduler, filesystem, environment, or network.

import {
  parseFixedDecimalV1,
} from "../../domain/soil_water/fixed_point_water_decimal_v1.js";
import {
  CAP06_CANDIDATE_APPENDING_STATUSES_V1,
  CAP06_SHADOW_DISPOSITIONS_V1,
  type Cap06CandidateAppendingStatusV1,
  type Cap06ShadowCaseResultV1,
  type Cap06ShadowDispositionV1,
} from "../../domain/calibration/contracts_v1.js";
import type {
  Cap06CalibrationCandidateDraftV1,
  Cap06ShadowEvaluationDraftV1,
} from "../../domain/calibration/envelope_profiles_v1.js";

export type Cap06CandidateProjectionRowV1 = {
  candidate_object_id: string;
  tenant_id: string;
  project_id: string;
  group_id: string;
  field_id: string;
  season_id: string;
  zone_id: string;
  logical_time: string;
  as_of: string;
  candidate_status: Cap06CandidateAppendingStatusV1;
  base_config_ref: string;
  base_config_hash: string;
  context_lineage_ref: string;
  context_revision_ref: string;
  parameter_key: string;
  base_parameter_value: string;
  candidate_parameter_value: string;
  parameter_delta: string;
  activation_status: "NOT_ACTIVE";
  eligible_for_state_input: false;
  eligible_for_runtime_config_use: false;
  eligible_for_human_activation_review: false;
  determinism_hash: string;
  canonical_payload: Record<string, unknown>;
  source_fact_id: string;
};

export type Cap06EvaluationProjectionRowV1 = {
  evaluation_object_id: string;
  tenant_id: string;
  project_id: string;
  group_id: string;
  field_id: string;
  season_id: string;
  zone_id: string;
  logical_time: string;
  as_of: string;
  candidate_ref: string;
  candidate_hash: string;
  evaluation_dataset_hash: string;
  evaluation_policy_hash: string;
  shadow_replay_engine_id: string;
  calibration_metric_numeric_policy_hash: string;
  evaluation_disposition: Cap06ShadowDispositionV1;
  eligible_for_human_activation_review: boolean;
  determinism_hash: string;
  canonical_payload: Record<string, unknown>;
  source_fact_id: string;
};

export type Cap06CandidateEvaluationIndexRowV1 = {
  candidate_ref: string;
  evaluation_object_id: string;
  evaluation_dataset_hash: string;
  evaluation_policy_hash: string;
  shadow_replay_engine_id: string;
  calibration_metric_numeric_policy_hash: string;
  evaluation_disposition: Cap06ShadowDispositionV1;
  source_fact_id: string;
};

export type Cap06EvaluationCaseProjectionRowV1 = {
  evaluation_object_id: string;
  case_index: number;
  residual_ref: string;
  residual_hash: string;
  source_forecast_ref: string;
  source_forecast_hash: string;
  source_forecast_point_ref: string;
  source_posterior_ref: string;
  source_runtime_config_ref: string;
  forecast_target_time: string;
  observation_ref: string;
  observation_available_to_runtime_at: string;
  base_parameter_value: string;
  candidate_parameter_value: string;
  base_prediction_vwc: string;
  candidate_prediction_vwc: string;
  actual_observation_vwc: string;
  base_residual_vwc: string;
  candidate_residual_vwc: string;
  base_mass_balance_hash: string;
  candidate_mass_balance_hash: string;
  base_invariant_status: "PASS" | "FAIL";
  candidate_invariant_status: "PASS" | "FAIL";
  canonical_case_result: Record<string, unknown>;
  source_fact_id: string;
};

function requiredStringV1(value: unknown, code: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(code);
  return value;
}

function requiredBooleanV1(value: unknown, code: string): boolean {
  if (typeof value !== "boolean") throw new Error(code);
  return value;
}

function requiredRecordV1(value: unknown, code: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(code);
  return value as Record<string, unknown>;
}

function canonicalInstantV1(value: unknown, code: string): string {
  const text = requiredStringV1(value, code);
  const parsed = Date.parse(text);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== text) throw new Error(code);
  return text;
}

function exactFixedV1(value: unknown, scale: number, code: string): string {
  const text = requiredStringV1(value, code);
  parseFixedDecimalV1(text, scale, code);
  return text;
}

function candidateStatusV1(value: unknown): Cap06CandidateAppendingStatusV1 {
  if (!CAP06_CANDIDATE_APPENDING_STATUSES_V1.includes(value as Cap06CandidateAppendingStatusV1)) {
    throw new Error("CAP06_CANDIDATE_PROJECTION_STATUS_INVALID");
  }
  return value as Cap06CandidateAppendingStatusV1;
}

function evaluationDispositionV1(value: unknown): Cap06ShadowDispositionV1 {
  if (!CAP06_SHADOW_DISPOSITIONS_V1.includes(value as Cap06ShadowDispositionV1)) {
    throw new Error("CAP06_EVALUATION_PROJECTION_DISPOSITION_INVALID");
  }
  return value as Cap06ShadowDispositionV1;
}

function exactCaseResultV1(value: unknown): Cap06ShadowCaseResultV1 {
  const record = requiredRecordV1(value, "CAP06_EVALUATION_CASE_RESULT_REQUIRED");
  if (!Number.isSafeInteger(record.case_index) || Number(record.case_index) < 0) {
    throw new Error("CAP06_EVALUATION_CASE_INDEX_INVALID");
  }
  for (const key of [
    "residual_ref",
    "residual_hash",
    "source_forecast_ref",
    "source_forecast_hash",
    "source_forecast_point_ref",
    "source_posterior_ref",
    "source_runtime_config_ref",
    "forecast_issued_at",
    "forecast_as_of",
    "forecast_target_time",
    "observation_ref",
    "observation_observed_at",
    "observation_available_to_runtime_at",
    "base_mass_balance_hash",
    "candidate_mass_balance_hash",
  ] as const) {
    requiredStringV1(record[key], `CAP06_EVALUATION_CASE_${key.toUpperCase()}_REQUIRED`);
  }
  for (const key of [
    "base_parameter_value",
    "candidate_parameter_value",
  ] as const) {
    exactFixedV1(record[key], 6, `CAP06_EVALUATION_CASE_${key.toUpperCase()}_INVALID`);
  }
  for (const key of [
    "base_prediction_vwc",
    "candidate_prediction_vwc",
    "actual_observation_vwc",
    "base_residual_vwc",
    "candidate_residual_vwc",
  ] as const) {
    exactFixedV1(record[key], 9, `CAP06_EVALUATION_CASE_${key.toUpperCase()}_INVALID`);
  }
  for (const key of [
    "base_invariant_status",
    "candidate_invariant_status",
    "base_mass_balance_status",
    "candidate_mass_balance_status",
  ] as const) {
    if (record[key] !== "PASS" && record[key] !== "FAIL") {
      throw new Error(`CAP06_EVALUATION_CASE_${key.toUpperCase()}_INVALID`);
    }
  }
  return structuredClone(record) as unknown as Cap06ShadowCaseResultV1;
}

export function buildCap06CandidateProjectionRowV1(
  object: Cap06CalibrationCandidateDraftV1,
  sourceFactId: string,
): Cap06CandidateProjectionRowV1 {
  const payload = requiredRecordV1(object.payload, "CAP06_CANDIDATE_PROJECTION_PAYLOAD_REQUIRED");
  const scope = requiredRecordV1(object.scope, "CAP06_CANDIDATE_PROJECTION_SCOPE_REQUIRED");
  const candidateStatus = candidateStatusV1(payload.candidate_status);
  const activationStatus = requiredStringV1(payload.activation_status, "CAP06_CANDIDATE_PROJECTION_ACTIVATION_STATUS_REQUIRED");
  if (activationStatus !== "NOT_ACTIVE") throw new Error("CAP06_CANDIDATE_PROJECTION_ACTIVE_FORBIDDEN");
  if (requiredBooleanV1(payload.eligible_for_state_input, "CAP06_CANDIDATE_PROJECTION_STATE_ELIGIBILITY_REQUIRED")) {
    throw new Error("CAP06_CANDIDATE_PROJECTION_STATE_ELIGIBILITY_FORBIDDEN");
  }
  if (requiredBooleanV1(payload.eligible_for_runtime_config_use, "CAP06_CANDIDATE_PROJECTION_CONFIG_ELIGIBILITY_REQUIRED")) {
    throw new Error("CAP06_CANDIDATE_PROJECTION_CONFIG_ELIGIBILITY_FORBIDDEN");
  }
  if (requiredBooleanV1(payload.eligible_for_human_activation_review, "CAP06_CANDIDATE_PROJECTION_REVIEW_ELIGIBILITY_REQUIRED")) {
    throw new Error("CAP06_CANDIDATE_PROJECTION_PREMATURE_REVIEW_ELIGIBILITY");
  }
  return {
    candidate_object_id: requiredStringV1(object.object_id, "CAP06_CANDIDATE_PROJECTION_OBJECT_ID_REQUIRED"),
    tenant_id: requiredStringV1(scope.tenant_id, "CAP06_CANDIDATE_PROJECTION_TENANT_REQUIRED"),
    project_id: requiredStringV1(scope.project_id, "CAP06_CANDIDATE_PROJECTION_PROJECT_REQUIRED"),
    group_id: requiredStringV1(scope.group_id, "CAP06_CANDIDATE_PROJECTION_GROUP_REQUIRED"),
    field_id: requiredStringV1(scope.field_id, "CAP06_CANDIDATE_PROJECTION_FIELD_REQUIRED"),
    season_id: requiredStringV1(scope.season_id, "CAP06_CANDIDATE_PROJECTION_SEASON_REQUIRED"),
    zone_id: requiredStringV1(scope.zone_id, "CAP06_CANDIDATE_PROJECTION_ZONE_REQUIRED"),
    logical_time: canonicalInstantV1(object.logical_time, "CAP06_CANDIDATE_PROJECTION_LOGICAL_TIME_INVALID"),
    as_of: canonicalInstantV1(object.as_of, "CAP06_CANDIDATE_PROJECTION_AS_OF_INVALID"),
    candidate_status: candidateStatus,
    base_config_ref: requiredStringV1(payload.base_config_ref, "CAP06_CANDIDATE_PROJECTION_BASE_CONFIG_REF_REQUIRED"),
    base_config_hash: requiredStringV1(payload.base_config_hash, "CAP06_CANDIDATE_PROJECTION_BASE_CONFIG_HASH_REQUIRED"),
    context_lineage_ref: requiredStringV1(object.context_lineage_ref, "CAP06_CANDIDATE_PROJECTION_LINEAGE_REQUIRED"),
    context_revision_ref: requiredStringV1(object.context_revision_ref, "CAP06_CANDIDATE_PROJECTION_REVISION_REQUIRED"),
    parameter_key: requiredStringV1(payload.parameter_key, "CAP06_CANDIDATE_PROJECTION_PARAMETER_KEY_REQUIRED"),
    base_parameter_value: exactFixedV1(payload.base_parameter_value, 6, "CAP06_CANDIDATE_PROJECTION_BASE_PARAMETER_INVALID"),
    candidate_parameter_value: exactFixedV1(payload.candidate_parameter_value, 6, "CAP06_CANDIDATE_PROJECTION_PARAMETER_INVALID"),
    parameter_delta: exactFixedV1(payload.parameter_delta, 6, "CAP06_CANDIDATE_PROJECTION_DELTA_INVALID"),
    activation_status: "NOT_ACTIVE",
    eligible_for_state_input: false,
    eligible_for_runtime_config_use: false,
    eligible_for_human_activation_review: false,
    determinism_hash: requiredStringV1(object.determinism_hash, "CAP06_CANDIDATE_PROJECTION_HASH_REQUIRED"),
    canonical_payload: structuredClone(payload),
    source_fact_id: requiredStringV1(sourceFactId, "CAP06_CANDIDATE_PROJECTION_FACT_ID_REQUIRED"),
  };
}

export function buildCap06EvaluationProjectionRowsV1(
  object: Cap06ShadowEvaluationDraftV1,
  sourceFactId: string,
): {
  evaluation: Cap06EvaluationProjectionRowV1;
  candidate_index: Cap06CandidateEvaluationIndexRowV1;
  case_results: Cap06EvaluationCaseProjectionRowV1[];
} {
  const payload = requiredRecordV1(object.payload, "CAP06_EVALUATION_PROJECTION_PAYLOAD_REQUIRED");
  const scope = requiredRecordV1(object.scope, "CAP06_EVALUATION_PROJECTION_SCOPE_REQUIRED");
  const factId = requiredStringV1(sourceFactId, "CAP06_EVALUATION_PROJECTION_FACT_ID_REQUIRED");
  const candidateRef = requiredStringV1(payload.candidate_ref, "CAP06_EVALUATION_PROJECTION_CANDIDATE_REF_REQUIRED");
  const candidateHash = requiredStringV1(payload.candidate_hash, "CAP06_EVALUATION_PROJECTION_CANDIDATE_HASH_REQUIRED");
  const evaluationDatasetHash = requiredStringV1(payload.evaluation_dataset_hash, "CAP06_EVALUATION_PROJECTION_DATASET_HASH_REQUIRED");
  const evaluationPolicyHash = requiredStringV1(payload.evaluation_policy_hash, "CAP06_EVALUATION_PROJECTION_POLICY_HASH_REQUIRED");
  const replayEngineId = requiredStringV1(payload.shadow_replay_engine_id, "CAP06_EVALUATION_PROJECTION_ENGINE_REQUIRED");
  const metricNumericPolicyHash = requiredStringV1(
    payload.calibration_metric_numeric_policy_hash,
    "CAP06_EVALUATION_PROJECTION_METRIC_POLICY_HASH_REQUIRED",
  );
  const disposition = evaluationDispositionV1(payload.evaluation_disposition);
  const eligibleForReview = requiredBooleanV1(
    payload.eligible_for_human_activation_review,
    "CAP06_EVALUATION_PROJECTION_REVIEW_ELIGIBILITY_REQUIRED",
  );
  if (payload.model_activation_created !== false
    || payload.active_config_switch_performed !== false
    || payload.approval_created !== false
    || payload.activation_authorized !== false) {
    throw new Error("CAP06_EVALUATION_PROJECTION_ACTIVATION_BOUNDARY_VIOLATION");
  }
  const rawCases = payload.case_results;
  if (!Array.isArray(rawCases) || rawCases.length !== 8) {
    throw new Error("CAP06_EVALUATION_PROJECTION_CASE_COUNT_INVALID");
  }
  const caseResults = rawCases.map(exactCaseResultV1);
  const indices = caseResults.map((item) => item.case_index);
  if (new Set(indices).size !== indices.length) throw new Error("CAP06_EVALUATION_PROJECTION_CASE_INDEX_DUPLICATE");
  return {
    evaluation: {
      evaluation_object_id: requiredStringV1(object.object_id, "CAP06_EVALUATION_PROJECTION_OBJECT_ID_REQUIRED"),
      tenant_id: requiredStringV1(scope.tenant_id, "CAP06_EVALUATION_PROJECTION_TENANT_REQUIRED"),
      project_id: requiredStringV1(scope.project_id, "CAP06_EVALUATION_PROJECTION_PROJECT_REQUIRED"),
      group_id: requiredStringV1(scope.group_id, "CAP06_EVALUATION_PROJECTION_GROUP_REQUIRED"),
      field_id: requiredStringV1(scope.field_id, "CAP06_EVALUATION_PROJECTION_FIELD_REQUIRED"),
      season_id: requiredStringV1(scope.season_id, "CAP06_EVALUATION_PROJECTION_SEASON_REQUIRED"),
      zone_id: requiredStringV1(scope.zone_id, "CAP06_EVALUATION_PROJECTION_ZONE_REQUIRED"),
      logical_time: canonicalInstantV1(object.logical_time, "CAP06_EVALUATION_PROJECTION_LOGICAL_TIME_INVALID"),
      as_of: canonicalInstantV1(object.as_of, "CAP06_EVALUATION_PROJECTION_AS_OF_INVALID"),
      candidate_ref: candidateRef,
      candidate_hash: candidateHash,
      evaluation_dataset_hash: evaluationDatasetHash,
      evaluation_policy_hash: evaluationPolicyHash,
      shadow_replay_engine_id: replayEngineId,
      calibration_metric_numeric_policy_hash: metricNumericPolicyHash,
      evaluation_disposition: disposition,
      eligible_for_human_activation_review: eligibleForReview,
      determinism_hash: requiredStringV1(object.determinism_hash, "CAP06_EVALUATION_PROJECTION_HASH_REQUIRED"),
      canonical_payload: structuredClone(payload),
      source_fact_id: factId,
    },
    candidate_index: {
      candidate_ref: candidateRef,
      evaluation_object_id: object.object_id,
      evaluation_dataset_hash: evaluationDatasetHash,
      evaluation_policy_hash: evaluationPolicyHash,
      shadow_replay_engine_id: replayEngineId,
      calibration_metric_numeric_policy_hash: metricNumericPolicyHash,
      evaluation_disposition: disposition,
      source_fact_id: factId,
    },
    case_results: caseResults.map((item) => ({
      evaluation_object_id: object.object_id,
      case_index: item.case_index,
      residual_ref: item.residual_ref,
      residual_hash: item.residual_hash,
      source_forecast_ref: item.source_forecast_ref,
      source_forecast_hash: item.source_forecast_hash,
      source_forecast_point_ref: item.source_forecast_point_ref,
      source_posterior_ref: item.source_posterior_ref,
      source_runtime_config_ref: item.source_runtime_config_ref,
      forecast_target_time: canonicalInstantV1(item.forecast_target_time, "CAP06_EVALUATION_CASE_TARGET_TIME_INVALID"),
      observation_ref: item.observation_ref,
      observation_available_to_runtime_at: canonicalInstantV1(
        item.observation_available_to_runtime_at,
        "CAP06_EVALUATION_CASE_OBSERVATION_AVAILABILITY_INVALID",
      ),
      base_parameter_value: item.base_parameter_value,
      candidate_parameter_value: item.candidate_parameter_value,
      base_prediction_vwc: item.base_prediction_vwc,
      candidate_prediction_vwc: item.candidate_prediction_vwc,
      actual_observation_vwc: item.actual_observation_vwc,
      base_residual_vwc: item.base_residual_vwc,
      candidate_residual_vwc: item.candidate_residual_vwc,
      base_mass_balance_hash: item.base_mass_balance_hash,
      candidate_mass_balance_hash: item.candidate_mass_balance_hash,
      base_invariant_status: item.base_invariant_status,
      candidate_invariant_status: item.candidate_invariant_status,
      canonical_case_result: structuredClone(item) as unknown as Record<string, unknown>,
      source_fact_id: factId,
    })),
  };
}
