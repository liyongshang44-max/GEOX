// apps/server/src/domain/calibration/grid_search_v1.ts
// Purpose: execute the deterministic MCFT-CAP-06 single-parameter 21-point calibration search and return a non-persistent Candidate attempt result.
// Boundary: pure compute over an injected prediction port; no repository search, persistence, projection, Candidate append, Evaluation append, active Config, State, checkpoint, route, scheduler, or Model Activation write.

import {
  formatFixedDecimalV1,
  parseFixedDecimalV1,
} from "../soil_water/fixed_point_water_decimal_v1.js";
import { semanticHashV1 } from "../twin_runtime/canonical_identity_v1.js";
import {
  CAP06_BASE_PARAMETER_VALUE_V1,
  CAP06_CALIBRATION_ENGINE_ID_V1,
  CAP06_CALIBRATION_CASE_COUNT_V1,
  CAP06_CALIBRATION_METRIC_NUMERIC_POLICY_ID_V1,
  CAP06_CANDIDATE_SELECTION_POLICY_ID_V1,
  CAP06_METRIC_POLICY_ID_V1,
  CAP06_MINIMUM_SENSITIVE_CASE_COUNT_V1,
  CAP06_MINIMUM_WETNESS_REGIME_COUNT_V1,
  CAP06_RUNTIME_REPLAY_NUMERIC_POLICY_ID_V1,
  CAP06_SEARCH_GRID_COUNT_V1,
  CAP06_SEARCH_MAXIMUM_V1,
  CAP06_SEARCH_MINIMUM_V1,
  CAP06_SEARCH_STEP_V1,
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
  CAP06_PARAMETER_SCALE_V1,
  buildCap06ErrorMetricsV1,
  compareCap06AbsoluteMeanBiasV1,
  compareCap06MaximumAbsoluteResidualV1,
  compareCap06MseV1,
  formatCap06VwcMetricV1,
  parseCap06VwcMetricV1,
  type Cap06ErrorMetricsV1,
} from "./fixed_point_metric_v1.js";
import type { Cap06BuiltCaseWindowV1 } from "./case_builder_v1.js";

export const CAP06_OBJECTIVE_MSE_RANGE_EPSILON_SSE_SCALE_18_V1 = 1n as const;
export const CAP06_BEST_SECOND_MSE_MARGIN_EPSILON_SSE_SCALE_18_V1 = 1n as const;

export type Cap06GridSearchPolicyV1 = {
  objective_mse_range_epsilon_sse_scale_18: bigint;
  best_second_mse_margin_epsilon_sse_scale_18: bigint;
};

export const CAP06_GRID_SEARCH_POLICY_V1: Cap06GridSearchPolicyV1 = Object.freeze({
  objective_mse_range_epsilon_sse_scale_18: CAP06_OBJECTIVE_MSE_RANGE_EPSILON_SSE_SCALE_18_V1,
  best_second_mse_margin_epsilon_sse_scale_18: CAP06_BEST_SECOND_MSE_MARGIN_EPSILON_SSE_SCALE_18_V1,
});

type EvaluatedParameterV1 = {
  surface: Cap06ParameterSurfacePointV1;
  predictions: Cap06PredictionResultV1[];
  residuals: string[];
};

function absoluteV1(value: bigint): bigint {
  return value < 0n ? -value : value;
}

function compareBigIntV1(left: bigint, right: bigint): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function formatParameterV1(unitsScale6: bigint): string {
  return formatFixedDecimalV1(unitsScale6, CAP06_PARAMETER_SCALE_V1);
}

function parameterUnitsV1(value: string): bigint {
  return parseFixedDecimalV1(value, CAP06_PARAMETER_SCALE_V1, "CAP06_PARAMETER_VALUE_REQUIRED");
}

export function buildCap06ParameterGridV1(): string[] {
  const minimum = parameterUnitsV1(CAP06_SEARCH_MINIMUM_V1);
  const maximum = parameterUnitsV1(CAP06_SEARCH_MAXIMUM_V1);
  const step = parameterUnitsV1(CAP06_SEARCH_STEP_V1);
  if (step <= 0n || minimum >= maximum) throw new Error("CAP06_SEARCH_POLICY_INVALID");
  const values: string[] = [];
  for (let value = minimum; value <= maximum; value += step) values.push(formatParameterV1(value));
  if (values.length !== CAP06_SEARCH_GRID_COUNT_V1) {
    throw new Error(`CAP06_SEARCH_GRID_COUNT_MISMATCH:${values.length}`);
  }
  if (values[0] !== CAP06_SEARCH_MINIMUM_V1 || values[values.length - 1] !== CAP06_SEARCH_MAXIMUM_V1) {
    throw new Error("CAP06_SEARCH_GRID_BOUNDARY_MISMATCH");
  }
  if (!values.includes(CAP06_BASE_PARAMETER_VALUE_V1)) throw new Error("CAP06_BASE_PARAMETER_NOT_IN_GRID");
  return values;
}

function residualV1(actualVwc: string, predictionVwc: string): string {
  const actual = parseCap06VwcMetricV1(actualVwc, "CAP06_ACTUAL_OBSERVATION_VWC_REQUIRED");
  const prediction = parseCap06VwcMetricV1(predictionVwc, "CAP06_PREDICTION_VWC_REQUIRED");
  return formatCap06VwcMetricV1(actual - prediction);
}

function compareParameterSurfaceV1(
  left: Cap06ParameterSurfacePointV1,
  right: Cap06ParameterSurfacePointV1,
): number {
  return compareCap06MseV1(left.metrics, right.metrics)
    || compareCap06AbsoluteMeanBiasV1(left.metrics, right.metrics)
    || compareCap06MaximumAbsoluteResidualV1(left.metrics, right.metrics)
    || compareBigIntV1(
      absoluteV1(parameterUnitsV1(left.parameter_delta)),
      absoluteV1(parameterUnitsV1(right.parameter_delta)),
    )
    || compareBigIntV1(
      parameterUnitsV1(left.parameter_value),
      parameterUnitsV1(right.parameter_value),
    );
}

function residualBiasPatternV1(metrics: Cap06ErrorMetricsV1): "POSITIVE" | "NEGATIVE" | "BALANCED" {
  const sum = BigInt(metrics.sum_residual_scale_9);
  return sum > 0n ? "POSITIVE" : sum < 0n ? "NEGATIVE" : "BALANCED";
}

function boundaryStatusV1(parameterValue: string): Cap06ErrorClassificationSummaryV1["boundary_status"] {
  if (parameterValue === CAP06_SEARCH_MINIMUM_V1) return "LOWER_BOUND";
  if (parameterValue === CAP06_SEARCH_MAXIMUM_V1) return "UPPER_BOUND";
  if (parameterValue === CAP06_BASE_PARAMETER_VALUE_V1) return "BASE_VALUE";
  return "INTERIOR";
}

function errorClassificationV1(input: {
  status: Cap06CalibrationDispositionV1;
  selected: Cap06ParameterSurfacePointV1 | null;
  excitation: Cap06ParameterExcitationSummaryV1 | null;
}): Cap06ErrorClassificationSummaryV1 {
  const objectiveSurfaceStatus: Cap06ErrorClassificationSummaryV1["objective_surface_status"] =
    input.status === "OBJECTIVE_SURFACE_FLAT"
      ? "FLAT"
      : input.status === "OBJECTIVE_MARGIN_INSUFFICIENT"
        ? "MARGIN_INSUFFICIENT"
        : input.status === "SEARCH_BOUNDARY_HIT_INCONCLUSIVE"
          ? "BOUNDARY_INCONCLUSIVE"
          : "INFORMATIVE";
  const dominantErrorClass: Cap06ErrorClassificationSummaryV1["dominant_error_class"] =
    input.status === "NO_OP_BASE_PARAMETER_RETAINED"
      ? "BASE_MODEL_RETAINED"
      : input.status === "INSUFFICIENT_PARAMETER_EXCITATION"
        || input.status === "OBJECTIVE_SURFACE_FLAT"
        || input.status === "OBJECTIVE_MARGIN_INSUFFICIENT"
        ? "NON_IDENTIFIABLE"
        : input.status === "CONFIG_OR_MODEL_HETEROGENEITY"
          ? "HETEROGENEOUS_CONTEXT"
          : "PARAMETER_SENSITIVE";
  return {
    dominant_error_class: dominantErrorClass,
    parameter_sensitivity_status: input.excitation?.status === "PASS" ? "PASS" : "FAIL",
    residual_bias_pattern: input.selected ? residualBiasPatternV1(input.selected.metrics) : "BALANCED",
    objective_surface_status: objectiveSurfaceStatus,
    boundary_status: input.selected ? boundaryStatusV1(input.selected.parameter_value) : "BASE_VALUE",
    case_graph_status: input.status === "INVALID_CASE_SET" ? "FAIL" : "PASS",
    uncertainty_change: "NONE",
    process_uncertainty_model: "UNCHANGED",
    observation_uncertainty_model: "UNCHANGED",
    forecast_interval_calibration: "NOT_ESTABLISHED",
    normalized_residual_role: "DIAGNOSTIC_ONLY",
    limitations: [
      "CONTROLLED_REPLAY_ONLY",
      "SINGLE_PARAMETER_ONLY",
      "NOT_FIELD_CALIBRATED",
      "NOT_TRUE_PARAMETER_IDENTIFICATION",
      "NOT_STATISTICAL_SIGNIFICANCE",
      "NOT_UNCERTAINTY_CALIBRATION",
      "NOT_MODEL_ACTIVATION",
    ],
  };
}

async function deterministicPredictionV1(
  port: Cap06CalibrationPredictionPortV1,
  caseItem: Cap06CalibrationCaseV1,
  parameterValue: string,
): Promise<Cap06PredictionResultV1> {
  const first = await port.predictCase(caseItem, parameterValue);
  const second = await port.predictCase(caseItem, parameterValue);
  parseCap06VwcMetricV1(first.prediction_vwc, "CAP06_PREDICTION_VWC_REQUIRED");
  parseFixedDecimalV1(first.storage_mm, 6, "CAP06_PREDICTION_STORAGE_REQUIRED");
  if (semanticHashV1(first) !== semanticHashV1(second)) {
    throw new Error(`CAP06_DETERMINISM_FAILURE:${caseItem.residual_ref}:${parameterValue}`);
  }
  return structuredClone(first);
}

async function evaluateParameterV1(input: {
  cases: readonly Cap06CalibrationCaseV1[];
  predictionPort: Cap06CalibrationPredictionPortV1;
  parameterValue: string;
}): Promise<EvaluatedParameterV1> {
  const predictions: Cap06PredictionResultV1[] = [];
  const residuals: string[] = [];
  let physicalFailureCount = 0;
  let massBalanceFailureCount = 0;
  let baseReplayMismatchCount = 0;
  for (const caseItem of input.cases) {
    const prediction = await deterministicPredictionV1(
      input.predictionPort,
      caseItem,
      input.parameterValue,
    );
    predictions.push(prediction);
    residuals.push(residualV1(caseItem.actual_observation_vwc, prediction.prediction_vwc));
    if (prediction.physical_invariant_status !== "PASS") physicalFailureCount += 1;
    if (prediction.mass_balance_status !== "PASS") massBalanceFailureCount += 1;
    if (input.parameterValue === CAP06_BASE_PARAMETER_VALUE_V1 && !prediction.base_trace_match) {
      baseReplayMismatchCount += 1;
    }
  }
  const metrics = buildCap06ErrorMetricsV1(residuals);
  const parameterDelta = formatParameterV1(
    parameterUnitsV1(input.parameterValue) - parameterUnitsV1(CAP06_BASE_PARAMETER_VALUE_V1),
  );
  const semantic = {
    parameter_value: input.parameterValue,
    parameter_delta: parameterDelta,
    metrics,
    sensitive_case_count: 0,
    represented_sensitive_wetness_regimes: [] as Cap06WetnessRegimeV1[],
    physical_failure_count: physicalFailureCount,
    mass_balance_failure_count: massBalanceFailureCount,
    base_replay_mismatch_count: baseReplayMismatchCount,
  };
  return {
    surface: {
      ...semantic,
      determinism_hash: semanticHashV1(semantic),
    },
    predictions,
    residuals,
  };
}

function attachExcitationV1(
  evaluated: EvaluatedParameterV1[],
  cases: readonly Cap06CalibrationCaseV1[],
): Cap06ParameterExcitationSummaryV1 {
  const minimum = evaluated.find((item) => item.surface.parameter_value === CAP06_SEARCH_MINIMUM_V1);
  const maximum = evaluated.find((item) => item.surface.parameter_value === CAP06_SEARCH_MAXIMUM_V1);
  if (!minimum || !maximum) throw new Error("CAP06_SEARCH_ENDPOINT_RESULTS_REQUIRED");
  const epsilon = parseCap06VwcMetricV1(CAP06_SENSITIVITY_EPSILON_VWC_V1);
  const sensitiveIndexes: number[] = [];
  for (let index = 0; index < cases.length; index += 1) {
    const lower = parseCap06VwcMetricV1(minimum.predictions[index].prediction_vwc);
    const upper = parseCap06VwcMetricV1(maximum.predictions[index].prediction_vwc);
    if (absoluteV1(upper - lower) >= epsilon) sensitiveIndexes.push(index);
  }
  const regimes = [...new Set(sensitiveIndexes.map((index) => cases[index].wetness_regime))].sort();
  for (const item of evaluated) {
    const semantic = {
      ...item.surface,
      sensitive_case_count: sensitiveIndexes.length,
      represented_sensitive_wetness_regimes: regimes,
    };
    item.surface = {
      ...semantic,
      determinism_hash: semanticHashV1({
        parameter_value: semantic.parameter_value,
        parameter_delta: semantic.parameter_delta,
        metrics: semantic.metrics,
        sensitive_case_count: semantic.sensitive_case_count,
        represented_sensitive_wetness_regimes: semantic.represented_sensitive_wetness_regimes,
        physical_failure_count: semantic.physical_failure_count,
        mass_balance_failure_count: semantic.mass_balance_failure_count,
        base_replay_mismatch_count: semantic.base_replay_mismatch_count,
      }),
    };
  }
  const status = sensitiveIndexes.length >= CAP06_MINIMUM_SENSITIVE_CASE_COUNT_V1
    && regimes.length >= CAP06_MINIMUM_WETNESS_REGIME_COUNT_V1
    ? "PASS"
    : "INSUFFICIENT_PARAMETER_EXCITATION";
  return {
    sensitive_case_count: sensitiveIndexes.length,
    minimum_sensitive_case_count: CAP06_MINIMUM_SENSITIVE_CASE_COUNT_V1,
    represented_sensitive_wetness_regimes: regimes,
    minimum_represented_sensitive_wetness_regimes: CAP06_MINIMUM_WETNESS_REGIME_COUNT_V1,
    sensitivity_epsilon_vwc_fraction: CAP06_SENSITIVITY_EPSILON_VWC_V1,
    status,
  };
}

function exactSseV1(point: Cap06ParameterSurfacePointV1): bigint {
  return BigInt(point.metrics.sum_squared_error_scale_18);
}

function buildAttemptResultV1(input: {
  status: Cap06CalibrationDispositionV1;
  window: Cap06BuiltCaseWindowV1;
  evaluated: EvaluatedParameterV1[];
  selected: Cap06ParameterSurfacePointV1 | null;
  baseline: Cap06ParameterSurfacePointV1 | null;
  objectiveRange: bigint | null;
  bestSecondMargin: bigint | null;
  excitation: Cap06ParameterExcitationSummaryV1 | null;
}): Cap06CalibrationAttemptResultV1 {
  const calibrationRunIdentity = {
    scope: input.window.scope,
    ordered_residual_refs: input.window.ordered_residual_refs,
    ordered_residual_hashes: input.window.ordered_residual_hashes,
    ordered_observation_refs: input.window.ordered_observation_refs,
    ordered_observation_hashes: input.window.ordered_observation_hashes,
    base_config_ref: input.window.base_config_ref,
    base_config_hash: input.window.base_config_hash,
    effective_parameter_bundle_hash: input.window.effective_parameter_bundle_hash,
    case_input_set_hash: input.window.case_input_set_hash,
    calibration_engine_id: CAP06_CALIBRATION_ENGINE_ID_V1,
    calibration_engine_version: 1,
    metric_policy_id: CAP06_METRIC_POLICY_ID_V1,
    candidate_selection_policy_id: CAP06_CANDIDATE_SELECTION_POLICY_ID_V1,
    runtime_replay_numeric_policy_id: CAP06_RUNTIME_REPLAY_NUMERIC_POLICY_ID_V1,
    runtime_replay_numeric_policy_hash: input.window.runtime_replay_numeric_policy_hash,
    calibration_metric_numeric_policy_id: CAP06_CALIBRATION_METRIC_NUMERIC_POLICY_ID_V1,
  };
  const calibrationRunId = `mcft_cap06_calibration_${semanticHashV1(calibrationRunIdentity).slice(7, 31)}`;
  const semantic = {
    schema_version: "geox_mcft_cap_06_calibration_attempt_result_v1" as const,
    status: input.status,
    canonical_append_allowed: isCap06CandidateAppendingStatusV1(input.status),
    selected_parameter_value: input.selected?.parameter_value ?? null,
    selected_parameter_delta: input.selected?.parameter_delta ?? null,
    baseline_metrics: input.baseline?.metrics ?? null,
    selected_metrics: input.selected?.metrics ?? null,
    objective_surface: input.evaluated.map((item) => item.surface),
    objective_mse_range_sse_scale_18: input.objectiveRange?.toString() ?? null,
    best_vs_second_mse_margin_sse_scale_18: input.bestSecondMargin?.toString() ?? null,
    excitation_summary: input.excitation,
    error_classification_summary: errorClassificationV1({
      status: input.status,
      selected: input.selected,
      excitation: input.excitation,
    }),
    case_input_set_hash: input.window.case_input_set_hash,
    calibration_run_id: calibrationRunId,
  };
  return {
    ...semantic,
    determinism_hash: semanticHashV1(semantic),
  };
}

export async function runCap06CalibrationGridSearchV1(input: {
  calibrationWindow: Cap06BuiltCaseWindowV1;
  predictionPort: Cap06CalibrationPredictionPortV1;
  policy?: Cap06GridSearchPolicyV1;
}): Promise<Cap06CalibrationAttemptResultV1> {
  if (input.calibrationWindow.role !== "CALIBRATION") throw new Error("CAP06_CALIBRATION_WINDOW_REQUIRED");
  if (input.calibrationWindow.cases.length !== CAP06_CALIBRATION_CASE_COUNT_V1) {
    return buildAttemptResultV1({
      status: "INSUFFICIENT_MATCHED_PAIRS",
      window: input.calibrationWindow,
      evaluated: [],
      selected: null,
      baseline: null,
      objectiveRange: null,
      bestSecondMargin: null,
      excitation: null,
    });
  }
  const policy = input.policy ?? CAP06_GRID_SEARCH_POLICY_V1;
  if (
    policy.objective_mse_range_epsilon_sse_scale_18 < 0n
    || policy.best_second_mse_margin_epsilon_sse_scale_18 < 0n
  ) throw new Error("CAP06_GRID_SEARCH_EPSILON_INVALID");

  const evaluated: EvaluatedParameterV1[] = [];
  try {
    for (const parameterValue of buildCap06ParameterGridV1()) {
      evaluated.push(await evaluateParameterV1({
        cases: input.calibrationWindow.cases,
        predictionPort: input.predictionPort,
        parameterValue,
      }));
    }
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("CAP06_DETERMINISM_FAILURE:")) {
      return buildAttemptResultV1({
        status: "DETERMINISM_FAILURE",
        window: input.calibrationWindow,
        evaluated,
        selected: null,
        baseline: null,
        objectiveRange: null,
        bestSecondMargin: null,
        excitation: null,
      });
    }
    throw error;
  }

  const excitation = attachExcitationV1(evaluated, input.calibrationWindow.cases);
  const ranked = evaluated.map((item) => item.surface).sort(compareParameterSurfaceV1);
  const selected = ranked[0];
  const second = ranked[1];
  const worst = ranked[ranked.length - 1];
  const baseline = ranked.find((item) => item.parameter_value === CAP06_BASE_PARAMETER_VALUE_V1) ?? null;
  if (!selected || !second || !worst || !baseline) throw new Error("CAP06_GRID_SEARCH_RESULT_CARDINALITY");
  const baseReplayMismatchCount = baseline.base_replay_mismatch_count;
  const objectiveRange = exactSseV1(worst) - exactSseV1(selected);
  const bestSecondMargin = exactSseV1(second) - exactSseV1(selected);

  let status: Cap06CalibrationDispositionV1;
  if (baseReplayMismatchCount > 0) status = "BASE_REPLAY_MISMATCH";
  else if (selected.physical_failure_count > 0) status = "PHYSICAL_INVARIANT_FAILURE";
  else if (selected.mass_balance_failure_count > 0) status = "MASS_BALANCE_FAILURE";
  else if (excitation.status !== "PASS") status = "INSUFFICIENT_PARAMETER_EXCITATION";
  else if (objectiveRange < policy.objective_mse_range_epsilon_sse_scale_18) status = "OBJECTIVE_SURFACE_FLAT";
  else if (bestSecondMargin < policy.best_second_mse_margin_epsilon_sse_scale_18) status = "OBJECTIVE_MARGIN_INSUFFICIENT";
  else if (
    selected.parameter_value === CAP06_SEARCH_MINIMUM_V1
    || selected.parameter_value === CAP06_SEARCH_MAXIMUM_V1
  ) status = "SEARCH_BOUNDARY_HIT_INCONCLUSIVE";
  else if (selected.parameter_value === CAP06_BASE_PARAMETER_VALUE_V1) status = "NO_OP_BASE_PARAMETER_RETAINED";
  else status = "BOUNDED_PARAMETER_DELTA_CANDIDATE";

  return buildAttemptResultV1({
    status,
    window: input.calibrationWindow,
    evaluated,
    selected,
    baseline,
    objectiveRange,
    bestSecondMargin,
    excitation,
  });
}
