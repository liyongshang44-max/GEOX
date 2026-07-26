// Purpose: execute the MCFT-CAP-08.S5 21-point calibration surface while retaining all 16 Calibration members and excluding only explicitly governed diagnostic-only cases from objective aggregation.
// Boundary: pure deterministic compute over an injected prediction port; no repository, persistence, Candidate/Shadow append, active Config, State, checkpoint, route, scheduler or Model Activation authority.

import {
  formatFixedDecimalV1,
  parseFixedDecimalV1,
} from "../soil_water/fixed_point_water_decimal_v1.js";
import { semanticHashV1 } from "../twin_runtime/canonical_identity_v1.js";
import {
  CAP06_BASE_PARAMETER_VALUE_V1,
  CAP06_CALIBRATION_ENGINE_ID_V1,
  CAP06_CALIBRATION_METRIC_NUMERIC_POLICY_ID_V1,
  CAP06_CANDIDATE_SELECTION_POLICY_ID_V1,
  CAP06_METRIC_POLICY_ID_V1,
  CAP06_MINIMUM_SENSITIVE_CASE_COUNT_V1,
  CAP06_MINIMUM_WETNESS_REGIME_COUNT_V1,
  CAP06_RUNTIME_REPLAY_NUMERIC_POLICY_ID_V1,
  CAP06_SEARCH_MAXIMUM_V1,
  CAP06_SEARCH_MINIMUM_V1,
  CAP06_SENSITIVITY_EPSILON_VWC_V1,
  isCap06CandidateAppendingStatusV1,
  type Cap06CalibrationAttemptResultV1,
  type Cap06CalibrationCaseV1,
  type Cap06CalibrationDispositionV1,
  type Cap06CalibrationPredictionPortV1,
  type Cap06ErrorClassificationSummaryV1,
  type Cap06ParameterExcitationSummaryV1,
  type Cap06ParameterSurfacePointV1,
  type Cap06PredictionResultV1,
  type Cap06WetnessRegimeV1,
} from "./contracts_v1.js";
import {
  buildCap06ParameterGridV1,
  CAP06_BEST_SECOND_MSE_MARGIN_EPSILON_SSE_SCALE_18_V1,
  CAP06_OBJECTIVE_MSE_RANGE_EPSILON_SSE_SCALE_18_V1,
} from "./grid_search_v1.js";
import {
  buildCap06ErrorMetricsV1,
  compareCap06AbsoluteMeanBiasV1,
  compareCap06MaximumAbsoluteResidualV1,
  compareCap06MseV1,
  formatCap06VwcMetricV1,
  parseCap06VwcMetricV1,
  type Cap06ErrorMetricsV1,
} from "./fixed_point_metric_v1.js";
import type { Cap06BuiltCaseWindowV1 } from "./case_builder_v1.js";
import {
  CAP08_S5_V2_PREQUALIFICATION_POLICY_ID_V1,
} from "../twin_runtime/cap08_s5_replay_dataset_v2_authority_v1.js";

export type Cap08S5ObjectivePolicyV1 = {
  policy_id: typeof CAP08_S5_V2_PREQUALIFICATION_POLICY_ID_V1;
  objective_residual_refs: string[];
  diagnostic_only_residual_refs: string[];
  diagnostic_only_observation_refs: string[];
};

export type Cap08S5ObjectiveAttemptV1 = Cap06CalibrationAttemptResultV1 & {
  objective_policy_id: typeof CAP08_S5_V2_PREQUALIFICATION_POLICY_ID_V1;
  calibration_window_case_count: 16;
  objective_case_count: 15;
  diagnostic_only_case_count: 1;
  objective_residual_refs: string[];
  diagnostic_only_residual_refs: string[];
  diagnostic_only_observation_refs: ["FVO-10"];
  eligibility_policy_hash: string;
};

type EvaluatedV1 = {
  surface: Cap06ParameterSurfacePointV1;
  predictions: Cap06PredictionResultV1[];
};

const absoluteV1 = (value: bigint): bigint => value < 0n ? -value : value;
const parameterUnitsV1 = (value: string): bigint =>
  parseFixedDecimalV1(value, 6, "CAP08_S5_OBJECTIVE_PARAMETER_REQUIRED");
const parameterDeltaV1 = (value: string): string =>
  formatFixedDecimalV1(parameterUnitsV1(value) - parameterUnitsV1(CAP06_BASE_PARAMETER_VALUE_V1), 6);
const compareBigIntV1 = (left: bigint, right: bigint): number => left < right ? -1 : left > right ? 1 : 0;

function compareSurfaceV1(left: Cap06ParameterSurfacePointV1, right: Cap06ParameterSurfacePointV1): number {
  return compareCap06MseV1(left.metrics, right.metrics)
    || compareCap06AbsoluteMeanBiasV1(left.metrics, right.metrics)
    || compareCap06MaximumAbsoluteResidualV1(left.metrics, right.metrics)
    || compareBigIntV1(absoluteV1(parameterUnitsV1(left.parameter_delta)), absoluteV1(parameterUnitsV1(right.parameter_delta)))
    || compareBigIntV1(parameterUnitsV1(left.parameter_value), parameterUnitsV1(right.parameter_value));
}

function residualV1(actual: string, predicted: string): string {
  return formatCap06VwcMetricV1(
    parseCap06VwcMetricV1(actual, "CAP08_S5_OBJECTIVE_ACTUAL_REQUIRED")
      - parseCap06VwcMetricV1(predicted, "CAP08_S5_OBJECTIVE_PREDICTION_REQUIRED"),
  );
}

async function deterministicPredictionV1(
  port: Cap06CalibrationPredictionPortV1,
  item: Cap06CalibrationCaseV1,
  parameterValue: string,
): Promise<Cap06PredictionResultV1> {
  const first = await port.predictCase(item, parameterValue);
  const second = await port.predictCase(item, parameterValue);
  if (semanticHashV1(first) !== semanticHashV1(second)) {
    throw new Error(`CAP08_S5_OBJECTIVE_DETERMINISM_FAILURE:${item.residual_ref}:${parameterValue}`);
  }
  return structuredClone(first);
}

async function evaluateV1(input: {
  cases: readonly Cap06CalibrationCaseV1[];
  objectiveRefs: ReadonlySet<string>;
  predictionPort: Cap06CalibrationPredictionPortV1;
  parameterValue: string;
}): Promise<EvaluatedV1> {
  const predictions: Cap06PredictionResultV1[] = [];
  const residuals: string[] = [];
  let physicalFailureCount = 0;
  let massBalanceFailureCount = 0;
  let baseReplayMismatchCount = 0;
  for (const item of input.cases) {
    const prediction = await deterministicPredictionV1(input.predictionPort, item, input.parameterValue);
    predictions.push(prediction);
    if (input.objectiveRefs.has(item.residual_ref)) {
      residuals.push(residualV1(item.actual_observation_vwc, prediction.prediction_vwc));
    }
    if (prediction.physical_invariant_status !== "PASS") physicalFailureCount += 1;
    if (prediction.mass_balance_status !== "PASS") massBalanceFailureCount += 1;
    if (input.parameterValue === CAP06_BASE_PARAMETER_VALUE_V1 && !prediction.base_trace_match) {
      baseReplayMismatchCount += 1;
    }
  }
  const metrics = buildCap06ErrorMetricsV1(residuals);
  const semantic = {
    parameter_value: input.parameterValue,
    parameter_delta: parameterDeltaV1(input.parameterValue),
    metrics,
    sensitive_case_count: 0,
    represented_sensitive_wetness_regimes: [] as Cap06WetnessRegimeV1[],
    physical_failure_count: physicalFailureCount,
    mass_balance_failure_count: massBalanceFailureCount,
    base_replay_mismatch_count: baseReplayMismatchCount,
  };
  return { surface: { ...semantic, determinism_hash: semanticHashV1(semantic) }, predictions };
}

function residualBiasV1(metrics: Cap06ErrorMetricsV1): "POSITIVE" | "NEGATIVE" | "BALANCED" {
  const value = BigInt(metrics.sum_residual_scale_9);
  return value > 0n ? "POSITIVE" : value < 0n ? "NEGATIVE" : "BALANCED";
}

function errorClassificationV1(input: {
  status: Cap06CalibrationDispositionV1;
  selected: Cap06ParameterSurfacePointV1;
  excitation: Cap06ParameterExcitationSummaryV1;
}): Cap06ErrorClassificationSummaryV1 {
  const boundary = input.selected.parameter_value === CAP06_SEARCH_MINIMUM_V1
    ? "LOWER_BOUND"
    : input.selected.parameter_value === CAP06_SEARCH_MAXIMUM_V1
      ? "UPPER_BOUND"
      : input.selected.parameter_value === CAP06_BASE_PARAMETER_VALUE_V1
        ? "BASE_VALUE"
        : "INTERIOR";
  return {
    dominant_error_class: input.status === "NO_OP_BASE_PARAMETER_RETAINED"
      ? "BASE_MODEL_RETAINED"
      : input.status === "INSUFFICIENT_PARAMETER_EXCITATION"
        || input.status === "OBJECTIVE_SURFACE_FLAT"
        || input.status === "OBJECTIVE_MARGIN_INSUFFICIENT"
        ? "NON_IDENTIFIABLE"
        : "PARAMETER_SENSITIVE",
    parameter_sensitivity_status: input.excitation.status === "PASS" ? "PASS" : "FAIL",
    residual_bias_pattern: residualBiasV1(input.selected.metrics),
    objective_surface_status: input.status === "OBJECTIVE_SURFACE_FLAT"
      ? "FLAT"
      : input.status === "OBJECTIVE_MARGIN_INSUFFICIENT"
        ? "MARGIN_INSUFFICIENT"
        : input.status === "SEARCH_BOUNDARY_HIT_INCONCLUSIVE"
          ? "BOUNDARY_INCONCLUSIVE"
          : "INFORMATIVE",
    boundary_status: boundary,
    case_graph_status: "PASS",
    uncertainty_change: "NONE",
    process_uncertainty_model: "UNCHANGED",
    observation_uncertainty_model: "UNCHANGED",
    forecast_interval_calibration: "NOT_ESTABLISHED",
    normalized_residual_role: "DIAGNOSTIC_ONLY",
    limitations: [
      "CONTROLLED_REPLAY_ONLY",
      "SINGLE_PARAMETER_ONLY",
      "OBJECTIVE_ELIGIBILITY_POLICY_APPLIED",
      "FVO10_RETAINED_AS_DIAGNOSTIC_ONLY",
      "NOT_FIELD_CALIBRATED",
      "NOT_MODEL_ACTIVATION",
    ],
  };
}

function validatePolicyV1(
  window: Cap06BuiltCaseWindowV1,
  policy: Cap08S5ObjectivePolicyV1,
): { objective: Set<string>; diagnostic: Set<string> } {
  if (policy.policy_id !== CAP08_S5_V2_PREQUALIFICATION_POLICY_ID_V1) {
    throw new Error("CAP08_S5_OBJECTIVE_POLICY_ID_MISMATCH");
  }
  const all = window.cases.map((item) => item.residual_ref);
  const objective = new Set(policy.objective_residual_refs);
  const diagnostic = new Set(policy.diagnostic_only_residual_refs);
  if (all.length !== 16 || objective.size !== 15 || diagnostic.size !== 1
    || policy.diagnostic_only_observation_refs.length !== 1
    || policy.diagnostic_only_observation_refs[0] !== "FVO-10") {
    throw new Error("CAP08_S5_OBJECTIVE_POLICY_CARDINALITY");
  }
  if ([...objective].some((ref) => diagnostic.has(ref))
    || all.some((ref) => !objective.has(ref) && !diagnostic.has(ref))
    || [...objective, ...diagnostic].some((ref) => !all.includes(ref))) {
    throw new Error("CAP08_S5_OBJECTIVE_POLICY_PARTITION");
  }
  const diagnosticCase = window.cases.find((item) => diagnostic.has(item.residual_ref));
  if (!diagnosticCase || diagnosticCase.actual_observation_ref !== "FVO-10") {
    throw new Error("CAP08_S5_FVO10_DIAGNOSTIC_BINDING_REQUIRED");
  }
  return { objective, diagnostic };
}

export async function runCap08S5ObjectiveGridSearchV1(input: {
  calibrationWindow: Cap06BuiltCaseWindowV1;
  predictionPort: Cap06CalibrationPredictionPortV1;
  objectivePolicy: Cap08S5ObjectivePolicyV1;
}): Promise<Cap08S5ObjectiveAttemptV1> {
  if (input.calibrationWindow.role !== "CALIBRATION") {
    throw new Error("CAP08_S5_OBJECTIVE_CALIBRATION_WINDOW_REQUIRED");
  }
  const partition = validatePolicyV1(input.calibrationWindow, input.objectivePolicy);
  const evaluated: EvaluatedV1[] = [];
  for (const parameterValue of buildCap06ParameterGridV1()) {
    evaluated.push(await evaluateV1({
      cases: input.calibrationWindow.cases,
      objectiveRefs: partition.objective,
      predictionPort: input.predictionPort,
      parameterValue,
    }));
  }
  const minimum = evaluated.find((item) => item.surface.parameter_value === CAP06_SEARCH_MINIMUM_V1);
  const maximum = evaluated.find((item) => item.surface.parameter_value === CAP06_SEARCH_MAXIMUM_V1);
  if (!minimum || !maximum) throw new Error("CAP08_S5_OBJECTIVE_GRID_ENDPOINTS_REQUIRED");
  const epsilon = parseCap06VwcMetricV1(CAP06_SENSITIVITY_EPSILON_VWC_V1);
  const sensitiveIndexes: number[] = [];
  for (let index = 0; index < input.calibrationWindow.cases.length; index += 1) {
    const item = input.calibrationWindow.cases[index];
    if (!partition.objective.has(item.residual_ref)) continue;
    const lower = parseCap06VwcMetricV1(minimum.predictions[index].prediction_vwc);
    const upper = parseCap06VwcMetricV1(maximum.predictions[index].prediction_vwc);
    if (absoluteV1(upper - lower) >= epsilon) sensitiveIndexes.push(index);
  }
  const regimes = [...new Set(sensitiveIndexes.map(
    (index) => input.calibrationWindow.cases[index].wetness_regime,
  ).filter((value) => String(value) !== "NO_POSITIVE_EXCESS") as Cap06WetnessRegimeV1[])].sort();
  for (const item of evaluated) {
    const semantic = {
      ...item.surface,
      sensitive_case_count: sensitiveIndexes.length,
      represented_sensitive_wetness_regimes: regimes,
    };
    item.surface = { ...semantic, determinism_hash: semanticHashV1(semantic) };
  }
  const ranked = evaluated.map((item) => item.surface).sort(compareSurfaceV1);
  const selected = ranked[0];
  const second = ranked[1];
  const worst = ranked[ranked.length - 1];
  const baseline = ranked.find((item) => item.parameter_value === CAP06_BASE_PARAMETER_VALUE_V1);
  if (!selected || !second || !worst || !baseline) {
    throw new Error("CAP08_S5_OBJECTIVE_GRID_RESULT_CARDINALITY");
  }
  const objectiveRange = BigInt(worst.metrics.sum_squared_error_scale_18)
    - BigInt(selected.metrics.sum_squared_error_scale_18);
  const bestSecondMargin = BigInt(second.metrics.sum_squared_error_scale_18)
    - BigInt(selected.metrics.sum_squared_error_scale_18);
  const excitation: Cap06ParameterExcitationSummaryV1 = {
    sensitive_case_count: sensitiveIndexes.length,
    minimum_sensitive_case_count: CAP06_MINIMUM_SENSITIVE_CASE_COUNT_V1,
    represented_sensitive_wetness_regimes: regimes,
    minimum_represented_sensitive_wetness_regimes: CAP06_MINIMUM_WETNESS_REGIME_COUNT_V1,
    sensitivity_epsilon_vwc_fraction: CAP06_SENSITIVITY_EPSILON_VWC_V1,
    status: sensitiveIndexes.length >= CAP06_MINIMUM_SENSITIVE_CASE_COUNT_V1
      && regimes.length >= CAP06_MINIMUM_WETNESS_REGIME_COUNT_V1 ? "PASS" : "INSUFFICIENT_PARAMETER_EXCITATION",
  };
  let status: Cap06CalibrationDispositionV1;
  if (baseline.base_replay_mismatch_count > 0) status = "BASE_REPLAY_MISMATCH";
  else if (selected.physical_failure_count > 0) status = "PHYSICAL_INVARIANT_FAILURE";
  else if (selected.mass_balance_failure_count > 0) status = "MASS_BALANCE_FAILURE";
  else if (excitation.status !== "PASS") status = "INSUFFICIENT_PARAMETER_EXCITATION";
  else if (objectiveRange < CAP06_OBJECTIVE_MSE_RANGE_EPSILON_SSE_SCALE_18_V1) status = "OBJECTIVE_SURFACE_FLAT";
  else if (bestSecondMargin < CAP06_BEST_SECOND_MSE_MARGIN_EPSILON_SSE_SCALE_18_V1) status = "OBJECTIVE_MARGIN_INSUFFICIENT";
  else if (selected.parameter_value === CAP06_SEARCH_MINIMUM_V1
    || selected.parameter_value === CAP06_SEARCH_MAXIMUM_V1) status = "SEARCH_BOUNDARY_HIT_INCONCLUSIVE";
  else if (selected.parameter_value === CAP06_BASE_PARAMETER_VALUE_V1) status = "NO_OP_BASE_PARAMETER_RETAINED";
  else status = "BOUNDED_PARAMETER_DELTA_CANDIDATE";

  const policyHash = semanticHashV1(input.objectivePolicy);
  const calibrationRunIdentity = {
    scope: input.calibrationWindow.scope,
    ordered_residual_refs: input.calibrationWindow.ordered_residual_refs,
    ordered_residual_hashes: input.calibrationWindow.ordered_residual_hashes,
    case_input_set_hash: input.calibrationWindow.case_input_set_hash,
    base_config_ref: input.calibrationWindow.base_config_ref,
    base_config_hash: input.calibrationWindow.base_config_hash,
    calibration_engine_id: CAP06_CALIBRATION_ENGINE_ID_V1,
    calibration_engine_version: 1,
    metric_policy_id: CAP06_METRIC_POLICY_ID_V1,
    candidate_selection_policy_id: CAP06_CANDIDATE_SELECTION_POLICY_ID_V1,
    runtime_replay_numeric_policy_id: CAP06_RUNTIME_REPLAY_NUMERIC_POLICY_ID_V1,
    runtime_replay_numeric_policy_hash: input.calibrationWindow.runtime_replay_numeric_policy_hash,
    calibration_metric_numeric_policy_id: CAP06_CALIBRATION_METRIC_NUMERIC_POLICY_ID_V1,
    objective_policy_hash: policyHash,
  };
  const semantic = {
    schema_version: "geox_mcft_cap_06_calibration_attempt_result_v1" as const,
    status,
    canonical_append_allowed: isCap06CandidateAppendingStatusV1(status),
    selected_parameter_value: selected.parameter_value,
    selected_parameter_delta: selected.parameter_delta,
    baseline_metrics: baseline.metrics,
    selected_metrics: selected.metrics,
    objective_surface: evaluated.map((item) => item.surface),
    objective_mse_range_sse_scale_18: objectiveRange.toString(),
    best_vs_second_mse_margin_sse_scale_18: bestSecondMargin.toString(),
    excitation_summary: excitation,
    error_classification_summary: errorClassificationV1({ status, selected, excitation }),
    case_input_set_hash: input.calibrationWindow.case_input_set_hash,
    calibration_run_id: `mcft_cap08_s5_calibration_${semanticHashV1(calibrationRunIdentity).slice(7, 31)}`,
    objective_policy_id: CAP08_S5_V2_PREQUALIFICATION_POLICY_ID_V1,
    calibration_window_case_count: 16 as const,
    objective_case_count: 15 as const,
    diagnostic_only_case_count: 1 as const,
    objective_residual_refs: [...input.objectivePolicy.objective_residual_refs],
    diagnostic_only_residual_refs: [...input.objectivePolicy.diagnostic_only_residual_refs],
    diagnostic_only_observation_refs: ["FVO-10"] as ["FVO-10"],
    eligibility_policy_hash: policyHash,
  };
  return { ...semantic, determinism_hash: semanticHashV1(semantic) };
}
