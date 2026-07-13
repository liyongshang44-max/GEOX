// apps/server/src/domain/twin_runtime/forecast_math_contracts_v1.ts
// Purpose: freeze the MCFT-CAP-04 S3 pure 72-hour Forecast math result while requiring the same complete uncertainty, physical-bound, aggregate, and Future Forcing authority to be embedded in the canonical Forecast payload.
// Boundary: pure contracts only; no forcing selection, Scenario math, persistence, migration, projection, route, scheduler, filesystem, network, environment, or wall clock.

import { semanticHashV1 } from "./canonical_identity_v1.js";
import { canonicalJsonV1 } from "./canonical_json_v1.js";
import {
  CAP04_FORECAST_INTERVAL_SEMANTICS_V1,
  validateCap04CanonicalForecastRunPayloadV1,
  type Cap04CanonicalCompletedForecastRunPayloadV1,
  type Cap04ForecastCanonicalAggregatesV1,
  type Cap04ForecastCanonicalPointTraceV1,
  type Cap04ForecastCanonicalUncertaintyBasisV1,
} from "./forecast_canonical_authority_v1.js";
import {
  CAP04_FORECAST_POINT_COUNT_V1,
  type Cap04ForecastPointV1,
} from "./forecast_scenario_contracts_v1.js";

export { CAP04_FORECAST_INTERVAL_SEMANTICS_V1 } from "./forecast_canonical_authority_v1.js";

export const CAP04_PURE_FORECAST_MATH_CONTRACT_ID_V1 = "MCFT_CAP_04_PURE_72H_FORECAST_MATH_V1" as const;

export type Cap04ForecastMathPointTraceV1 = Cap04ForecastCanonicalPointTraceV1;

export type Cap04Pure72hForecastMathResultV1 = {
  schema_version: "geox_mcft_cap_04_pure_72h_forecast_math_result_v1";
  contract_id: typeof CAP04_PURE_FORECAST_MATH_CONTRACT_ID_V1;
  forecast_payload: Cap04CanonicalCompletedForecastRunPayloadV1;
  point_traces: Cap04ForecastMathPointTraceV1[];
  trajectory_hash: string;
  forecast_math_hash: string;
  aggregates: Cap04ForecastCanonicalAggregatesV1;
  uncertainty_basis: Cap04ForecastCanonicalUncertaintyBasisV1;
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
  validateCap04CanonicalForecastRunPayloadV1(value.forecast_payload);
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
  if (canonicalJsonV1(value.point_traces) !== canonicalJsonV1(value.forecast_payload.point_traces)) throw new Error("CAP04_FORECAST_CANONICAL_TRACE_AUTHORITY_MISMATCH");
  if (value.trajectory_hash !== value.forecast_payload.trajectory_hash) throw new Error("CAP04_FORECAST_CANONICAL_TRAJECTORY_AUTHORITY_MISMATCH");
  if (canonicalJsonV1(value.aggregates) !== canonicalJsonV1(value.forecast_payload.aggregates)) throw new Error("CAP04_FORECAST_CANONICAL_AGGREGATE_AUTHORITY_MISMATCH");
  if (canonicalJsonV1(value.uncertainty_basis) !== canonicalJsonV1(value.forecast_payload.uncertainty_basis)) throw new Error("CAP04_FORECAST_CANONICAL_UNCERTAINTY_AUTHORITY_MISMATCH");
  sortedUniqueV1(value.limitations, "CAP04_FORECAST_MATH_LIMITATIONS_INVALID");
  if (canonicalJsonV1(value.limitations) !== canonicalJsonV1(value.forecast_payload.limitations)) throw new Error("CAP04_FORECAST_CANONICAL_LIMITATIONS_AUTHORITY_MISMATCH");
  const hashBasis = structuredClone(value) as Partial<Cap04Pure72hForecastMathResultV1>;
  delete hashBasis.forecast_math_hash;
  if (value.forecast_math_hash !== computeCap04ForecastMathHashV1(hashBasis as Omit<Cap04Pure72hForecastMathResultV1, "forecast_math_hash">)) throw new Error("CAP04_FORECAST_MATH_HASH_MISMATCH");
}
