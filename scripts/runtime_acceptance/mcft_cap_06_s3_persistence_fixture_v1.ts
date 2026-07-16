// scripts/runtime_acceptance/mcft_cap_06_s3_persistence_fixture_v1.ts
// Purpose: build deterministic production-profile Candidate and Evaluation drafts for isolated MCFT-CAP-06 S3 persistence/recovery acceptance.
// Boundary: synthetic persistence fixture only; no database, calibration search authority, field-calibration claim, active Config, State, checkpoint, approval or Model Activation mutation.

import { semanticHashV1 } from "../../apps/server/src/domain/twin_runtime/canonical_identity_v1.js";
import {
  buildCap06ErrorMetricsV1,
} from "../../apps/server/src/domain/calibration/fixed_point_metric_v1.js";
import type {
  Cap06CalibrationAttemptResultV1,
  Cap06ErrorClassificationSummaryV1,
  Cap06PairedShadowResultV1,
  Cap06ParameterSurfacePointV1,
  Cap06ShadowCaseResultV1,
} from "../../apps/server/src/domain/calibration/contracts_v1.js";
import type {
  Cap06BuiltCaseWindowV1,
} from "../../apps/server/src/domain/calibration/case_builder_v1.js";
import {
  buildCap06CalibrationCandidateDraftV1,
  buildCap06ShadowEvaluationDraftV1,
  type Cap06CalibrationCandidateDraftV1,
  type Cap06ShadowEvaluationDraftV1,
} from "../../apps/server/src/domain/calibration/envelope_profiles_v1.js";

const SCOPE = Object.freeze({
  tenant_id: "tenant_mcft_cap06_s3",
  project_id: "project_mcft_cap06_s3",
  group_id: "group_mcft_cap06_s3",
  field_id: "field_mcft_cap06_s3",
  season_id: "season_mcft_cap06_s3",
  zone_id: "zone_mcft_cap06_s3",
});

const CONTEXT_LINEAGE_REF = "mcft_cap06_lineage_context_v1";
const CONTEXT_REVISION_REF = "mcft_cap06_revision_context_v1";
const MODEL_HASH = "sha256:3daa9adb75b975d5e956579a4f18afb6dab3aafb5418d85a37dd09cf1c0afe29";
const PARAMETER_BUNDLE_HASH = "sha256:a3b3bbe9dbf78f246ff1dd187868a2427f6f977ede04dce0fbcfbfda427c7772";
const OPERATOR_HASH = "sha256:123a292449ac04e52c83c9232f734e914d95b9f2298fd3e8fefd657c67dfc11e";
const GEOMETRY_HASH = "sha256:7777777777777777777777777777777777777777777777777777777777777777";
const RUNTIME_NUMERIC_HASH = "sha256:b73f9a895211593f4b95851a2e9e407ed87ede2580b9ae5ed916affc15d02bf6";
const SOURCE_S1_RESIDUAL_SET_HASH = "sha256:7995da1a8c5221c207087b30bb66a60ac2054e0616338f275ffaf72a01857e60";
const SOURCE_S1_CASE_INPUT_SET_HASH = "sha256:cb3bd4c273134071e931e8f85765b028ce58986752e94da3902f8563ddba4bb3";
const SOURCE_S1_CALIBRATION_WINDOW_HASH = "sha256:e5403ae258326909d054e92b53d089494d709785d8c48775a8cd142b0f0d191d";
const SOURCE_S1_HOLDOUT_WINDOW_HASH = "sha256:20bc567b9e75027425c981a24d8889f80327b55226dd29d04a97880bc07a428a";
const BASE_CONFIG_REF = "twin_runtime_config_mcft_cap06_s3_base";
const BASE_CONFIG_HASH = "sha256:6666666666666666666666666666666666666666666666666666666666666666";

function fixedIndexV1(index: number): string {
  return String(index).padStart(2, "0");
}

function buildWindowV1(input: {
  role: "CALIBRATION" | "HOLDOUT";
  prefix: string;
  count: number;
  logicalTime: string;
  asOf: string;
}): Cap06BuiltCaseWindowV1 {
  const residualRefs = Array.from({ length: input.count }, (_, index) =>
    `twin_forecast_residual_${input.prefix}_${fixedIndexV1(index)}`);
  const residualHashes = residualRefs.map((ref) => semanticHashV1({ ref }));
  const observationRefs = Array.from({ length: input.count }, (_, index) =>
    `observation_${input.prefix}_${fixedIndexV1(index)}`);
  const observationHashes = observationRefs.map((ref) => semanticHashV1({ ref }));
  const semantic = {
    schema_version: "geox_mcft_cap_06_case_window_v1" as const,
    role: input.role,
    case_builder_id: "MCFT_CAP_06_H1_FORECAST_POINT_TRACE_CASE_BUILDER_V1" as const,
    case_builder_version: 1 as const,
    scope: structuredClone(SCOPE),
    cases: [],
    ordered_residual_refs: residualRefs,
    ordered_residual_hashes: residualHashes,
    ordered_observation_refs: observationRefs,
    ordered_observation_hashes: observationHashes,
    ordered_source_runtime_config_refs: [BASE_CONFIG_REF],
    source_runtime_config_set_hash: semanticHashV1([{ ref: BASE_CONFIG_REF, hash: BASE_CONFIG_HASH }]),
    base_config_ref: BASE_CONFIG_REF,
    base_config_hash: BASE_CONFIG_HASH,
    context_lineage_ref: CONTEXT_LINEAGE_REF,
    context_revision_ref: CONTEXT_REVISION_REF,
    model_component_hash: MODEL_HASH,
    effective_parameter_bundle_hash: PARAMETER_BUNDLE_HASH,
    observation_operator_hash: OPERATOR_HASH,
    geometry_hash: GEOMETRY_HASH,
    runtime_replay_numeric_policy_hash: RUNTIME_NUMERIC_HASH,
    logical_time: input.logicalTime,
    as_of: input.asOf,
    case_input_set_hash: semanticHashV1({ prefix: input.prefix, kind: "CASE_INPUT_SET" }),
    window_ref_membership_hash: semanticHashV1(residualRefs),
    window_residual_set_hash: semanticHashV1(residualRefs.map((ref, index) => ({ ref, hash: residualHashes[index] }))),
    source_s1_residual_set_hash: SOURCE_S1_RESIDUAL_SET_HASH,
    source_s1_case_input_set_hash: SOURCE_S1_CASE_INPUT_SET_HASH,
    source_s1_calibration_window_hash: SOURCE_S1_CALIBRATION_WINDOW_HASH,
    source_s1_holdout_window_hash: SOURCE_S1_HOLDOUT_WINDOW_HASH,
    window_hash_semantics: "ORDERED_RESIDUAL_REF_MEMBERSHIP_ONLY_V1" as const,
    holdout_purpose: "HIGH_EXCESS_STRESS_HOLDOUT_ONLY" as const,
    holdout_generalization_claim: "NOT_ESTABLISHED" as const,
  };
  return {
    ...semantic,
    determinism_hash: semanticHashV1(semantic),
  };
}

function buildErrorClassificationV1(): Cap06ErrorClassificationSummaryV1 {
  return {
    dominant_error_class: "PARAMETER_SENSITIVE",
    parameter_sensitivity_status: "PASS",
    residual_bias_pattern: "BALANCED",
    objective_surface_status: "INFORMATIVE",
    boundary_status: "INTERIOR",
    case_graph_status: "PASS",
    uncertainty_change: "NONE",
    process_uncertainty_model: "UNCHANGED",
    observation_uncertainty_model: "UNCHANGED",
    forecast_interval_calibration: "NOT_ESTABLISHED",
    normalized_residual_role: "DIAGNOSTIC_ONLY",
    limitations: [
      "CONTROLLED_REPLAY_ONLY",
      "SINGLE_PARAMETER_ONLY",
      "NOT_FIELD_CALIBRATED",
      "NOT_MODEL_ACTIVATION",
    ],
  };
}

function buildSurfacePointV1(parameterValue: string, parameterDelta: string): Cap06ParameterSurfacePointV1 {
  const metrics = buildCap06ErrorMetricsV1(Array.from({ length: 16 }, (_, index) =>
    index % 2 === 0 ? "0.000100000" : "-0.000100000"));
  const semantic = {
    parameter_value: parameterValue,
    parameter_delta: parameterDelta,
    metrics,
    sensitive_case_count: 16,
    represented_sensitive_wetness_regimes: ["LOW_EXCESS", "MID_EXCESS", "HIGH_EXCESS"] as const,
    physical_failure_count: 0,
    mass_balance_failure_count: 0,
    base_replay_mismatch_count: 0,
  };
  return {
    ...semantic,
    represented_sensitive_wetness_regimes: [...semantic.represented_sensitive_wetness_regimes],
    determinism_hash: semanticHashV1(semantic),
  };
}

function buildAttemptV1(window: Cap06BuiltCaseWindowV1, suffix: string): Cap06CalibrationAttemptResultV1 {
  const baselineMetrics = buildCap06ErrorMetricsV1(Array(16).fill("0.001000000"));
  const selectedMetrics = buildCap06ErrorMetricsV1(Array(16).fill("0.000100000"));
  const semantic = {
    schema_version: "geox_mcft_cap_06_calibration_attempt_result_v1" as const,
    status: "BOUNDED_PARAMETER_DELTA_CANDIDATE" as const,
    canonical_append_allowed: true,
    selected_parameter_value: "0.034000",
    selected_parameter_delta: "0.004000",
    baseline_metrics: baselineMetrics,
    selected_metrics: selectedMetrics,
    objective_surface: [buildSurfacePointV1("0.034000", "0.004000")],
    objective_mse_range_sse_scale_18: "8874506000000",
    best_vs_second_mse_margin_sse_scale_18: "45097000000",
    excitation_summary: {
      sensitive_case_count: 16,
      minimum_sensitive_case_count: 4,
      represented_sensitive_wetness_regimes: ["LOW_EXCESS", "MID_EXCESS", "HIGH_EXCESS"] as const,
      minimum_represented_sensitive_wetness_regimes: 2,
      sensitivity_epsilon_vwc_fraction: "0.000001000",
      status: "PASS" as const,
    },
    error_classification_summary: buildErrorClassificationV1(),
    case_input_set_hash: window.case_input_set_hash,
    calibration_run_id: `mcft_cap06_s3_calibration_${suffix}`,
  };
  return {
    ...semantic,
    excitation_summary: {
      ...semantic.excitation_summary,
      represented_sensitive_wetness_regimes: [...semantic.excitation_summary.represented_sensitive_wetness_regimes],
    },
    determinism_hash: semanticHashV1(semantic),
  };
}

function buildShadowCaseV1(prefix: string, index: number, candidateValue: string): Cap06ShadowCaseResultV1 {
  const instant = new Date(Date.UTC(2026, 6, 1, 18 + index)).toISOString();
  const available = new Date(Date.parse(instant) + 10 * 60 * 1000).toISOString();
  return {
    case_index: index,
    residual_ref: `twin_forecast_residual_${prefix}_${fixedIndexV1(index)}`,
    residual_hash: semanticHashV1({ prefix, index, kind: "RESIDUAL" }),
    source_forecast_ref: `twin_forecast_run_${prefix}_${fixedIndexV1(index)}`,
    source_forecast_hash: semanticHashV1({ prefix, index, kind: "FORECAST" }),
    source_forecast_point_ref: `twin_forecast_point_${prefix}_${fixedIndexV1(index)}`,
    source_posterior_ref: `twin_state_${prefix}_${fixedIndexV1(index)}`,
    source_runtime_config_ref: BASE_CONFIG_REF,
    forecast_issued_at: new Date(Date.parse(instant) - 60 * 60 * 1000).toISOString(),
    forecast_as_of: new Date(Date.parse(instant) - 60 * 60 * 1000).toISOString(),
    forecast_target_time: instant,
    observation_ref: `observation_${prefix}_${fixedIndexV1(index)}`,
    observation_observed_at: instant,
    observation_available_to_runtime_at: available,
    base_parameter_value: "0.030000",
    candidate_parameter_value: candidateValue,
    base_prediction_vwc: "0.220000000",
    candidate_prediction_vwc: "0.221000000",
    actual_observation_vwc: "0.221100000",
    base_residual_vwc: "0.001100000",
    candidate_residual_vwc: "0.000100000",
    base_normalized_residual: null,
    candidate_normalized_residual: null,
    base_mass_balance_hash: semanticHashV1({ prefix, index, kind: "BASE_MASS" }),
    candidate_mass_balance_hash: semanticHashV1({ prefix, index, kind: "CANDIDATE_MASS" }),
    base_invariant_status: "PASS",
    candidate_invariant_status: "PASS",
    base_mass_balance_status: "PASS",
    candidate_mass_balance_status: "PASS",
  };
}

function buildShadowResultV1(
  window: Cap06BuiltCaseWindowV1,
  prefix: string,
  candidateValue: string,
): Cap06PairedShadowResultV1 {
  const caseResults = Array.from({ length: 8 }, (_, index) => buildShadowCaseV1(prefix, index, candidateValue));
  const semantic = {
    schema_version: "geox_mcft_cap_06_paired_shadow_compute_result_v1" as const,
    evaluation_kind: "PAIRED_HISTORICAL_REPLAY_SHADOW_EVALUATION" as const,
    candidate_parameter_value: candidateValue,
    baseline_metrics: buildCap06ErrorMetricsV1(Array(8).fill("0.001100000")),
    candidate_metrics: buildCap06ErrorMetricsV1(Array(8).fill("0.000100000")),
    case_results: caseResults,
    case_results_hash: semanticHashV1(caseResults),
    evaluation_disposition: "ELIGIBLE_FOR_HUMAN_ACTIVATION_REVIEW" as const,
    reason_codes: ["ALL_THRESHOLDS_PASS"] as const,
    source_s1_residual_set_hash: window.source_s1_residual_set_hash,
    source_s1_case_input_set_hash: window.source_s1_case_input_set_hash,
    holdout_window_ref_membership_hash: window.window_ref_membership_hash,
    window_hash_semantics: window.window_hash_semantics,
    holdout_purpose: window.holdout_purpose,
    holdout_generalization_claim: window.holdout_generalization_claim,
    eligible_for_human_activation_review: true,
    model_activation_created: false as const,
    active_config_switch_performed: false as const,
    approval_created: false as const,
    activation_authorized: false as const,
    uncertainty_model_changed: false as const,
    state_confidence_changed: false as const,
  };
  return {
    ...semantic,
    reason_codes: [...semantic.reason_codes],
    determinism_hash: semanticHashV1(semantic),
  };
}

function recomputeDraftHashV1<T extends { determinism_hash: string }>(draft: T): T {
  const next = structuredClone(draft);
  next.determinism_hash = semanticHashV1({ ...next, determinism_hash: "" });
  return next;
}

export type Cap06S3PersistenceFixtureV1 = {
  candidate: Cap06CalibrationCandidateDraftV1;
  evaluation: Cap06ShadowEvaluationDraftV1;
  second_evaluation: Cap06ShadowEvaluationDraftV1;
  concurrent_candidate: Cap06CalibrationCandidateDraftV1;
  concurrent_candidate_conflict: Cap06CalibrationCandidateDraftV1;
  wrong_candidate_hash_evaluation: Cap06ShadowEvaluationDraftV1;
  rogue_same_key_candidate: Cap06CalibrationCandidateDraftV1;
};

export function buildCap06S3PersistenceFixtureV1(): Cap06S3PersistenceFixtureV1 {
  const calibrationWindow = buildWindowV1({
    role: "CALIBRATION",
    prefix: "primary_calibration",
    count: 16,
    logicalTime: "2026-07-01T15:00:00.000Z",
    asOf: "2026-07-01T15:10:00.000Z",
  });
  const candidate = buildCap06CalibrationCandidateDraftV1({
    calibrationWindow,
    attempt: buildAttemptV1(calibrationWindow, "primary"),
  });

  const holdoutWindow = buildWindowV1({
    role: "HOLDOUT",
    prefix: "primary_holdout",
    count: 8,
    logicalTime: "2026-07-02T01:00:00.000Z",
    asOf: "2026-07-02T01:10:00.000Z",
  });
  const evaluation = buildCap06ShadowEvaluationDraftV1({
    holdoutWindow,
    candidate,
    shadow: buildShadowResultV1(holdoutWindow, "primary_holdout", "0.034000"),
  });

  const secondHoldoutWindow = buildWindowV1({
    role: "HOLDOUT",
    prefix: "secondary_holdout",
    count: 8,
    logicalTime: "2026-07-03T01:00:00.000Z",
    asOf: "2026-07-03T01:10:00.000Z",
  });
  const secondEvaluation = buildCap06ShadowEvaluationDraftV1({
    holdoutWindow: secondHoldoutWindow,
    candidate,
    shadow: buildShadowResultV1(secondHoldoutWindow, "secondary_holdout", "0.034000"),
  });

  const concurrentWindow = buildWindowV1({
    role: "CALIBRATION",
    prefix: "concurrent_calibration",
    count: 16,
    logicalTime: "2026-07-04T15:00:00.000Z",
    asOf: "2026-07-04T15:10:00.000Z",
  });
  const concurrentCandidate = buildCap06CalibrationCandidateDraftV1({
    calibrationWindow: concurrentWindow,
    attempt: buildAttemptV1(concurrentWindow, "concurrent"),
  });
  const concurrentConflict = recomputeDraftHashV1({
    ...structuredClone(concurrentCandidate),
    payload: {
      ...structuredClone(concurrentCandidate.payload),
      candidate_parameter_value: "0.035000",
      parameter_delta: "0.005000",
    },
  });

  const wrongCandidateHashEvaluation = recomputeDraftHashV1({
    ...structuredClone(secondEvaluation),
    payload: {
      ...structuredClone(secondEvaluation.payload),
      candidate_hash: semanticHashV1({ wrong: "candidate" }),
    },
  });

  const rogueSameKeyCandidate = recomputeDraftHashV1({
    ...structuredClone(candidate),
    object_id: `${candidate.object_id}_rogue`,
    payload: {
      ...structuredClone(candidate.payload),
      candidate_parameter_value: "0.036000",
      parameter_delta: "0.006000",
    },
  });

  return {
    candidate,
    evaluation,
    second_evaluation: secondEvaluation,
    concurrent_candidate: concurrentCandidate,
    concurrent_candidate_conflict: concurrentConflict,
    wrong_candidate_hash_evaluation: wrongCandidateHashEvaluation,
    rogue_same_key_candidate: rogueSameKeyCandidate,
  };
}
