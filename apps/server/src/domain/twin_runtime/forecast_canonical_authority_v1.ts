// apps/server/src/domain/twin_runtime/forecast_canonical_authority_v1.ts
// Purpose: freeze and validate the complete canonical CAP-04 Forecast authority, including the exact Future Forcing window, per-point uncertainty and physical-bound trace, trajectory identity, aggregates, and uncertainty basis.
// Boundary: pure contracts, construction, and validation only; no Evidence selection, Forecast execution, persistence, projection, route, scheduler, filesystem, network, environment, or wall clock.

import { semanticHashV1 } from "./canonical_identity_v1.js";
import { canonicalJsonV1 } from "./canonical_json_v1.js";
import {
  validateCap04ForecastRunPayloadV1,
  type Cap04ForecastPointV1,
  type Cap04ForecastRunPayloadV1,
} from "./forecast_scenario_contracts_v1.js";
import {
  validateCap04ForecastForcingWindowV1,
  type Cap04ForecastForcingWindowV1,
} from "./future_forcing_contracts_v1.js";
import {
  WATER_AMOUNT_SCALE_V1,
  WATER_VARIANCE_SCALE_V1,
  formatFixedDecimalV1,
  normalizeFixedDecimalV1,
  parseFixedDecimalV1,
  rescaleFixedUnitsV1,
} from "../soil_water/fixed_point_water_decimal_v1.js";

export const CAP04_CANONICAL_FORECAST_AUTHORITY_CONTRACT_ID_V1 =
  "MCFT_CAP_04_CANONICAL_FORECAST_AUTHORITY_V1" as const;
export const CAP04_FORECAST_INTERVAL_SEMANTICS_V1 =
  "CONTROLLED_UNCALIBRATED_NORMAL_APPROXIMATION" as const;

export type Cap04ForecastCanonicalPointTraceV1 = {
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

export type Cap04ForecastCanonicalAggregatesV1 = {
  final_storage_mm: string;
  minimum_available_water_fraction: string;
  total_precipitation_mm: string;
  total_crop_et_mm: string;
  total_irrigation_mm: "0.000000";
  total_runoff_mm: string;
  total_drainage_mm: string;
  total_overflow_mm: string;
};

export type Cap04ForecastCanonicalUncertaintyBasisV1 = {
  method_id: "ADDITIVE_STORAGE_VARIANCE_ZERO_COVARIANCE_V1";
  interval_method_id: "NORMAL_95_PERCENT_Z_1_96_V1";
  interval_semantics: typeof CAP04_FORECAST_INTERVAL_SEMANTICS_V1;
  source_posterior_storage_variance_authority: "COMPUTATION_BASIS_STORAGE_VARIANCE_MM2_DECIMAL";
  physical_clipping_reduces_latent_variance: false;
};

export type Cap04CanonicalCompletedForecastRunPayloadV1 = Cap04ForecastRunPayloadV1 & {
  status: "COMPLETED";
  canonical_authority_contract_id: typeof CAP04_CANONICAL_FORECAST_AUTHORITY_CONTRACT_ID_V1;
  forcing_window_authority: Cap04ForecastForcingWindowV1;
  point_traces: Cap04ForecastCanonicalPointTraceV1[];
  trajectory_hash: string;
  aggregates: Cap04ForecastCanonicalAggregatesV1;
  uncertainty_basis: Cap04ForecastCanonicalUncertaintyBasisV1;
};

export type Cap04CanonicalBlockedForecastRunPayloadV1 = Cap04ForecastRunPayloadV1 & {
  status: "BLOCKED";
  canonical_authority_contract_id: typeof CAP04_CANONICAL_FORECAST_AUTHORITY_CONTRACT_ID_V1;
  forcing_window_authority: null;
  point_traces: [];
  trajectory_hash: null;
  aggregates: null;
  uncertainty_basis: null;
};

export type Cap04CanonicalForecastRunPayloadV1 =
  | Cap04CanonicalCompletedForecastRunPayloadV1
  | Cap04CanonicalBlockedForecastRunPayloadV1;

function exactDecimalV1(value: unknown, scale: number, code: string): string {
  if (typeof value !== "string" || !new RegExp(`^-?\\d+\\.\\d{${scale}}$`).test(value)) throw new Error(code);
  return value;
}

function decimal6FromNumberV1(value: number, code: string): string {
  if (!Number.isFinite(value)) throw new Error(code);
  return normalizeFixedDecimalV1(String(value), WATER_AMOUNT_SCALE_V1, code);
}

function amountUnitsV1(value: string): bigint {
  return parseFixedDecimalV1(value, WATER_AMOUNT_SCALE_V1);
}

function formatAmountV1(value: bigint): string {
  return formatFixedDecimalV1(value, WATER_AMOUNT_SCALE_V1);
}

function computeTrajectoryHashV1(points: readonly Cap04ForecastPointV1[]): string {
  return semanticHashV1(points.map((point) => point.determinism_hash));
}

function traceWithoutPointHashV1(trace: Cap04ForecastCanonicalPointTraceV1): Omit<Cap04ForecastCanonicalPointTraceV1, "point_semantic_hash"> {
  const basis = structuredClone(trace) as Partial<Cap04ForecastCanonicalPointTraceV1>;
  delete basis.point_semantic_hash;
  return basis as Omit<Cap04ForecastCanonicalPointTraceV1, "point_semantic_hash">;
}

function validatePointTraceV1(
  point: Cap04ForecastPointV1,
  trace: Cap04ForecastCanonicalPointTraceV1,
  previousTrace: Cap04ForecastCanonicalPointTraceV1 | null,
): void {
  if (trace.horizon_hour !== point.horizon_hour) throw new Error("CAP04_CANONICAL_FORECAST_TRACE_HORIZON_MISMATCH");
  for (const field of [
    "previous_storage_variance_mm2_decimal",
    "rainfall_variance_mm2_decimal",
    "crop_et_variance_mm2_decimal",
    "baseline_irrigation_variance_mm2_decimal",
    "structural_variance_mm2_decimal",
    "storage_variance_mm2_decimal",
  ] as const) exactDecimalV1(trace[field], WATER_VARIANCE_SCALE_V1, `CAP04_CANONICAL_FORECAST_TRACE_${field.toUpperCase()}_INVALID`);
  for (const field of ["storage_stddev_mm", "pre_bound_storage_mm", "post_bound_storage_mm", "overflow_mm"] as const) {
    exactDecimalV1(trace[field], WATER_AMOUNT_SCALE_V1, `CAP04_CANONICAL_FORECAST_TRACE_${field.toUpperCase()}_INVALID`);
  }
  if (trace.baseline_irrigation_variance_mm2_decimal !== "0.000000000000") throw new Error("CAP04_CANONICAL_FORECAST_BASELINE_IRRIGATION_VARIANCE_NONZERO");
  if (trace.latent_variance_reduced_by_clipping !== false) throw new Error("CAP04_CANONICAL_FORECAST_LATENT_VARIANCE_CLIPPING_FORBIDDEN");
  if (trace.interval_semantics !== CAP04_FORECAST_INTERVAL_SEMANTICS_V1) throw new Error("CAP04_CANONICAL_FORECAST_INTERVAL_SEMANTICS_MISMATCH");
  if (trace.post_bound_storage_mm !== point.storage_mean_mm || trace.overflow_mm !== point.saturation_overflow_mm) throw new Error("CAP04_CANONICAL_FORECAST_TRACE_STORAGE_MISMATCH");
  const publishedVariance = formatFixedDecimalV1(
    rescaleFixedUnitsV1(parseFixedDecimalV1(trace.storage_variance_mm2_decimal, WATER_VARIANCE_SCALE_V1), WATER_VARIANCE_SCALE_V1, WATER_AMOUNT_SCALE_V1),
    WATER_AMOUNT_SCALE_V1,
  );
  if (publishedVariance !== point.storage_variance_mm2) throw new Error("CAP04_CANONICAL_FORECAST_TRACE_VARIANCE_MISMATCH");
  if (trace.physical_bound_applied !== (trace.lower_bound_applied || trace.upper_bound_applied)) throw new Error("CAP04_CANONICAL_FORECAST_PHYSICAL_BOUND_FLAG_MISMATCH");
  if (trace.lower_interval_bound_applied !== (point.storage_interval_unclipped_lower_mm !== point.storage_interval_emitted_lower_mm)) throw new Error("CAP04_CANONICAL_FORECAST_LOWER_INTERVAL_BOUND_FLAG_MISMATCH");
  if (trace.upper_interval_bound_applied !== (point.storage_interval_unclipped_upper_mm !== point.storage_interval_emitted_upper_mm)) throw new Error("CAP04_CANONICAL_FORECAST_UPPER_INTERVAL_BOUND_FLAG_MISMATCH");
  if (previousTrace && trace.previous_storage_variance_mm2_decimal !== previousTrace.storage_variance_mm2_decimal) throw new Error("CAP04_CANONICAL_FORECAST_VARIANCE_CHAIN_MISMATCH");
  const pointBasis = { ...point } as Partial<Cap04ForecastPointV1>;
  delete pointBasis.determinism_hash;
  const expectedPointHash = semanticHashV1({
    point: pointBasis,
    computation_trace: traceWithoutPointHashV1(trace),
  });
  if (trace.point_semantic_hash !== point.determinism_hash || point.determinism_hash !== expectedPointHash) throw new Error("CAP04_CANONICAL_FORECAST_POINT_TRACE_HASH_MISMATCH");
}

function validateForcingEqualityV1(payload: Cap04CanonicalCompletedForecastRunPayloadV1): void {
  const window = payload.forcing_window_authority;
  validateCap04ForecastForcingWindowV1(window);
  if (payload.issued_at !== window.logical_time) throw new Error("CAP04_CANONICAL_FORECAST_FORCING_TIME_MISMATCH");
  if (payload.runtime_config_ref !== window.runtime_config_ref || payload.runtime_config_hash !== window.runtime_config_hash) throw new Error("CAP04_CANONICAL_FORECAST_FORCING_CONFIG_MISMATCH");
  if (payload.crop_stage_context_ref !== window.crop_stage_context_ref || payload.crop_stage_context_hash !== window.crop_stage_context_hash) throw new Error("CAP04_CANONICAL_FORECAST_FORCING_CROP_STAGE_MISMATCH");
  if (payload.future_forcing_pair_policy_id !== window.future_forcing_pair_policy_id
    || payload.future_forcing_policy_id !== window.future_forcing_policy_id
    || payload.future_forcing_fallback_policy_id !== window.future_forcing_fallback_policy_id) {
    throw new Error("CAP04_CANONICAL_FORECAST_FORCING_POLICY_MISMATCH");
  }
  if (payload.forcing_window_hash !== window.forcing_window_hash || payload.forcing_cycle_key !== window.forcing_cycle_key) throw new Error("CAP04_CANONICAL_FORECAST_FORCING_WINDOW_IDENTITY_MISMATCH");
  if (payload.weather_snapshot_ref !== window.weather_snapshot_ref || payload.weather_snapshot_hash !== window.weather_snapshot_hash) throw new Error("CAP04_CANONICAL_FORECAST_WEATHER_AUTHORITY_MISMATCH");
  if (payload.et0_snapshot_ref !== window.et0_snapshot_ref || payload.et0_snapshot_hash !== window.et0_snapshot_hash) throw new Error("CAP04_CANONICAL_FORECAST_ET0_AUTHORITY_MISMATCH");
  if (payload.points.length !== window.points.length) throw new Error("CAP04_CANONICAL_FORECAST_FORCING_POINT_COUNT_MISMATCH");
  for (let index = 0; index < payload.points.length; index += 1) {
    const point = payload.points[index];
    const forcing = window.points[index];
    if (point.horizon_hour !== forcing.horizon_hour
      || point.interval_start !== forcing.interval_start
      || point.interval_end !== forcing.interval_end
      || point.target_time !== forcing.target_time) throw new Error("CAP04_CANONICAL_FORECAST_FORCING_POINT_TIME_MISMATCH");
    if (point.gross_precipitation_assumption_mm !== decimal6FromNumberV1(forcing.precipitation_assumption_mm, "CAP04_CANONICAL_FORECAST_PRECIPITATION_INVALID")) throw new Error("CAP04_CANONICAL_FORECAST_PRECIPITATION_AUTHORITY_MISMATCH");
    if (point.reference_et0_mm !== decimal6FromNumberV1(forcing.et0_assumption_mm, "CAP04_CANONICAL_FORECAST_ET0_INVALID")) throw new Error("CAP04_CANONICAL_FORECAST_ET0_POINT_AUTHORITY_MISMATCH");
    if (point.crop_stage_code !== forcing.crop_stage_code || point.kc !== decimal6FromNumberV1(forcing.kc, "CAP04_CANONICAL_FORECAST_KC_INVALID")) throw new Error("CAP04_CANONICAL_FORECAST_CROP_STAGE_POINT_AUTHORITY_MISMATCH");
  }
}

function validateAggregatesV1(payload: Cap04CanonicalCompletedForecastRunPayloadV1): void {
  const aggregates = payload.aggregates;
  for (const field of [
    "final_storage_mm",
    "minimum_available_water_fraction",
    "total_precipitation_mm",
    "total_crop_et_mm",
    "total_irrigation_mm",
    "total_runoff_mm",
    "total_drainage_mm",
    "total_overflow_mm",
  ] as const) exactDecimalV1(aggregates[field], WATER_AMOUNT_SCALE_V1, `CAP04_CANONICAL_FORECAST_AGGREGATE_${field.toUpperCase()}_INVALID`);
  let minimumAwf = amountUnitsV1(payload.points[0].available_water_fraction);
  let precipitation = 0n;
  let cropEt = 0n;
  let irrigation = 0n;
  let runoff = 0n;
  let drainage = 0n;
  let overflow = 0n;
  for (const point of payload.points) {
    const awf = amountUnitsV1(point.available_water_fraction);
    if (awf < minimumAwf) minimumAwf = awf;
    precipitation += amountUnitsV1(point.gross_precipitation_assumption_mm);
    cropEt += amountUnitsV1(point.actual_crop_et_mm);
    irrigation += amountUnitsV1(point.assumed_irrigation_mm);
    runoff += amountUnitsV1(point.surface_runoff_mm);
    drainage += amountUnitsV1(point.drainage_mm);
    overflow += amountUnitsV1(point.saturation_overflow_mm);
  }
  const expected: Cap04ForecastCanonicalAggregatesV1 = {
    final_storage_mm: payload.points[payload.points.length - 1].storage_mean_mm,
    minimum_available_water_fraction: formatAmountV1(minimumAwf),
    total_precipitation_mm: formatAmountV1(precipitation),
    total_crop_et_mm: formatAmountV1(cropEt),
    total_irrigation_mm: "0.000000",
    total_runoff_mm: formatAmountV1(runoff),
    total_drainage_mm: formatAmountV1(drainage),
    total_overflow_mm: formatAmountV1(overflow),
  };
  if (canonicalJsonV1(aggregates) !== canonicalJsonV1(expected)) throw new Error("CAP04_CANONICAL_FORECAST_AGGREGATE_AUTHORITY_MISMATCH");
}

export function attachCap04CanonicalCompletedForecastAuthorityV1(input: {
  forecast_payload: Cap04ForecastRunPayloadV1;
  forcing_window: Cap04ForecastForcingWindowV1;
  point_traces: Cap04ForecastCanonicalPointTraceV1[];
  trajectory_hash: string;
  aggregates: Cap04ForecastCanonicalAggregatesV1;
  uncertainty_basis: Cap04ForecastCanonicalUncertaintyBasisV1;
}): Cap04CanonicalCompletedForecastRunPayloadV1 {
  if (input.forecast_payload.status !== "COMPLETED") throw new Error("CAP04_CANONICAL_FORECAST_COMPLETED_PAYLOAD_REQUIRED");
  const payload = {
    ...structuredClone(input.forecast_payload),
    status: "COMPLETED" as const,
    canonical_authority_contract_id: CAP04_CANONICAL_FORECAST_AUTHORITY_CONTRACT_ID_V1,
    forcing_window_authority: structuredClone(input.forcing_window),
    point_traces: structuredClone(input.point_traces),
    trajectory_hash: input.trajectory_hash,
    aggregates: structuredClone(input.aggregates),
    uncertainty_basis: structuredClone(input.uncertainty_basis),
  };
  validateCap04CanonicalForecastRunPayloadV1(payload);
  return payload;
}

export function validateCap04CanonicalForecastRunPayloadV1(value: Cap04CanonicalForecastRunPayloadV1): void {
  validateCap04ForecastRunPayloadV1(value);
  if (value.canonical_authority_contract_id !== CAP04_CANONICAL_FORECAST_AUTHORITY_CONTRACT_ID_V1) throw new Error("CAP04_CANONICAL_FORECAST_AUTHORITY_CONTRACT_MISMATCH");
  if (value.status === "BLOCKED") {
    if (value.forcing_window_authority !== null
      || value.point_traces.length !== 0
      || value.trajectory_hash !== null
      || value.aggregates !== null
      || value.uncertainty_basis !== null) throw new Error("CAP04_BLOCKED_FORECAST_CANONICAL_AUTHORITY_MUST_BE_EMPTY");
    return;
  }
  validateForcingEqualityV1(value);
  if (value.point_traces.length !== value.points.length) throw new Error("CAP04_CANONICAL_FORECAST_TRACE_COUNT_MISMATCH");
  for (let index = 0; index < value.point_traces.length; index += 1) {
    validatePointTraceV1(value.points[index], value.point_traces[index], index === 0 ? null : value.point_traces[index - 1]);
  }
  if (value.trajectory_hash !== computeTrajectoryHashV1(value.points)) throw new Error("CAP04_CANONICAL_FORECAST_TRAJECTORY_HASH_MISMATCH");
  validateAggregatesV1(value);
  if (value.uncertainty_basis.method_id !== "ADDITIVE_STORAGE_VARIANCE_ZERO_COVARIANCE_V1"
    || value.uncertainty_basis.interval_method_id !== "NORMAL_95_PERCENT_Z_1_96_V1"
    || value.uncertainty_basis.interval_semantics !== CAP04_FORECAST_INTERVAL_SEMANTICS_V1
    || value.uncertainty_basis.source_posterior_storage_variance_authority !== "COMPUTATION_BASIS_STORAGE_VARIANCE_MM2_DECIMAL"
    || value.uncertainty_basis.physical_clipping_reduces_latent_variance !== false) throw new Error("CAP04_CANONICAL_FORECAST_UNCERTAINTY_BASIS_MISMATCH");
}
