// apps/server/src/domain/calibration/envelope_profiles_v1.ts
// Purpose: map successful MCFT-CAP-06 compute results into deterministic non-lineage Candidate and Evaluation canonical drafts for later D-transaction persistence.
// Boundary: pure draft construction and validation only; no database, projection, append, active Config, State, checkpoint, approval, route, scheduler, or Model Activation write.

import {
  deriveSemanticObjectIdV1,
  semanticHashV1,
} from "../twin_runtime/canonical_identity_v1.js";
import {
  CAP06_BASE_PARAMETER_VALUE_V1,
  CAP06_CALIBRATION_CASE_BUILDER_ID_V1,
  CAP06_CALIBRATION_ENGINE_ID_V1,
  CAP06_CALIBRATION_METRIC_NUMERIC_POLICY_ID_V1,
  CAP06_CANDIDATE_SELECTION_POLICY_ID_V1,
  CAP06_METRIC_POLICY_ID_V1,
  CAP06_PARAMETER_KEY_V1,
  CAP06_RUNTIME_REPLAY_NUMERIC_POLICY_ID_V1,
  CAP06_SEARCH_MAXIMUM_V1,
  CAP06_SEARCH_MINIMUM_V1,
  CAP06_SEARCH_STEP_V1,
  CAP06_SHADOW_EVALUATION_POLICY_ID_V1,
  CAP06_SHADOW_REPLAY_ENGINE_ID_V1,
  isCap06CandidateAppendingStatusV1,
  type Cap06CalibrationAttemptResultV1,
  type Cap06PairedShadowResultV1,
  type Cap06RealityScopeV1,
} from "./contracts_v1.js";
import type { Cap06BuiltCaseWindowV1 } from "./case_builder_v1.js";

export type Cap06CalibrationCandidateDraftV1 = {
  object_id: string;
  object_type: "twin_calibration_candidate_v1";
  schema_version: "v1";
  record_class: "CANONICAL_MODEL_GOVERNANCE_HISTORY";
  lineage_member: false;
  envelope_profile: "NON_LINEAGE_CONTEXT";
  scope: Cap06RealityScopeV1;
  logical_time: string;
  as_of: string;
  source_refs: string[];
  evidence_refs: string[];
  runtime_config_ref: string;
  runtime_config_hash: string;
  idempotency_key: string;
  context_lineage_ref: string;
  context_revision_ref: string;
  payload: Record<string, unknown>;
  limitations: string[];
  determinism_hash: string;
};

export type Cap06ShadowEvaluationDraftV1 = {
  object_id: string;
  object_type: "twin_shadow_evaluation_v1";
  schema_version: "v1";
  record_class: "CANONICAL_MODEL_GOVERNANCE_HISTORY";
  lineage_member: false;
  envelope_profile: "NON_LINEAGE_CONTEXT";
  scope: Cap06RealityScopeV1;
  logical_time: string;
  as_of: string;
  source_refs: string[];
  evidence_refs: string[];
  runtime_config_ref: string;
  runtime_config_hash: string;
  idempotency_key: string;
  payload: Record<string, unknown>;
  limitations: string[];
  determinism_hash: string;
};

const CANDIDATE_LIMITATIONS_V1 = Object.freeze([
  "CONTROLLED_REPLAY_ONLY",
  "SINGLE_PARAMETER_ONLY",
  "NOT_FIELD_CALIBRATED",
  "NOT_TRUE_PARAMETER_IDENTIFICATION",
  "NOT_STATISTICAL_SIGNIFICANCE",
  "NOT_UNCERTAINTY_CALIBRATION",
  "NOT_MODEL_ACTIVATION",
]);

const EVALUATION_LIMITATIONS_V1 = Object.freeze([
  "CONTROLLED_REPLAY_HOLDOUT",
  "NOT_SHADOW_ONLINE",
  "NOT_FIELD_VALIDATED",
  "NOT_TRUE_PARAMETER_IDENTIFICATION",
  "NOT_STATISTICAL_SIGNIFICANCE",
  "NOT_GENERALIZATION",
  "NOT_UNCERTAINTY_CALIBRATION",
  "NOT_CAUSAL_EFFECT_EVIDENCE",
  "NOT_MODEL_ACTIVATION",
]);

function requireDraftDeterminismV1<T extends { determinism_hash: string }>(draft: T): T {
  const semantic = structuredClone(draft) as T;
  semantic.determinism_hash = "";
  const expected = semanticHashV1(semantic);
  if (draft.determinism_hash !== expected) throw new Error("CAP06_DRAFT_DETERMINISM_HASH_MISMATCH");
  return draft;
}

export function buildCap06CalibrationCandidateDraftV1(input: {
  calibrationWindow: Cap06BuiltCaseWindowV1;
  attempt: Cap06CalibrationAttemptResultV1;
}): Cap06CalibrationCandidateDraftV1 {
  if (input.calibrationWindow.role !== "CALIBRATION") throw new Error("CAP06_CANDIDATE_CALIBRATION_WINDOW_REQUIRED");
  if (!isCap06CandidateAppendingStatusV1(input.attempt.status)) {
    throw new Error(`CAP06_CANDIDATE_STATUS_NOT_CANONICALIZABLE:${input.attempt.status}`);
  }
  const selectedParameter = input.attempt.selected_parameter_value;
  const selectedDelta = input.attempt.selected_parameter_delta;
  if (!selectedParameter || !selectedDelta || !input.attempt.baseline_metrics || !input.attempt.selected_metrics) {
    throw new Error("CAP06_CANDIDATE_SELECTED_METRICS_REQUIRED");
  }
  if (input.attempt.case_input_set_hash !== input.calibrationWindow.case_input_set_hash) {
    throw new Error("CAP06_CANDIDATE_CASE_INPUT_SET_HASH_MISMATCH");
  }
  const candidateParameterBundleHash = semanticHashV1({
    effective_base_parameter_bundle_hash: input.calibrationWindow.effective_parameter_bundle_hash,
    parameter_key: CAP06_PARAMETER_KEY_V1,
    parameter_value: selectedParameter,
  });
  const objectIdentity = {
    object_type: "twin_calibration_candidate_v1",
    scope: input.calibrationWindow.scope,
    logical_time: input.calibrationWindow.logical_time,
    as_of: input.calibrationWindow.as_of,
    calibration_run_id: input.attempt.calibration_run_id,
  };
  const objectId = deriveSemanticObjectIdV1("twin_calibration_candidate", objectIdentity);
  const semantic = {
    object_id: objectId,
    object_type: "twin_calibration_candidate_v1" as const,
    schema_version: "v1" as const,
    record_class: "CANONICAL_MODEL_GOVERNANCE_HISTORY" as const,
    lineage_member: false as const,
    envelope_profile: "NON_LINEAGE_CONTEXT" as const,
    scope: structuredClone(input.calibrationWindow.scope),
    logical_time: input.calibrationWindow.logical_time,
    as_of: input.calibrationWindow.as_of,
    source_refs: [
      ...input.calibrationWindow.ordered_residual_refs,
      input.calibrationWindow.base_config_ref,
    ],
    evidence_refs: [...input.calibrationWindow.ordered_observation_refs],
    runtime_config_ref: input.calibrationWindow.base_config_ref,
    runtime_config_hash: input.calibrationWindow.base_config_hash,
    idempotency_key: `CALIBRATION_CANDIDATE:${input.attempt.calibration_run_id}`,
    context_lineage_ref: input.calibrationWindow.context_lineage_ref,
    context_revision_ref: input.calibrationWindow.context_revision_ref,
    payload: {
      candidate_status: input.attempt.status,
      residual_refs: [...input.calibrationWindow.ordered_residual_refs],
      residual_set_hash: input.calibrationWindow.window_residual_set_hash,
      residual_set_hash_scope: "CALIBRATION_WINDOW_ONLY",
      calibration_residual_set_hash: input.calibrationWindow.window_residual_set_hash,
      calibration_window_ref_membership_hash: input.calibrationWindow.window_ref_membership_hash,
      source_s1_residual_set_hash: input.calibrationWindow.source_s1_residual_set_hash,
      source_s1_case_input_set_hash: input.calibrationWindow.source_s1_case_input_set_hash,
      source_s1_calibration_window_hash: input.calibrationWindow.source_s1_calibration_window_hash,
      source_s1_holdout_window_hash: input.calibrationWindow.source_s1_holdout_window_hash,
      window_hash_semantics: input.calibrationWindow.window_hash_semantics,
      base_config_ref: input.calibrationWindow.base_config_ref,
      base_config_hash: input.calibrationWindow.base_config_hash,
      source_runtime_config_refs: [...input.calibrationWindow.ordered_source_runtime_config_refs],
      source_runtime_config_set_hash: input.calibrationWindow.source_runtime_config_set_hash,
      effective_base_parameter_bundle_hash: input.calibrationWindow.effective_parameter_bundle_hash,
      candidate_parameter_bundle_hash: candidateParameterBundleHash,
      model_component_set_hash: input.calibrationWindow.model_component_hash,
      context_lineage_ref: input.calibrationWindow.context_lineage_ref,
      context_revision_ref: input.calibrationWindow.context_revision_ref,
      config_authority_mode: "EXPLICIT_REPLAY_PIN",
      parameter_key: CAP06_PARAMETER_KEY_V1,
      base_parameter_value: CAP06_BASE_PARAMETER_VALUE_V1,
      candidate_parameter_value: selectedParameter,
      parameter_delta: selectedDelta,
      contract_admissible_bounds: { minimum: "0.000000", maximum: "1.000000" },
      controlled_search_bounds: {
        minimum: CAP06_SEARCH_MINIMUM_V1,
        maximum: CAP06_SEARCH_MAXIMUM_V1,
        step: CAP06_SEARCH_STEP_V1,
      },
      case_input_set_hash: input.attempt.case_input_set_hash,
      calibration_case_builder_id: CAP06_CALIBRATION_CASE_BUILDER_ID_V1,
      calibration_case_builder_version: 1,
      calibration_engine_id: CAP06_CALIBRATION_ENGINE_ID_V1,
      calibration_engine_version: 1,
      metric_policy_id: CAP06_METRIC_POLICY_ID_V1,
      metric_policy_version: 1,
      candidate_selection_policy_id: CAP06_CANDIDATE_SELECTION_POLICY_ID_V1,
      candidate_selection_policy_version: 1,
      runtime_replay_numeric_policy_id: CAP06_RUNTIME_REPLAY_NUMERIC_POLICY_ID_V1,
      runtime_replay_numeric_policy_hash: input.calibrationWindow.runtime_replay_numeric_policy_hash,
      calibration_metric_numeric_policy_id: CAP06_CALIBRATION_METRIC_NUMERIC_POLICY_ID_V1,
      calibration_metric_numeric_policy_hash: semanticHashV1({
        policy_id: CAP06_CALIBRATION_METRIC_NUMERIC_POLICY_ID_V1,
        metric_scale: 9,
        sse_scale: 18,
        rounding: "DECIMAL_HALF_AWAY_FROM_ZERO_V1",
      }),
      baseline_training_metrics: input.attempt.baseline_metrics,
      candidate_training_metrics: input.attempt.selected_metrics,
      parameter_excitation_summary: input.attempt.excitation_summary,
      error_classification_summary: input.attempt.error_classification_summary,
      mass_balance_validation_summary: {
        failure_count: input.attempt.objective_surface.find(
          (item) => item.parameter_value === selectedParameter,
        )?.mass_balance_failure_count ?? 0,
      },
      physical_invariant_validation_summary: {
        failure_count: input.attempt.objective_surface.find(
          (item) => item.parameter_value === selectedParameter,
        )?.physical_failure_count ?? 0,
      },
      activation_status: "NOT_ACTIVE",
      eligible_for_state_input: false,
      eligible_for_runtime_config_use: false,
      eligible_for_human_activation_review: false,
      uncertainty_change: "NONE",
      process_uncertainty_model: "UNCHANGED",
      observation_uncertainty_model: "UNCHANGED",
      forecast_interval_calibration: "NOT_ESTABLISHED",
      calibration_run_id: input.attempt.calibration_run_id,
      attempt_determinism_hash: input.attempt.determinism_hash,
    },
    limitations: [...CANDIDATE_LIMITATIONS_V1],
  };
  const draft: Cap06CalibrationCandidateDraftV1 = {
    ...semantic,
    determinism_hash: semanticHashV1({ ...semantic, determinism_hash: "" }),
  };
  return requireDraftDeterminismV1(draft);
}

export function buildCap06ShadowEvaluationDraftV1(input: {
  holdoutWindow: Cap06BuiltCaseWindowV1;
  candidate: Cap06CalibrationCandidateDraftV1;
  shadow: Cap06PairedShadowResultV1;
}): Cap06ShadowEvaluationDraftV1 {
  requireDraftDeterminismV1(input.candidate);
  if (input.holdoutWindow.role !== "HOLDOUT") throw new Error("CAP06_EVALUATION_HOLDOUT_WINDOW_REQUIRED");
  if (input.shadow.candidate_parameter_value !== input.candidate.payload.candidate_parameter_value) {
    throw new Error("CAP06_EVALUATION_CANDIDATE_PARAMETER_MISMATCH");
  }
  const evaluationIdentity = {
    candidate_ref: input.candidate.object_id,
    candidate_hash: input.candidate.determinism_hash,
    evaluation_dataset_refs: input.holdoutWindow.ordered_residual_refs,
    evaluation_dataset_hash: input.holdoutWindow.case_input_set_hash,
    evaluation_policy_id: CAP06_SHADOW_EVALUATION_POLICY_ID_V1,
    replay_engine_id: CAP06_SHADOW_REPLAY_ENGINE_ID_V1,
    metric_policy_id: CAP06_METRIC_POLICY_ID_V1,
    metric_numeric_policy_id: CAP06_CALIBRATION_METRIC_NUMERIC_POLICY_ID_V1,
  };
  const shadowEvaluationId = `mcft_cap06_shadow_${semanticHashV1(evaluationIdentity).slice(7, 31)}`;
  const objectIdentity = {
    object_type: "twin_shadow_evaluation_v1",
    scope: input.holdoutWindow.scope,
    logical_time: input.holdoutWindow.logical_time,
    as_of: input.holdoutWindow.as_of,
    shadow_evaluation_id: shadowEvaluationId,
  };
  const semantic = {
    object_id: deriveSemanticObjectIdV1("twin_shadow_evaluation", objectIdentity),
    object_type: "twin_shadow_evaluation_v1" as const,
    schema_version: "v1" as const,
    record_class: "CANONICAL_MODEL_GOVERNANCE_HISTORY" as const,
    lineage_member: false as const,
    envelope_profile: "NON_LINEAGE_CONTEXT" as const,
    scope: structuredClone(input.holdoutWindow.scope),
    logical_time: input.holdoutWindow.logical_time,
    as_of: input.holdoutWindow.as_of,
    source_refs: [input.candidate.object_id, ...input.holdoutWindow.ordered_residual_refs],
    evidence_refs: [...input.holdoutWindow.ordered_observation_refs],
    runtime_config_ref: input.candidate.runtime_config_ref,
    runtime_config_hash: input.candidate.runtime_config_hash,
    idempotency_key: `SHADOW_EVALUATION:${shadowEvaluationId}`,
    payload: {
      evaluation_kind: "PAIRED_HISTORICAL_REPLAY_SHADOW_EVALUATION",
      candidate_ref: input.candidate.object_id,
      candidate_hash: input.candidate.determinism_hash,
      evaluation_dataset_refs: [...input.holdoutWindow.ordered_residual_refs],
      evaluation_dataset_hash: input.holdoutWindow.case_input_set_hash,
      evaluation_dataset_hash_scope: "HOLDOUT_CASE_INPUT_SET",
      holdout_residual_set_hash: input.holdoutWindow.window_residual_set_hash,
      holdout_window_ref_membership_hash: input.holdoutWindow.window_ref_membership_hash,
      source_s1_residual_set_hash: input.holdoutWindow.source_s1_residual_set_hash,
      source_s1_case_input_set_hash: input.holdoutWindow.source_s1_case_input_set_hash,
      window_hash_semantics: input.holdoutWindow.window_hash_semantics,
      holdout_purpose: input.holdoutWindow.holdout_purpose,
      holdout_generalization_claim: input.holdoutWindow.holdout_generalization_claim,
      base_config_ref: input.candidate.runtime_config_ref,
      base_config_hash: input.candidate.runtime_config_hash,
      base_model_parameter_bundle_hash: input.candidate.payload.effective_base_parameter_bundle_hash,
      candidate_model_parameter_bundle_hash: input.candidate.payload.candidate_parameter_bundle_hash,
      context_mapping_mode: "CONTEXT_INHERITED_THROUGH_CANDIDATE_ONLY",
      shadow_replay_engine_id: CAP06_SHADOW_REPLAY_ENGINE_ID_V1,
      shadow_replay_engine_version: 1,
      evaluation_policy_ref: CAP06_SHADOW_EVALUATION_POLICY_ID_V1,
      evaluation_policy_hash: semanticHashV1({
        policy_id: CAP06_SHADOW_EVALUATION_POLICY_ID_V1,
        version: 1,
      }),
      metric_policy_id: CAP06_METRIC_POLICY_ID_V1,
      metric_policy_version: 1,
      runtime_replay_numeric_policy_id: CAP06_RUNTIME_REPLAY_NUMERIC_POLICY_ID_V1,
      runtime_replay_numeric_policy_hash: input.holdoutWindow.runtime_replay_numeric_policy_hash,
      calibration_metric_numeric_policy_id: CAP06_CALIBRATION_METRIC_NUMERIC_POLICY_ID_V1,
      calibration_metric_numeric_policy_hash: input.candidate.payload.calibration_metric_numeric_policy_hash,
      baseline_metrics: input.shadow.baseline_metrics,
      candidate_metrics: input.shadow.candidate_metrics,
      metric_deltas: {
        sse_scale_18: (
          BigInt(input.shadow.candidate_metrics.sum_squared_error_scale_18)
          - BigInt(input.shadow.baseline_metrics.sum_squared_error_scale_18)
        ).toString(),
      },
      case_results: structuredClone(input.shadow.case_results),
      case_results_hash: input.shadow.case_results_hash,
      compute_determinism_hash: input.shadow.determinism_hash,
      evaluation_disposition: input.shadow.evaluation_disposition,
      reason_codes: [...input.shadow.reason_codes],
      eligible_for_human_activation_review: input.shadow.eligible_for_human_activation_review,
      model_activation_created: false,
      active_config_switch_performed: false,
      approval_created: false,
      activation_authorized: false,
      uncertainty_model_changed: false,
      state_confidence_changed: false,
      shadow_evaluation_id: shadowEvaluationId,
    },
    limitations: [...EVALUATION_LIMITATIONS_V1],
  };
  const draft: Cap06ShadowEvaluationDraftV1 = {
    ...semantic,
    determinism_hash: semanticHashV1({ ...semantic, determinism_hash: "" }),
  };
  return requireDraftDeterminismV1(draft);
}
