// Purpose: test one S5-specific objective-eligibility policy while preserving the frozen 21-point grid, metrics, ranking, excitation and boundary rules.
// Boundary: disposable pure diagnostic compute only; no Candidate/Shadow draft, persistence, activation, Runtime mutation, filesystem, environment, or network authority.

import {
  CAP06_BASE_PARAMETER_VALUE_V1,
  CAP06_MINIMUM_SENSITIVE_CASE_COUNT_V1,
  CAP06_MINIMUM_WETNESS_REGIME_COUNT_V1,
  CAP06_SEARCH_MAXIMUM_V1,
  CAP06_SEARCH_MINIMUM_V1,
  CAP06_SENSITIVITY_EPSILON_VWC_V1,
  type Cap06CalibrationCaseV1,
  type Cap06CalibrationPredictionPortV1,
  type Cap06ParameterSurfacePointV1,
  type Cap06PredictionResultV1,
  type Cap06WetnessRegimeV1,
} from "../../apps/server/src/domain/calibration/contracts_v1.js";
import type { Cap08S5BuiltCaseWindowV1 } from "../../apps/server/src/domain/calibration/cap08_s5_case_builder_v1.js";
import {
  buildCap06ParameterGridV1,
  CAP06_BEST_SECOND_MSE_MARGIN_EPSILON_SSE_SCALE_18_V1,
  CAP06_OBJECTIVE_MSE_RANGE_EPSILON_SSE_SCALE_18_V1,
} from "../../apps/server/src/domain/calibration/grid_search_v1.js";
import {
  buildCap06ErrorMetricsV1,
  compareCap06AbsoluteMeanBiasV1,
  compareCap06MaximumAbsoluteResidualV1,
  compareCap06MseV1,
  formatCap06VwcMetricV1,
  parseCap06VwcMetricV1,
} from "../../apps/server/src/domain/calibration/fixed_point_metric_v1.js";
import {
  formatFixedDecimalV1,
  parseFixedDecimalV1,
} from "../../apps/server/src/domain/soil_water/fixed_point_water_decimal_v1.js";
import { semanticHashV1 } from "../../apps/server/src/domain/twin_runtime/canonical_identity_v1.js";

export const CAP08_S5_OBJECTIVE_ELIGIBILITY_DIAGNOSTIC_POLICY_ID_V1 =
  "MCFT_CAP_08_S5_BUSINESS_OUTCOME_OBJECTIVE_ELIGIBILITY_DIAGNOSTIC_V1" as const;

type EvaluatedV1 = {
  surface: Cap06ParameterSurfacePointV1;
  predictions: Cap06PredictionResultV1[];
};

function absoluteV1(value: bigint): bigint {
  return value < 0n ? -value : value;
}

function parameterUnitsV1(value: string): bigint {
  return parseFixedDecimalV1(value, 6, "CAP08_S5_ELIGIBILITY_PARAMETER_INVALID");
}

function parameterDeltaV1(value: string): string {
  return formatFixedDecimalV1(
    parameterUnitsV1(value) - parameterUnitsV1(CAP06_BASE_PARAMETER_VALUE_V1),
    6,
  );
}

function compareBigIntV1(left: bigint, right: bigint): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function compareSurfaceV1(left: Cap06ParameterSurfacePointV1, right: Cap06ParameterSurfacePointV1): number {
  return compareCap06MseV1(left.metrics, right.metrics)
    || compareCap06AbsoluteMeanBiasV1(left.metrics, right.metrics)
    || compareCap06MaximumAbsoluteResidualV1(left.metrics, right.metrics)
    || compareBigIntV1(absoluteV1(parameterUnitsV1(left.parameter_delta)), absoluteV1(parameterUnitsV1(right.parameter_delta)))
    || compareBigIntV1(parameterUnitsV1(left.parameter_value), parameterUnitsV1(right.parameter_value));
}

async function deterministicPredictionV1(input: {
  port: Cap06CalibrationPredictionPortV1;
  caseItem: Cap06CalibrationCaseV1;
  parameterValue: string;
}): Promise<Cap06PredictionResultV1> {
  const first = await input.port.predictCase(input.caseItem, input.parameterValue);
  const second = await input.port.predictCase(input.caseItem, input.parameterValue);
  if (semanticHashV1(first) !== semanticHashV1(second)) {
    throw new Error(`CAP08_S5_ELIGIBILITY_DETERMINISM_FAILURE:${input.caseItem.residual_ref}:${input.parameterValue}`);
  }
  return structuredClone(first);
}

export async function runCap08S5ObjectiveEligibilityDiagnosticV1(input: {
  calibrationWindow: Cap08S5BuiltCaseWindowV1;
  predictionPort: Cap06CalibrationPredictionPortV1;
  objectiveIneligibleObservationRefs: readonly string[];
}) {
  if (input.calibrationWindow.role !== "CALIBRATION" || input.calibrationWindow.cases.length !== 16) {
    throw new Error("CAP08_S5_ELIGIBILITY_EXACT_16_CASE_WINDOW_REQUIRED");
  }
  const ineligibleRefs = [...input.objectiveIneligibleObservationRefs];
  if (ineligibleRefs.length === 0 || new Set(ineligibleRefs).size !== ineligibleRefs.length) {
    throw new Error("CAP08_S5_ELIGIBILITY_INELIGIBLE_REFS_REQUIRED");
  }
  const cases = input.calibrationWindow.cases;
  const objectiveEligible = cases.map((item) => !ineligibleRefs.includes(item.actual_observation_ref));
  const unmatched = ineligibleRefs.filter((ref) => !cases.some((item) => item.actual_observation_ref === ref));
  if (unmatched.length) throw new Error(`CAP08_S5_ELIGIBILITY_INELIGIBLE_REF_MISSING:${unmatched.join(",")}`);
  const objectiveCaseCount = objectiveEligible.filter(Boolean).length;
  if (objectiveCaseCount < 1) throw new Error("CAP08_S5_ELIGIBILITY_OBJECTIVE_CASES_REQUIRED");

  const evaluated: EvaluatedV1[] = [];
  for (const parameterValue of buildCap06ParameterGridV1()) {
    const predictions: Cap06PredictionResultV1[] = [];
    const objectiveResiduals: string[] = [];
    let physicalFailureCount = 0;
    let massBalanceFailureCount = 0;
    let baseReplayMismatchCount = 0;
    for (let index = 0; index < cases.length; index += 1) {
      const prediction = await deterministicPredictionV1({
        port: input.predictionPort,
        caseItem: cases[index] as unknown as Cap06CalibrationCaseV1,
        parameterValue,
      });
      predictions.push(prediction);
      if (objectiveEligible[index]) {
        objectiveResiduals.push(formatCap06VwcMetricV1(
          parseCap06VwcMetricV1(cases[index].actual_observation_vwc)
            - parseCap06VwcMetricV1(prediction.prediction_vwc),
        ));
      }
      if (prediction.physical_invariant_status !== "PASS") physicalFailureCount += 1;
      if (prediction.mass_balance_status !== "PASS") massBalanceFailureCount += 1;
      if (parameterValue === CAP06_BASE_PARAMETER_VALUE_V1 && !prediction.base_trace_match) {
        baseReplayMismatchCount += 1;
      }
    }
    const metrics = buildCap06ErrorMetricsV1(objectiveResiduals);
    const semantic = {
      parameter_value: parameterValue,
      parameter_delta: parameterDeltaV1(parameterValue),
      metrics,
      sensitive_case_count: 0,
      represented_sensitive_wetness_regimes: [] as Cap06WetnessRegimeV1[],
      physical_failure_count: physicalFailureCount,
      mass_balance_failure_count: massBalanceFailureCount,
      base_replay_mismatch_count: baseReplayMismatchCount,
    };
    evaluated.push({
      surface: { ...semantic, determinism_hash: semanticHashV1(semantic) },
      predictions,
    });
  }

  const minimum = evaluated.find((item) => item.surface.parameter_value === CAP06_SEARCH_MINIMUM_V1);
  const maximum = evaluated.find((item) => item.surface.parameter_value === CAP06_SEARCH_MAXIMUM_V1);
  if (!minimum || !maximum) throw new Error("CAP08_S5_ELIGIBILITY_GRID_ENDPOINTS_REQUIRED");
  const epsilon = parseCap06VwcMetricV1(CAP06_SENSITIVITY_EPSILON_VWC_V1);
  const sensitiveIndexes: number[] = [];
  for (let index = 0; index < cases.length; index += 1) {
    if (!objectiveEligible[index]) continue;
    const lower = parseCap06VwcMetricV1(minimum.predictions[index].prediction_vwc);
    const upper = parseCap06VwcMetricV1(maximum.predictions[index].prediction_vwc);
    if (absoluteV1(upper - lower) >= epsilon) sensitiveIndexes.push(index);
  }
  const representedRegimes = [...new Set(
    sensitiveIndexes.map((index) => cases[index].wetness_regime)
      .filter((value): value is Cap06WetnessRegimeV1 => value !== "NO_POSITIVE_EXCESS"),
  )].sort();
  for (const item of evaluated) {
    const semantic = {
      ...item.surface,
      sensitive_case_count: sensitiveIndexes.length,
      represented_sensitive_wetness_regimes: representedRegimes,
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
  const ranked = evaluated.map((item) => item.surface).sort(compareSurfaceV1);
  const selected = ranked[0];
  const second = ranked[1];
  const worst = ranked[ranked.length - 1];
  const baseline = ranked.find((item) => item.parameter_value === CAP06_BASE_PARAMETER_VALUE_V1);
  if (!selected || !second || !worst || !baseline) {
    throw new Error("CAP08_S5_ELIGIBILITY_GRID_RESULT_CARDINALITY");
  }
  const objectiveRange = BigInt(worst.metrics.sum_squared_error_scale_18)
    - BigInt(selected.metrics.sum_squared_error_scale_18);
  const bestSecondMargin = BigInt(second.metrics.sum_squared_error_scale_18)
    - BigInt(selected.metrics.sum_squared_error_scale_18);
  const excitationPass = sensitiveIndexes.length >= CAP06_MINIMUM_SENSITIVE_CASE_COUNT_V1
    && representedRegimes.length >= CAP06_MINIMUM_WETNESS_REGIME_COUNT_V1;

  let status: string;
  if (baseline.base_replay_mismatch_count > 0) status = "BASE_REPLAY_MISMATCH";
  else if (selected.physical_failure_count > 0) status = "PHYSICAL_INVARIANT_FAILURE";
  else if (selected.mass_balance_failure_count > 0) status = "MASS_BALANCE_FAILURE";
  else if (!excitationPass) status = "INSUFFICIENT_PARAMETER_EXCITATION";
  else if (objectiveRange < CAP06_OBJECTIVE_MSE_RANGE_EPSILON_SSE_SCALE_18_V1) status = "OBJECTIVE_SURFACE_FLAT";
  else if (bestSecondMargin < CAP06_BEST_SECOND_MSE_MARGIN_EPSILON_SSE_SCALE_18_V1) status = "OBJECTIVE_MARGIN_INSUFFICIENT";
  else if (selected.parameter_value === CAP06_SEARCH_MINIMUM_V1 || selected.parameter_value === CAP06_SEARCH_MAXIMUM_V1) {
    status = "SEARCH_BOUNDARY_HIT_INCONCLUSIVE";
  } else if (selected.parameter_value === CAP06_BASE_PARAMETER_VALUE_V1) status = "NO_OP_BASE_PARAMETER_RETAINED";
  else status = "BOUNDED_PARAMETER_DELTA_CANDIDATE";

  const result = {
    schema_version: "geox_mcft_cap08_s5_objective_eligibility_diagnostic_result_v1" as const,
    policy_id: CAP08_S5_OBJECTIVE_ELIGIBILITY_DIAGNOSTIC_POLICY_ID_V1,
    case_window_count: cases.length,
    objective_case_count: objectiveCaseCount,
    diagnostic_only_case_count: cases.length - objectiveCaseCount,
    objective_ineligible_observation_refs: ineligibleRefs,
    objective_ineligible_residual_refs: cases
      .filter((_, index) => !objectiveEligible[index])
      .map((item) => item.residual_ref),
    status,
    canonical_append_allowed: status === "BOUNDED_PARAMETER_DELTA_CANDIDATE"
      || status === "NO_OP_BASE_PARAMETER_RETAINED",
    selected_parameter_value: selected.parameter_value,
    selected_parameter_delta: selected.parameter_delta,
    baseline_metrics: baseline.metrics,
    selected_metrics: selected.metrics,
    objective_surface: evaluated.map((item) => item.surface),
    objective_mse_range_sse_scale_18: objectiveRange.toString(),
    best_vs_second_mse_margin_sse_scale_18: bestSecondMargin.toString(),
    excitation_summary: {
      sensitive_case_count: sensitiveIndexes.length,
      minimum_sensitive_case_count: CAP06_MINIMUM_SENSITIVE_CASE_COUNT_V1,
      represented_sensitive_wetness_regimes: representedRegimes,
      minimum_represented_sensitive_wetness_regimes: CAP06_MINIMUM_WETNESS_REGIME_COUNT_V1,
      sensitivity_epsilon_vwc_fraction: CAP06_SENSITIVITY_EPSILON_VWC_V1,
      status: excitationPass ? "PASS" as const : "INSUFFICIENT_PARAMETER_EXCITATION" as const,
    },
    case_input_set_hash: input.calibrationWindow.case_input_set_hash,
    eligibility_policy_hash: semanticHashV1({
      policy_id: CAP08_S5_OBJECTIVE_ELIGIBILITY_DIAGNOSTIC_POLICY_ID_V1,
      objective_ineligible_observation_refs: ineligibleRefs,
      case_input_set_hash: input.calibrationWindow.case_input_set_hash,
    }),
  };
  return { ...result, determinism_hash: semanticHashV1(result) };
}
