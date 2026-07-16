// apps/server/src/projections/twin_runtime/calibration_governance_projection_v1.ts
// Purpose: derive rebuildable MCFT-CAP-06 Candidate, Evaluation, Candidate-to-Evaluation and embedded-case projection rows from canonical D objects.
// Boundary: pure deterministic mapping only; no database, canonical append, active-config index, State, checkpoint, approval, route, scheduler or Model Activation authority.

import type {
  Cap06CalibrationCandidateDraftV1,
  Cap06ShadowEvaluationDraftV1,
} from "../../domain/calibration/envelope_profiles_v1.js";
import type { Cap06ShadowCaseResultV1 } from "../../domain/calibration/contracts_v1.js";

export type Cap06CalibrationCandidateProjectionRowV1 = {
  candidate_object_id: string;
  tenant_id: string;
  project_id: string;
  group_id: string;
  field_id: string;
  season_id: string;
  zone_id: string;
  logical_time: string;
  as_of: string;
  runtime_config_ref: string;
  runtime_config_hash: string;
  context_lineage_ref: string;
  context_revision_ref: string;
  candidate_status: string;
  calibration_run_id: string;
  base_parameter_value: string;
  candidate_parameter_value: string;
  parameter_delta: string;
  activation_status: string;
  eligible_for_state_input: boolean;
  eligible_for_runtime_config_use: boolean;
  eligible_for_human_activation_review: boolean;
  determinism_hash: string;
  canonical_payload: Cap06CalibrationCandidateDraftV1;
  source_fact_id: string;
};

export type Cap06ShadowEvaluationProjectionRowV1 = {
  evaluation_object_id: string;
  tenant_id: string;
  project_id: string;
  group_id: string;
  field_id: string;
  season_id: string;
  zone_id: string;
  logical_time: string;
  as_of: string;
  runtime_config_ref: string;
  runtime_config_hash: string;
  candidate_ref: string;
  candidate_hash: string;
  evaluation_kind: string;
  evaluation_disposition: string;
  eligible_for_human_activation_review: boolean;
  holdout_window_ref_membership_hash: string;
  holdout_purpose: string;
  holdout_generalization_claim: string;
  case_results_hash: string;
  model_activation_created: boolean;
  active_config_switch_performed: boolean;
  approval_created: boolean;
  activation_authorized: boolean;
  determinism_hash: string;
  canonical_payload: Cap06ShadowEvaluationDraftV1;
  source_fact_id: string;
};

export type Cap06CandidateEvaluationIndexRowV1 = {
  candidate_ref: string;
  evaluation_ref: string;
  evaluation_hash: string;
  evaluation_disposition: string;
  source_fact_id: string;
};

export type Cap06ShadowEvaluationCaseProjectionRowV1 = Cap06ShadowCaseResultV1 & {
  evaluation_ref: string;
  source_fact_id: string;
};

function requiredStringV1(value: unknown, code: string): string {
  if (typeof value !== "string" || value.length === 0) throw new Error(code);
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

function requiredCaseResultsV1(value: unknown): Cap06ShadowCaseResultV1[] {
  if (!Array.isArray(value) || value.length !== 8) throw new Error("CAP06_EVALUATION_CASE_RESULTS_8_REQUIRED");
  return value.map((item, index) => {
    const record = requiredRecordV1(item, `CAP06_EVALUATION_CASE_RESULT_INVALID:${index}`);
    if (!Number.isSafeInteger(record.case_index) || Number(record.case_index) < 0) {
      throw new Error(`CAP06_EVALUATION_CASE_INDEX_INVALID:${index}`);
    }
    return structuredClone(record) as Cap06ShadowCaseResultV1;
  });
}

export function buildCap06CalibrationCandidateProjectionRowV1(
  object: Cap06CalibrationCandidateDraftV1,
  sourceFactId: string,
): Cap06CalibrationCandidateProjectionRowV1 {
  const payload = requiredRecordV1(object.payload, "CAP06_CANDIDATE_PAYLOAD_REQUIRED");
  return {
    candidate_object_id: object.object_id,
    tenant_id: object.scope.tenant_id,
    project_id: object.scope.project_id,
    group_id: object.scope.group_id,
    field_id: object.scope.field_id,
    season_id: object.scope.season_id,
    zone_id: object.scope.zone_id,
    logical_time: object.logical_time,
    as_of: object.as_of,
    runtime_config_ref: object.runtime_config_ref,
    runtime_config_hash: object.runtime_config_hash,
    context_lineage_ref: object.context_lineage_ref,
    context_revision_ref: object.context_revision_ref,
    candidate_status: requiredStringV1(payload.candidate_status, "CAP06_CANDIDATE_STATUS_REQUIRED"),
    calibration_run_id: requiredStringV1(payload.calibration_run_id, "CAP06_CALIBRATION_RUN_ID_REQUIRED"),
    base_parameter_value: requiredStringV1(payload.base_parameter_value, "CAP06_BASE_PARAMETER_REQUIRED"),
    candidate_parameter_value: requiredStringV1(payload.candidate_parameter_value, "CAP06_CANDIDATE_PARAMETER_REQUIRED"),
    parameter_delta: requiredStringV1(payload.parameter_delta, "CAP06_PARAMETER_DELTA_REQUIRED"),
    activation_status: requiredStringV1(payload.activation_status, "CAP06_ACTIVATION_STATUS_REQUIRED"),
    eligible_for_state_input: requiredBooleanV1(payload.eligible_for_state_input, "CAP06_STATE_ELIGIBILITY_REQUIRED"),
    eligible_for_runtime_config_use: requiredBooleanV1(payload.eligible_for_runtime_config_use, "CAP06_CONFIG_ELIGIBILITY_REQUIRED"),
    eligible_for_human_activation_review: requiredBooleanV1(
      payload.eligible_for_human_activation_review,
      "CAP06_CANDIDATE_REVIEW_ELIGIBILITY_REQUIRED",
    ),
    determinism_hash: object.determinism_hash,
    canonical_payload: structuredClone(object),
    source_fact_id: sourceFactId,
  };
}

export function buildCap06ShadowEvaluationProjectionRowsV1(
  object: Cap06ShadowEvaluationDraftV1,
  sourceFactId: string,
): {
  evaluation: Cap06ShadowEvaluationProjectionRowV1;
  candidate_index: Cap06CandidateEvaluationIndexRowV1;
  cases: Cap06ShadowEvaluationCaseProjectionRowV1[];
} {
  const payload = requiredRecordV1(object.payload, "CAP06_EVALUATION_PAYLOAD_REQUIRED");
  const candidateRef = requiredStringV1(payload.candidate_ref, "CAP06_EVALUATION_CANDIDATE_REF_REQUIRED");
  const candidateHash = requiredStringV1(payload.candidate_hash, "CAP06_EVALUATION_CANDIDATE_HASH_REQUIRED");
  const disposition = requiredStringV1(
    payload.evaluation_disposition,
    "CAP06_EVALUATION_DISPOSITION_REQUIRED",
  );
  const cases = requiredCaseResultsV1(payload.case_results).map((item) => ({
    ...item,
    evaluation_ref: object.object_id,
    source_fact_id: sourceFactId,
  }));
  return {
    evaluation: {
      evaluation_object_id: object.object_id,
      tenant_id: object.scope.tenant_id,
      project_id: object.scope.project_id,
      group_id: object.scope.group_id,
      field_id: object.scope.field_id,
      season_id: object.scope.season_id,
      zone_id: object.scope.zone_id,
      logical_time: object.logical_time,
      as_of: object.as_of,
      runtime_config_ref: object.runtime_config_ref,
      runtime_config_hash: object.runtime_config_hash,
      candidate_ref: candidateRef,
      candidate_hash: candidateHash,
      evaluation_kind: requiredStringV1(payload.evaluation_kind, "CAP06_EVALUATION_KIND_REQUIRED"),
      evaluation_disposition: disposition,
      eligible_for_human_activation_review: requiredBooleanV1(
        payload.eligible_for_human_activation_review,
        "CAP06_EVALUATION_REVIEW_ELIGIBILITY_REQUIRED",
      ),
      holdout_window_ref_membership_hash: requiredStringV1(
        payload.holdout_window_ref_membership_hash,
        "CAP06_HOLDOUT_WINDOW_HASH_REQUIRED",
      ),
      holdout_purpose: requiredStringV1(payload.holdout_purpose, "CAP06_HOLDOUT_PURPOSE_REQUIRED"),
      holdout_generalization_claim: requiredStringV1(
        payload.holdout_generalization_claim,
        "CAP06_HOLDOUT_GENERALIZATION_REQUIRED",
      ),
      case_results_hash: requiredStringV1(payload.case_results_hash, "CAP06_CASE_RESULTS_HASH_REQUIRED"),
      model_activation_created: requiredBooleanV1(payload.model_activation_created, "CAP06_MODEL_ACTIVATION_FLAG_REQUIRED"),
      active_config_switch_performed: requiredBooleanV1(
        payload.active_config_switch_performed,
        "CAP06_ACTIVE_CONFIG_SWITCH_FLAG_REQUIRED",
      ),
      approval_created: requiredBooleanV1(payload.approval_created, "CAP06_APPROVAL_CREATED_FLAG_REQUIRED"),
      activation_authorized: requiredBooleanV1(payload.activation_authorized, "CAP06_ACTIVATION_AUTHORIZED_FLAG_REQUIRED"),
      determinism_hash: object.determinism_hash,
      canonical_payload: structuredClone(object),
      source_fact_id: sourceFactId,
    },
    candidate_index: {
      candidate_ref: candidateRef,
      evaluation_ref: object.object_id,
      evaluation_hash: object.determinism_hash,
      evaluation_disposition: disposition,
      source_fact_id: sourceFactId,
    },
    cases,
  };
}
