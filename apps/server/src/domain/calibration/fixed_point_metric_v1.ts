// apps/server/src/domain/calibration/fixed_point_metric_v1.ts
// Purpose: provide deterministic BigInt metric arithmetic for MCFT-CAP-06 calibration and paired historical shadow evaluation.
// Boundary: pure fixed-point math only; no Number-based computational authority, replay, persistence, clock, environment, network, or mutable global state.

import {
  divideBigIntHalfAwayFromZeroV1,
  formatFixedDecimalV1,
  parseFixedDecimalV1,
  rescaleFixedUnitsV1,
} from "../soil_water/fixed_point_water_decimal_v1.js";
import { semanticHashV1 } from "../twin_runtime/canonical_identity_v1.js";

export const CAP06_PARAMETER_SCALE_V1 = 6 as const;
export const CAP06_VWC_METRIC_SCALE_V1 = 9 as const;
export const CAP06_SSE_SCALE_V1 = 18 as const;
export const CAP06_ABSOLUTE_ERROR_SCALE_V1 = 9 as const;
export const CAP06_METRIC_ROUNDING_RULE_V1 = "DECIMAL_HALF_AWAY_FROM_ZERO_V1" as const;
export const CAP06_INTEGER_SQRT_ALGORITHM_ID_V1 = "BIGINT_NEAREST_INTEGER_SQRT_V1" as const;

export type Cap06ExactMseFractionV1 = {
  numerator_sse_scale_18: string;
  denominator_case_count: string;
};

export type Cap06ErrorMetricsV1 = {
  case_count: number;
  sum_squared_error_scale_18: string;
  mean_squared_error_exact_fraction: Cap06ExactMseFractionV1;
  mean_squared_error_scale_18: string;
  root_mean_squared_error_vwc: string;
  sum_absolute_error_scale_9: string;
  mean_absolute_error_vwc: string;
  sum_residual_scale_9: string;
  mean_bias_vwc: string;
  absolute_mean_bias_vwc: string;
  maximum_absolute_residual_vwc: string;
  metric_policy_id: "MCFT_CAP_06_VWC_METRIC_POLICY_V1";
  metric_policy_version: 1;
  calibration_metric_numeric_policy_id: "MCFT_CAP_06_FIXED_POINT_METRIC_POLICY_V1";
  integer_square_root_algorithm_id: typeof CAP06_INTEGER_SQRT_ALGORITHM_ID_V1;
  determinism_hash: string;
};

function absoluteV1(value: bigint): bigint {
  return value < 0n ? -value : value;
}

function requirePositiveIntegerV1(value: number, code: string): bigint {
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error(code);
  return BigInt(value);
}

export function parseCap06VwcMetricV1(value: unknown, code = "CAP06_VWC_METRIC_REQUIRED"): bigint {
  return parseFixedDecimalV1(value, CAP06_VWC_METRIC_SCALE_V1, code);
}

export function formatCap06VwcMetricV1(units: bigint): string {
  return formatFixedDecimalV1(units, CAP06_VWC_METRIC_SCALE_V1);
}

export function rescaleCap06VwcMetricV1(value: unknown, sourceScale: number): string {
  const sourceUnits = parseFixedDecimalV1(value, sourceScale, "CAP06_SOURCE_VWC_REQUIRED");
  return formatCap06VwcMetricV1(
    rescaleFixedUnitsV1(sourceUnits, sourceScale, CAP06_VWC_METRIC_SCALE_V1),
  );
}

export function integerSquareRootNearestV1(value: bigint): bigint {
  if (value < 0n) throw new Error("CAP06_INTEGER_SQRT_NEGATIVE");
  if (value < 2n) return value;
  let low = 1n;
  let high = value;
  while (low <= high) {
    const middle = (low + high) >> 1n;
    const square = middle * middle;
    if (square === value) return middle;
    if (square < value) low = middle + 1n;
    else high = middle - 1n;
  }
  const floor = high;
  const ceiling = floor + 1n;
  const lowerDistance = value - floor * floor;
  const upperDistance = ceiling * ceiling - value;
  return upperDistance <= lowerDistance ? ceiling : floor;
}

export function buildCap06ErrorMetricsV1(residualsVwc: readonly string[]): Cap06ErrorMetricsV1 {
  if (residualsVwc.length === 0) throw new Error("CAP06_ERROR_METRICS_CASES_REQUIRED");
  const count = requirePositiveIntegerV1(residualsVwc.length, "CAP06_ERROR_METRICS_CASE_COUNT_INVALID");
  let sumSquared = 0n;
  let sumAbsolute = 0n;
  let sumResidual = 0n;
  let maximumAbsolute = 0n;

  for (const residual of residualsVwc) {
    const units = parseCap06VwcMetricV1(residual);
    const absolute = absoluteV1(units);
    sumSquared += units * units;
    sumAbsolute += absolute;
    sumResidual += units;
    if (absolute > maximumAbsolute) maximumAbsolute = absolute;
  }

  const mseUnitsScale18 = divideBigIntHalfAwayFromZeroV1(sumSquared, count);
  const rmseUnitsScale9 = integerSquareRootNearestV1(mseUnitsScale18);
  const maeUnitsScale9 = divideBigIntHalfAwayFromZeroV1(sumAbsolute, count);
  const meanBiasUnitsScale9 = divideBigIntHalfAwayFromZeroV1(sumResidual, count);
  const semantic = {
    case_count: residualsVwc.length,
    sum_squared_error_scale_18: sumSquared.toString(),
    mean_squared_error_exact_fraction: {
      numerator_sse_scale_18: sumSquared.toString(),
      denominator_case_count: count.toString(),
    },
    mean_squared_error_scale_18: mseUnitsScale18.toString(),
    root_mean_squared_error_vwc: formatCap06VwcMetricV1(rmseUnitsScale9),
    sum_absolute_error_scale_9: sumAbsolute.toString(),
    mean_absolute_error_vwc: formatCap06VwcMetricV1(maeUnitsScale9),
    sum_residual_scale_9: sumResidual.toString(),
    mean_bias_vwc: formatCap06VwcMetricV1(meanBiasUnitsScale9),
    absolute_mean_bias_vwc: formatCap06VwcMetricV1(absoluteV1(meanBiasUnitsScale9)),
    maximum_absolute_residual_vwc: formatCap06VwcMetricV1(maximumAbsolute),
    metric_policy_id: "MCFT_CAP_06_VWC_METRIC_POLICY_V1" as const,
    metric_policy_version: 1 as const,
    calibration_metric_numeric_policy_id: "MCFT_CAP_06_FIXED_POINT_METRIC_POLICY_V1" as const,
    integer_square_root_algorithm_id: CAP06_INTEGER_SQRT_ALGORITHM_ID_V1,
  };
  return {
    ...semantic,
    determinism_hash: semanticHashV1(semantic),
  };
}

export function compareCap06MseV1(left: Cap06ErrorMetricsV1, right: Cap06ErrorMetricsV1): number {
  const leftNumerator = BigInt(left.mean_squared_error_exact_fraction.numerator_sse_scale_18);
  const leftDenominator = BigInt(left.mean_squared_error_exact_fraction.denominator_case_count);
  const rightNumerator = BigInt(right.mean_squared_error_exact_fraction.numerator_sse_scale_18);
  const rightDenominator = BigInt(right.mean_squared_error_exact_fraction.denominator_case_count);
  const leftCross = leftNumerator * rightDenominator;
  const rightCross = rightNumerator * leftDenominator;
  return leftCross < rightCross ? -1 : leftCross > rightCross ? 1 : 0;
}

export function compareCap06AbsoluteMeanBiasV1(
  left: Cap06ErrorMetricsV1,
  right: Cap06ErrorMetricsV1,
): number {
  const leftCross = absoluteV1(BigInt(left.sum_residual_scale_9)) * BigInt(right.case_count);
  const rightCross = absoluteV1(BigInt(right.sum_residual_scale_9)) * BigInt(left.case_count);
  return leftCross < rightCross ? -1 : leftCross > rightCross ? 1 : 0;
}

export function compareCap06MaximumAbsoluteResidualV1(
  left: Cap06ErrorMetricsV1,
  right: Cap06ErrorMetricsV1,
): number {
  const leftUnits = parseCap06VwcMetricV1(left.maximum_absolute_residual_vwc);
  const rightUnits = parseCap06VwcMetricV1(right.maximum_absolute_residual_vwc);
  return leftUnits < rightUnits ? -1 : leftUnits > rightUnits ? 1 : 0;
}

export function cap06RmseRelativeImprovementAtLeastV1(
  baseline: Cap06ErrorMetricsV1,
  candidate: Cap06ErrorMetricsV1,
  retainedRmseNumerator: bigint,
  retainedRmseDenominator: bigint,
): boolean {
  if (retainedRmseNumerator < 0n || retainedRmseDenominator <= 0n) {
    throw new Error("CAP06_RMSE_RATIO_INVALID");
  }
  const baselineSse = BigInt(baseline.sum_squared_error_scale_18);
  const candidateSse = BigInt(candidate.sum_squared_error_scale_18);
  const baselineCount = BigInt(baseline.case_count);
  const candidateCount = BigInt(candidate.case_count);
  return candidateSse
      * baselineCount
      * retainedRmseDenominator
      * retainedRmseDenominator
    <= baselineSse
      * candidateCount
      * retainedRmseNumerator
      * retainedRmseNumerator;
}

export function cap06AbsoluteMeanBiasWithinToleranceV1(
  baseline: Cap06ErrorMetricsV1,
  candidate: Cap06ErrorMetricsV1,
  toleranceVwc: string,
): boolean {
  const tolerance = parseCap06VwcMetricV1(toleranceVwc, "CAP06_BIAS_TOLERANCE_REQUIRED");
  if (tolerance < 0n) throw new Error("CAP06_BIAS_TOLERANCE_NEGATIVE");
  const baselineCount = BigInt(baseline.case_count);
  const candidateCount = BigInt(candidate.case_count);
  const baselineAbsoluteSum = absoluteV1(BigInt(baseline.sum_residual_scale_9));
  const candidateAbsoluteSum = absoluteV1(BigInt(candidate.sum_residual_scale_9));
  return candidateAbsoluteSum * baselineCount
    <= baselineAbsoluteSum * candidateCount + tolerance * baselineCount * candidateCount;
}

export function cap06MaximumResidualWithinToleranceV1(
  baseline: Cap06ErrorMetricsV1,
  candidate: Cap06ErrorMetricsV1,
  multiplierNumerator: bigint,
  multiplierDenominator: bigint,
  additiveToleranceVwc: string,
): boolean {
  if (multiplierNumerator < 0n || multiplierDenominator <= 0n) {
    throw new Error("CAP06_MAX_RESIDUAL_MULTIPLIER_INVALID");
  }
  const baselineMaximum = parseCap06VwcMetricV1(baseline.maximum_absolute_residual_vwc);
  const candidateMaximum = parseCap06VwcMetricV1(candidate.maximum_absolute_residual_vwc);
  const additive = parseCap06VwcMetricV1(additiveToleranceVwc, "CAP06_MAX_RESIDUAL_TOLERANCE_REQUIRED");
  if (additive < 0n) throw new Error("CAP06_MAX_RESIDUAL_TOLERANCE_NEGATIVE");
  return candidateMaximum * multiplierDenominator
    <= baselineMaximum * multiplierNumerator + additive * multiplierDenominator;
}
