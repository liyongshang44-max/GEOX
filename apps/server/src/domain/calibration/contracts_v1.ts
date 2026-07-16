// apps/server/src/domain/calibration/contracts_v1.ts
// Purpose: freeze MCFT-CAP-06 calibration case, Candidate draft, paired shadow result, and policy identities.
// Boundary: pure contracts and validation only; no replay execution, persistence, projection, route, scheduler, Model Activation, or active-config mutation.

import type { Cap06ErrorMetricsV1 } from "./fixed_point_metric_v1.js";

export const CAP06_CALIBRATION_CASE_BUILDER_ID_V1 = "MCFT_CAP_06_H1_FORECAST_POINT_TRACE_CASE_BUILDER_V1" as const;
export const CAP06_CALIBRATION_ENGINE_ID_V1 = "MCFT_CAP_06_SINGLE_PARAMETER_GRID_SEARCH_V1" as const;
export const CAP06_SHADOW_REPLAY_ENGINE_ID_V1 = "MCFT_CAP_06_PAIRED_HISTORICAL_REPLAY_V1" as const;
export const CAP06_METRIC_POLICY_ID_V1 = "MCFT_CAP_06_VWC_METRIC_POLICY_V1" as const;
export const CAP06_CANDIDATE_SELECTION_POLICY_ID_V1 = "MCFT_CAP_06_CANDIDATE_SELECTION_POLICY_V1" as const;
export const CAP06_SHADOW_EVALUATION_POLICY_ID_V1 = "MCFT_CAP_06_SHADOW_EVALUATION_POLICY_V1" as const;
export const CAP06_RUNTIME_REPLAY_NUMERIC_POLICY_ID_V1 = "EXISTING_MCFT_FIXED_POINT_WATER_RUNTIME_POLICY_V1" as const;
export const CAP06_CALIBRATION_METRIC_NUMERIC_POLICY_ID_V1 = "MCFT_CAP_06_FIXED_POINT_METRIC_POLICY_V1" as const;
export const CAP06_PARAMETER_KEY_V1 = "dynamics_parameters.drainage_coefficient_per_hour" as const;
export const CAP06_BASE_PARAMETER_VALUE_V1 = "0.030000" as const;
export const CAP06_SEARCH_MINIMUM_V1 = "0.020000" as const;
export const CAP06_SEARCH_MAXIMUM_V1 = "0.040000" as const;
export const CAP06_SEARCH_STEP_V1 = "0.001000" as const;
export const CAP06_SEARCH_GRID_COUNT_V1 = 21 as const;
export const CAP06_CALIBRATION_CASE_COUNT_V1 = 16 as const;
export const CAP06_HOLDOUT_CASE_COUNT_V1 = 8 as const;
export const CAP06_SENSITIVITY_EPSILON_VWC_V1 = "0.000001000" as const;
export const CAP06_MINIMUM_SENSITIVE_CASE_COUNT_V1 = 4 as const;
export const CAP06_MINIMUM_WETNESS_REGIME_COUNT_V1 = 2 as const;
export const CAP06_BIAS_TOLERANCE_VWC_V1 = "0.000001000" as const;
export const CAP06_MAX_RESIDUAL_ADDITIVE_TOLERANCE_VWC_V1 = "0.000001000" as const;

export const CAP06_CANDIDATE_APPENDING_STATUSES_V1 = [
  "BOUNDED_PARAMETER_DELTA_CANDIDATE",
  "NO_OP_BASE_PARAMETER_RETAINED",
] as const;

export const CAP06_CANDIDATE_NON_APPENDING_STATUSES_V1 = [
  "INSUFFICIENT_MATCHED_PAIRS",
  "INSUFFICIENT_PARAMETER_EXCITATION",
  "OBJECTIVE_SURFACE_FLAT",
  "OBJECTIVE_MARGIN_INSUFFICIENT",
  "SEARCH_BOUNDARY_HIT_INCONCLUSIVE",
  "INVALID_CASE_SET",
  "CONFIG_OR_MODEL_HETEROGENEITY",
  "AVAILABILITY_ORDER_INVALID",
  "BASE_REPLAY_MISMATCH",
  "DETERMINISM_FAILURE",
  "PHYSICAL_INVARIANT_FAILURE",
  "MASS_BALANCE_FAILURE",
] as const;

export type Cap06CandidateAppendingStatusV1 = typeof CAP06_CANDIDATE_APPENDING_STATUSES_V1[number];
export type Cap06CandidateNonAppendingStatusV1 = typeof CAP06_CANDIDATE_NON_APPENDING_STATUSES_V1[number];
export type Cap06CalibrationDispositionV1 = Cap06CandidateAppendingStatusV1 | Cap06CandidateNonAppendingStatusV1;

export const CAP06_SHADOW_DISPOSITIONS_V1 = [
  "ELIGIBLE_FOR_HUMAN_ACTIVATION_REVIEW",
  "NOT_ELIGIBLE_FOR_ACTIVATION_REVIEW",
  "BASE_PARAMETER_RETAINED",
  "INCONCLUSIVE",
] as const;

export type Cap06ShadowDispositionV1 = typeof CAP06_SHADOW_DISPOSITIONS_V1[number];

export const CAP06_SHADOW_REASON_CODES_V1 = [
  "ALL_THRESHOLDS_PASS",
  "NO_OP_CONFIRMED",
  "BASELINE_PERFECT",
  "BASELINE_PERFECT_CANDIDATE_REGRESSION",
  "INSUFFICIENT_VALID_HOLDOUT",
  "RMSE_IMPROVEMENT_BELOW_THRESHOLD",
  "BIAS_REGRESSION",
  "MAX_ERROR_REGRESSION",
  "PHYSICAL_INVARIANT_FAILURE",
  "MASS_BALANCE_FAILURE",
  "DETERMINISM_FAILURE",
  "FUTURE_LEAKAGE_DETECTED",
  "CASE_SET_MISMATCH",
  "CONFIG_OR_MODEL_HETEROGENEITY",
  "AVAILABILITY_ORDER_INVALID",
] as const;

export type Cap06ShadowReasonCodeV1 = typeof CAP06_SHADOW_REASON_CODES_V1[number];
export type Cap06WetnessRegimeV1 = "LOW_EXCESS" | "MID_EXCESS" | "HIGH_EXCESS";
export type Cap06InvariantStatusV1 = "PASS" | "FAIL";

export type Cap06RealityScopeV1 = {
  tenant_id: string;
  project_id: string;
  group_id: string;
  field_id: string;
  season_id: string;
  zone_id: string;
};

export type Cap06CalibrationCaseSourceV1 = {
  case_index: number;
  scope: Cap06RealityScopeV1;
  residual_ref: string;
  residual_hash: string;
  source_forecast_ref: string;
  source_forecast_hash: string;
  source_forecast_point_ref: string;
  source_forecast_point_hash: string;
  source_posterior_ref: string;
  source_posterior_hash: string;
  source_runtime_config_ref: string;
  source_runtime_config_hash: string;
  actual_observation_ref: string;
  actual_observation_hash: string;
  forecast_issued_at: string;
  forecast_as_of: string;
  forecast_evidence_cutoff: string;
  forecast_target_time: string;
  observation_observed_at: string;
  observation_available_to_runtime_at: string;
  actual_observation_vwc: string;
  base_prediction_vwc: string;
  excess_above_field_capacity_mm: string;
  saturation_minus_field_capacity_mm: string;
  context_lineage_ref: string;
  context_revision_ref: string;
  model_component_hash: string;
  effective_parameter_bundle_hash: string;
  observation_operator_hash: string;
  geometry_hash: string;
  runtime_replay_numeric_policy_hash: string;
  case_input_hash: string;
};

export type Cap06CalibrationCaseV1 = Cap06CalibrationCaseSourceV1 & {
  wetness_regime: Cap06WetnessRegimeV1;
};

export type Cap06PredictionResultV1 = {
  prediction_vwc: string;
  storage_mm: string;
  mass_balance_hash: string;
  base_trace_match: boolean;
  physical_invariant_status: Cap06InvariantStatusV1;
  mass_balance_status: Cap06InvariantStatusV1;
};

export interface Cap06CalibrationPredictionPortV1 {
  predictCase(
    caseItem: Cap06CalibrationCaseV1,
    parameterValue: string,
  ): Promise<Cap06PredictionResultV1> | Cap06PredictionResultV1;
}

export interface Cap06ExactCalibrationResidualPortV1 {
  loadExactCalibrationResiduals(
    orderedResidualRefs: readonly string[],
  ): Promise<readonly Cap06CalibrationCaseSourceV1[]>;
}

export type Cap06ParameterSurfacePointV1 = {
  parameter_value: string;
  parameter_delta: string;
  metrics: Cap06ErrorMetricsV1;
  sensitive_case_count: number;
  represented_sensitive_wetness_regimes: Cap06WetnessRegimeV1[];
  physical_failure_count: number;
  mass_balance_failure_count: number;
  base_replay_mismatch_count: number;
  determinism_hash: string;
};

export type Cap06ParameterExcitationSummaryV1 = {
  sensitive_case_count: number;
  minimum_sensitive_case_count: number;
  represented_sensitive_wetness_regimes: Cap06WetnessRegimeV1[];
  minimum_represented_sensitive_wetness_regimes: number;
  sensitivity_epsilon_vwc_fraction: string;
  status: "PASS" | "INSUFFICIENT_PARAMETER_EXCITATION";
};

export type Cap06ErrorClassificationSummaryV1 = {
  dominant_error_class: "PARAMETER_SENSITIVE" | "NON_IDENTIFIABLE" | "HETEROGENEOUS_CONTEXT" | "BASE_MODEL_RETAINED";
  parameter_sensitivity_status: "PASS" | "FAIL";
  residual_bias_pattern: "POSITIVE" | "NEGATIVE" | "BALANCED";
  objective_surface_status: "INFORMATIVE" | "FLAT" | "MARGIN_INSUFFICIENT" | "BOUNDARY_INCONCLUSIVE";
  boundary_status: "INTERIOR" | "LOWER_BOUND" | "UPPER_BOUND" | "BASE_VALUE";
  case_graph_status: "PASS" | "FAIL";
  uncertainty_change: "NONE";
  process_uncertainty_model: "UNCHANGED";
  observation_uncertainty_model: "UNCHANGED";
  forecast_interval_calibration: "NOT_ESTABLISHED";
  normalized_residual_role: "DIAGNOSTIC_ONLY";
  limitations: string[];
};

export type Cap06CalibrationAttemptResultV1 = {
  schema_version: "geox_mcft_cap_06_calibration_attempt_result_v1";
  status: Cap06CalibrationDispositionV1;
  canonical_append_allowed: boolean;
  selected_parameter_value: string | null;
  selected_parameter_delta: string | null;
  baseline_metrics: Cap06ErrorMetricsV1 | null;
  selected_metrics: Cap06ErrorMetricsV1 | null;
  objective_surface: Cap06ParameterSurfacePointV1[];
  objective_mse_range_sse_scale_18: string | null;
  best_vs_second_mse_margin_sse_scale_18: string | null;
  excitation_summary: Cap06ParameterExcitationSummaryV1 | null;
  error_classification_summary: Cap06ErrorClassificationSummaryV1;
  case_input_set_hash: string;
  calibration_run_id: string;
  determinism_hash: string;
};

export type Cap06ShadowCaseResultV1 = {
  case_index: number;
  residual_ref: string;
  residual_hash: string;
  source_forecast_ref: string;
  source_forecast_hash: string;
  source_forecast_point_ref: string;
  source_posterior_ref: string;
  source_runtime_config_ref: string;
  forecast_issued_at: string;
  forecast_as_of: string;
  forecast_target_time: string;
  observation_ref: string;
  observation_observed_at: string;
  observation_available_to_runtime_at: string;
  base_parameter_value: string;
  candidate_parameter_value: string;
  base_prediction_vwc: string;
  candidate_prediction_vwc: string;
  actual_observation_vwc: string;
  base_residual_vwc: string;
  candidate_residual_vwc: string;
  base_normalized_residual: string | null;
  candidate_normalized_residual: string | null;
  base_mass_balance_hash: string;
  candidate_mass_balance_hash: string;
  base_invariant_status: Cap06InvariantStatusV1;
  candidate_invariant_status: Cap06InvariantStatusV1;
  base_mass_balance_status: Cap06InvariantStatusV1;
  candidate_mass_balance_status: Cap06InvariantStatusV1;
};

export type Cap06PairedShadowResultV1 = {
  schema_version: "geox_mcft_cap_06_paired_shadow_compute_result_v1";
  evaluation_kind: "PAIRED_HISTORICAL_REPLAY_SHADOW_EVALUATION";
  candidate_parameter_value: string;
  baseline_metrics: Cap06ErrorMetricsV1;
  candidate_metrics: Cap06ErrorMetricsV1;
  case_results: Cap06ShadowCaseResultV1[];
  case_results_hash: string;
  evaluation_disposition: Cap06ShadowDispositionV1;
  reason_codes: Cap06ShadowReasonCodeV1[];
  eligible_for_human_activation_review: boolean;
  model_activation_created: false;
  active_config_switch_performed: false;
  approval_created: false;
  activation_authorized: false;
  uncertainty_model_changed: false;
  state_confidence_changed: false;
  determinism_hash: string;
};

export function isCap06CandidateAppendingStatusV1(
  status: Cap06CalibrationDispositionV1,
): status is Cap06CandidateAppendingStatusV1 {
  return (CAP06_CANDIDATE_APPENDING_STATUSES_V1 as readonly string[]).includes(status);
}
