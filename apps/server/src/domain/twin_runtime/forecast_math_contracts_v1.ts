// apps/server/src/domain/twin_runtime/forecast_math_contracts_v1.ts
// Purpose: freeze the MCFT-CAP-04 S3 pure 72-hour Forecast math result, fixed-point computation trace, aggregate metrics, and deterministic validation.
// Boundary: pure contracts only; no forcing selection, Scenario math, persistence, migration, projection, route, scheduler, filesystem, network, environment, or wall clock.

import { semanticHashV1 } from "./canonical_identity_v1.js";
import {
  CAP04_FORECAST_POINT_COUNT_V1,
  validateCap04ForecastRunPayloadV1,
  type Cap04ForecastPointV1,
  type Cap04ForecastRunPayloadV1,
} from "./forecast_scenario_contracts_v1.js";

export const CAP04_PURE_FORECAST_MATH_CONTRACT_ID_V1 = "MCFT_CAP_04_PURE_72H_FORECAST_MATH_V1" as const;
export const CAP04_FORECAST_INTERVAL_SEMANTICS_V1 = "CONTROLLED_UNCALIBRATED_NORMAL_APPROXIMATION" as const;

export type Cap04ForecastMathPointTraceV1 = {
  horizon_hour: number;
  previous_storage_variance_mm2_decimal: string;
  rainfall_variance_mm2_decimal: string;
  crop_et_variance_mm2_decimal: string;
  baseline_irrigation_variance_mm2_decimal: "0.000000000000";
  structural_variance_mm2_decimal: string;
  storage_variance_mm2_decimal: string;
  storage_stddev_mm: string;
  pre_bound_storage_mm: string;
  post_bound_storage_mm: string;
  lower_bound_applied: boolean;
  upper_bound_applied: boolean;
  overflow_mm: string;
  physical_bound_applied: boolean;
  lower_interval_bound_applied: boolean;
  upper_interval_bound_applied: boolean;
  latent_variance_reduced_by_clipping: false;
  interval_semantics: typeof CAP04_FORECAST_INTERVAL_SEMANTICS_V1;
  point_semantic_hash: string;
};

export type Cap04Pure72hForecastMathResultV1 = {
  schema_version: "geox_mcft_cap_04_pure_72h_forecast_math_result_v1";
  contract_id: typeof CAP04_PURE_FORECAST_MATH_CONTRACT_ID_V1;
  forecast_payload: Cap04ForecastRunPayloadV1;
  point_traces: Cap04ForecastMathPointTraceV1[];
  trajectory_hash: string;
  forecast_math_hash: string;
  aggregates: {
    final_storage_mm: string;
    minimum_available_water_fraction: string;
    total_precipitation_mm: string;
    total_crop_et_mm: string;
    total_irrigation_mm: "0.000000";
    total_runoff_mm: string;
    total_drainage_mm: string;
    total_overflow_mm: string;
  };
  uncertainty_basis: {
    method_id: "ADDITIVE_STORAGE_VARIANCE_ZERO_COVARIANCE_V1";
    interval_method_id: "NORMAL_95_PERCENT_Z_1_96_V1";
    interval_semantics: typeof CAP04_FORECAST_INTERVAL_SEMANTICS_V1;
    source_posterior_storage_variance_authority: "COMPUTATION_BASIS_STORAGE_VARIANCE_MM2_DECIMAL";
    physical_clipping_reduces_latent_variance: false;
  };
  limitations: string[];
};

function exactDecimalV1(value: unknown, scale: number, code: string): string {
  if (typeof value !== "string" || !new RegExp(`^-?\\d+\\.\\d{${scale}}$`).test(value)) throw new Error(code);
  return value;
}

function sortedUniqueV1(values: unknown, code: string): asserts values is string[] {
  if (!Array.isArray(values) || values.some((value) => typeof value !== "string" || !value.trim())) throw new Error(code);
  if (JSON.stringify(values) !== JSON.stringify([...new Set(values)].sort())) throw new Error(code);
}

export function computeCap04ForecastTrajectoryHashV1(points: readonly Cap04ForecastPointV1[]): string {
  return semanticHashV1(points.map((point) => point.determinism_hash));
}

export function computeCap04ForecastMathHashV1(input: Omit<Cap04Pure72hForecastMathResultV1, "forecast_math_hash">): string {
  return semanticHashV1(input as unknown as Record<string, unknown>);
}

export function validateCap04Pure72hForecastMathResultV1(value: Cap04Pure72hForecastMathResultV1): void {
  if (!value || typeof value !== "object") throw new Error("CAP04_FORECAST_MATH_RESULT_REQUIRED");
  if (value.schema_version !== "geox_mcft_cap_04_pure_72h_forecast_math_result_v1") throw new Error("CAP04_FORECAST_MATH_SCHEMA_MISMATCH");
  if (value.contract_id !== CAP04_PURE_FORECAST_MATH_CONTRACT_ID_V1) throw new Error("CAP04_FORECAST_MATH_CONTRACT_MISMATCH");
  validateCap04ForecastRunPayloadV1(value.forecast_payload);
  if (value.forecast_payload.status !== "COMPLETED") throw new Error("CAP04_FORECAST_MATH_COMPLETED_REQUIRED");
  if (!Array.isArray(value.point_traces) || value.point_traces.length !== CAP04_FORECAST_POINT_COUNT_V1) throw new Error("CAP04_FORECAST_MATH_TRACE_COUNT_MISMATCH");
  for (let index = 0; index < value.point_traces.length; index += 1) {
    const trace = value.point_traces[index];
    const point = value.forecast_payload.points[index];
    if (!trace || trace.horizon_hour !== index + 1 || point.horizon_hour !== trace.horizon_hour) throw new Error("CAP04_FORECAST_MATH_TRACE_HORIZON_MISMATCH");
    for (const field of [
      "previous_storage_variance_mm2_decimal", "rainfall_variance_mm2_decimal", "crop_et_variance_mm2_decimal",
      "baseline_irrigation_variance_mm2_decimal", "structural_variance_mm2_decimal", "storage_variance_mm2_decimal",
    ] as const) exactDecimalV1(trace[field], 12, `CAP04_FORECAST_MATH_TRACE_${field.toUpperCase()}_INVALID`);
    for (const field of ["storage_stddev_mm", "pre_bound_storage_mm", "post_bound_storage_mm", "overflow_mm"] as const) {
      exactDecimalV1(trace[field], 6, `CAP04_FORECAST_MATH_TRACE_${field.toUpperCase()}_INVALID`);
    }
    if (trace.baseline_irrigation_variance_mm2_decimal !== "0.000000000000") throw new Error("CAP04_FORECAST_BASELINE_IRRIGATION_VARIANCE_NONZERO");
    if (trace.latent_variance_reduced_by_clipping !== false) throw new Error("CAP04_FORECAST_LATENT_VARIANCE_CLIPPING_FORBIDDEN");
    if (trace.interval_semantics !== CAP04_FORECAST_INTERVAL_SEMANTICS_V1) throw new Error("CAP04_FORECAST_INTERVAL_SEMANTICS_MISMATCH");
    if (trace.point_semantic_hash !== point.determinism_hash) throw new Error("CAP04_FORECAST_POINT_TRACE_HASH_MISMATCH");
    if (trace.post_bound_storage_mm !== point.storage_mean_mm || trace.overflow_mm !== point.saturation_overflow_mm) throw new Error("CAP04_FORECAST_POINT_TRACE_STORAGE_MISMATCH");
    if (index > 0 && trace.previous_storage_variance_mm2_decimal !== value.point_traces[index - 1].storage_variance_mm2_decimal) throw new Error("CAP04_FORECAST_VARIANCE_CHAIN_MISMATCH");
  }
  if (value.trajectory_hash !== computeCap04ForecastTrajectoryHashV1(value.forecast_payload.points)) throw new Error("CAP04_FORECAST_TRAJECTORY_HASH_MISMATCH");
  for (const field of [
    "final_storage_mm", "minimum_available_water_fraction", "total_precipitation_mm", "total_crop_et_mm",
    "total_irrigation_mm", "total_runoff_mm", "total_drainage_mm", "total_overflow_mm",
  ] as const) exactDecimalV1(value.aggregates[field], 6, `CAP04_FORECAST_AGGREGATE_${field.toUpperCase()}_INVALID`);
  if (value.aggregates.total_irrigation_mm !== "0.000000") throw new Error("CAP04_FORECAST_TOTAL_IRRIGATION_NONZERO");
  if (value.aggregates.final_storage_mm !== value.forecast_payload.points[71].storage_mean_mm) throw new Error("CAP04_FORECAST_FINAL_STORAGE_MISMATCH");
  if (value.uncertainty_basis.method_id !== "ADDITIVE_STORAGE_VARIANCE_ZERO_COVARIANCE_V1"
    || value.uncertainty_basis.interval_method_id !== "NORMAL_95_PERCENT_Z_1_96_V1"
    || value.uncertainty_basis.interval_semantics !== CAP04_FORECAST_INTERVAL_SEMANTICS_V1
    || value.uncertainty_basis.source_posterior_storage_variance_authority !== "COMPUTATION_BASIS_STORAGE_VARIANCE_MM2_DECIMAL"
    || value.uncertainty_basis.physical_clipping_reduces_latent_variance !== false) throw new Error("CAP04_FORECAST_UNCERTAINTY_BASIS_MISMATCH");
  sortedUniqueV1(value.limitations, "CAP04_FORECAST_MATH_LIMITATIONS_INVALID");
  const hashBasis = structuredClone(value) as Partial<Cap04Pure72hForecastMathResultV1>;
  delete hashBasis.forecast_math_hash;
  if (value.forecast_math_hash !== computeCap04ForecastMathHashV1(hashBasis as Omit<Cap04Pure72hForecastMathResultV1, "forecast_math_hash">)) throw new Error("CAP04_FORECAST_MATH_HASH_MISMATCH");
}
