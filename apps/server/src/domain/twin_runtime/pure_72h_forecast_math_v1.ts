// apps/server/src/domain/twin_runtime/pure_72h_forecast_math_v1.ts
// Purpose: execute the bounded MCFT-CAP-04 S3 deterministic 72-hour Forecast baseline from one posterior State, one pinned Runtime Config, and one already-selected Future Forcing window.
// Boundary: pure fixed-point Domain math only; no Evidence selection, observation update, Scenario math, persistence, canonical append, migration, projection, route, scheduler, filesystem, network, environment, or wall clock.

import { semanticHashV1 } from "./canonical_identity_v1.js";
import {
  CAP04_FORECAST_BASELINE_ASSUMPTION_V1,
  type Cap04ForecastPointV1,
  type Cap04ForecastRunPayloadV1,
} from "./forecast_scenario_contracts_v1.js";
import {
  CAP04_FORECAST_INTERVAL_METHOD_ID_V1,
  CAP04_FORECAST_METHOD_ID_V1,
  CAP04_FORECAST_METHOD_VERSION_V1,
  CAP04_UNCERTAINTY_PROPAGATION_METHOD_ID_V1,
  validateCap04RuntimeConfigPayloadV1,
  type Cap04RuntimeConfigPayloadV1,
} from "./forecast_scenario_runtime_config_v1.js";
import {
  validateCap04ForecastForcingWindowV1,
  type Cap04ForecastForcingWindowV1,
} from "./future_forcing_contracts_v1.js";
import {
  CAP04_FORECAST_INTERVAL_SEMANTICS_V1,
  CAP04_PURE_FORECAST_MATH_CONTRACT_ID_V1,
  computeCap04ForecastMathHashV1,
  computeCap04ForecastTrajectoryHashV1,
  validateCap04Pure72hForecastMathResultV1,
  type Cap04ForecastMathPointTraceV1,
  type Cap04Pure72hForecastMathResultV1,
} from "./forecast_math_contracts_v1.js";
import {
  WATER_AMOUNT_SCALE_V1,
  WATER_VARIANCE_SCALE_V1,
  clampFixedUnitsV1,
  divideFixedUnitsV1,
  formatFixedDecimalV1,
  multiplyFixedUnitsV1,
  normalizeFixedDecimalV1,
  parseFixedDecimalV1,
  requireNonNegativeFixedUnitsV1,
  rescaleFixedUnitsV1,
  squareScale6ToScale12V1,
  sqrtScale12ToScale6V1,
} from "../soil_water/fixed_point_water_decimal_v1.js";

export type Cap04Pure72hForecastMathInputV1 = {
  source_posterior: {
    ref: string;
    hash: string;
    logical_time: string;
    computation_basis: {
      storage_mean_mm_decimal: string;
      storage_variance_mm2_decimal: string;
    };
  };
  runtime_config: {
    ref: string;
    hash: string;
    payload: Cap04RuntimeConfigPayloadV1;
  };
  forcing_window: Cap04ForecastForcingWindowV1;
};

function requiredStringV1(value: unknown, code: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(code);
  return value;
}

function canonicalHourV1(value: unknown, code: string): string {
  const text = requiredStringV1(value, code);
  const parsed = Date.parse(text);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== text || !text.endsWith(":00:00.000Z")) throw new Error(code);
  return text;
}

function decimal6V1(value: unknown, code: string): string {
  return normalizeFixedDecimalV1(typeof value === "number" ? String(value) : value, WATER_AMOUNT_SCALE_V1, code);
}

function nonNegativeAmountV1(value: unknown, code: string): bigint {
  return requireNonNegativeFixedUnitsV1(parseFixedDecimalV1(decimal6V1(value, code), WATER_AMOUNT_SCALE_V1, code), `${code}_NEGATIVE`);
}

function nonNegativeVarianceV1(value: unknown, code: string): bigint {
  return requireNonNegativeFixedUnitsV1(parseFixedDecimalV1(value, WATER_VARIANCE_SCALE_V1, code), `${code}_NEGATIVE`);
}

function relativeVarianceV1(amountUnits: bigint, relativeStddevUnits: bigint): bigint {
  const stddevUnits = multiplyFixedUnitsV1(
    amountUnits,
    WATER_AMOUNT_SCALE_V1,
    relativeStddevUnits,
    WATER_AMOUNT_SCALE_V1,
    WATER_AMOUNT_SCALE_V1,
  );
  return squareScale6ToScale12V1(stddevUnits);
}

function sortedUniqueV1(values: readonly string[]): string[] {
  return [...new Set(values)].sort();
}

export function executeCap04Pure72hForecastMathV1(
  input: Cap04Pure72hForecastMathInputV1,
): Cap04Pure72hForecastMathResultV1 {
  validateCap04RuntimeConfigPayloadV1(input.runtime_config.payload);
  validateCap04ForecastForcingWindowV1(input.forcing_window);
  const config = input.runtime_config.payload;
  const issuedAt = canonicalHourV1(input.source_posterior.logical_time, "CAP04_FORECAST_SOURCE_POSTERIOR_LOGICAL_TIME_INVALID");
  if (issuedAt !== input.forcing_window.logical_time) throw new Error("CAP04_FORECAST_POSTERIOR_FORCING_TIME_MISMATCH");
  if (config.effective_logical_time !== issuedAt) throw new Error("CAP04_FORECAST_CONFIG_EFFECTIVE_TIME_MISMATCH");
  const runtimeConfigRef = requiredStringV1(input.runtime_config.ref, "CAP04_FORECAST_RUNTIME_CONFIG_REF_REQUIRED");
  const runtimeConfigHash = requiredStringV1(input.runtime_config.hash, "CAP04_FORECAST_RUNTIME_CONFIG_HASH_REQUIRED");
  if (input.forcing_window.runtime_config_ref !== runtimeConfigRef || input.forcing_window.runtime_config_hash !== runtimeConfigHash) throw new Error("CAP04_FORECAST_FORCING_CONFIG_IDENTITY_MISMATCH");
  if (input.forcing_window.crop_stage_context_ref !== config.crop_stage_context_ref || input.forcing_window.crop_stage_context_hash !== config.crop_stage_context_hash) throw new Error("CAP04_FORECAST_CROP_STAGE_CONTEXT_MISMATCH");

  const sourcePosteriorRef = requiredStringV1(input.source_posterior.ref, "CAP04_FORECAST_SOURCE_POSTERIOR_REF_REQUIRED");
  const sourcePosteriorHash = requiredStringV1(input.source_posterior.hash, "CAP04_FORECAST_SOURCE_POSTERIOR_HASH_REQUIRED");
  let previousStorageUnits = nonNegativeAmountV1(input.source_posterior.computation_basis.storage_mean_mm_decimal, "CAP04_FORECAST_SOURCE_STORAGE_REQUIRED");
  let previousVarianceUnits = nonNegativeVarianceV1(input.source_posterior.computation_basis.storage_variance_mm2_decimal, "CAP04_FORECAST_SOURCE_VARIANCE_REQUIRED");

  const hydraulic = config.soil_hydraulic_snapshot;
  const dynamics = config.dynamics_parameters;
  const uncertainty = config.process_uncertainty;
  const wiltingStorageUnits = nonNegativeAmountV1(hydraulic.wilting_point_storage_mm, "CAP04_FORECAST_WILTING_STORAGE_REQUIRED");
  const fieldCapacityUnits = nonNegativeAmountV1(hydraulic.field_capacity_storage_mm, "CAP04_FORECAST_FIELD_CAPACITY_REQUIRED");
  const saturationStorageUnits = nonNegativeAmountV1(hydraulic.saturation_storage_mm, "CAP04_FORECAST_SATURATION_STORAGE_REQUIRED");
  if (!(wiltingStorageUnits < fieldCapacityUnits && fieldCapacityUnits < saturationStorageUnits)) throw new Error("CAP04_FORECAST_HYDRAULIC_STORAGE_ORDER_INVALID");
  if (previousStorageUnits > saturationStorageUnits) throw new Error("CAP04_FORECAST_SOURCE_STORAGE_ABOVE_SATURATION");
  const runoffFractionUnits = nonNegativeAmountV1(dynamics.runoff_fraction, "CAP04_FORECAST_RUNOFF_FRACTION_REQUIRED");
  const drainageCoefficientUnits = nonNegativeAmountV1(dynamics.drainage_coefficient_per_hour, "CAP04_FORECAST_DRAINAGE_COEFFICIENT_REQUIRED");
  if (runoffFractionUnits > 1_000_000n || drainageCoefficientUnits > 1_000_000n) throw new Error("CAP04_FORECAST_FRACTION_OUT_OF_RANGE");
  const rainfallRelativeStddevUnits = nonNegativeAmountV1(uncertainty.rainfall_relative_stddev, "CAP04_FORECAST_RAINFALL_STDDEV_REQUIRED");
  const cropEtRelativeStddevUnits = nonNegativeAmountV1(uncertainty.crop_et_relative_stddev, "CAP04_FORECAST_CROP_ET_STDDEV_REQUIRED");
  const structuralStddevUnits = nonNegativeAmountV1(uncertainty.structural_process_stddev_mm_per_hour, "CAP04_FORECAST_STRUCTURAL_STDDEV_REQUIRED");
  if (structuralStddevUnits === 0n) throw new Error("CAP04_FORECAST_STRUCTURAL_STDDEV_ZERO_FORBIDDEN");
  const structuralVarianceUnits = squareScale6ToScale12V1(structuralStddevUnits);
  const z196Units = parseFixedDecimalV1("1.960000", WATER_AMOUNT_SCALE_V1);
  const availableDenominatorUnits = fieldCapacityUnits - wiltingStorageUnits;
  const formatAmount = (value: bigint): string => formatFixedDecimalV1(value, WATER_AMOUNT_SCALE_V1);
  const formatVariance = (value: bigint): string => formatFixedDecimalV1(value, WATER_VARIANCE_SCALE_V1);

  const points: Cap04ForecastPointV1[] = [];
  const pointTraces: Cap04ForecastMathPointTraceV1[] = [];
  let totalPrecipitationUnits = 0n;
  let totalCropEtUnits = 0n;
  let totalRunoffUnits = 0n;
  let totalDrainageUnits = 0n;
  let totalOverflowUnits = 0n;
  let minimumAwfUnits = 1_000_000n;

  for (const forcing of input.forcing_window.points) {
    const grossPrecipitationUnits = nonNegativeAmountV1(forcing.precipitation_assumption_mm, "CAP04_FORECAST_PRECIPITATION_REQUIRED");
    const referenceEt0Units = nonNegativeAmountV1(forcing.et0_assumption_mm, "CAP04_FORECAST_ET0_REQUIRED");
    const kcUnits = nonNegativeAmountV1(forcing.kc, "CAP04_FORECAST_KC_REQUIRED");
    const surfaceRunoffUnits = multiplyFixedUnitsV1(grossPrecipitationUnits, 6, runoffFractionUnits, 6, 6);
    const effectivePrecipitationUnits = grossPrecipitationUnits - surfaceRunoffUnits;
    const requestedCropEtUnits = multiplyFixedUnitsV1(referenceEt0Units, 6, kcUnits, 6, 6);
    const waterBeforeEtUnits = previousStorageUnits + effectivePrecipitationUnits;
    const actualCropEtUnits = requestedCropEtUnits < waterBeforeEtUnits ? requestedCropEtUnits : waterBeforeEtUnits;
    const unmetCropEtUnits = requestedCropEtUnits - actualCropEtUnits;
    const storageBeforeDrainageUnits = waterBeforeEtUnits - actualCropEtUnits;
    const excessAboveFieldCapacityUnits = storageBeforeDrainageUnits > fieldCapacityUnits ? storageBeforeDrainageUnits - fieldCapacityUnits : 0n;
    const drainageUnits = multiplyFixedUnitsV1(excessAboveFieldCapacityUnits, 6, drainageCoefficientUnits, 6, 6);
    const preBoundStorageUnits = storageBeforeDrainageUnits - drainageUnits;
    const lowerBoundApplied = preBoundStorageUnits < 0n;
    const upperBoundApplied = preBoundStorageUnits > saturationStorageUnits;
    const postBoundStorageUnits = clampFixedUnitsV1(preBoundStorageUnits, 0n, saturationStorageUnits);
    const overflowUnits = preBoundStorageUnits > saturationStorageUnits ? preBoundStorageUnits - saturationStorageUnits : 0n;
    const massBalanceLeft = previousStorageUnits + grossPrecipitationUnits;
    const massBalanceRight = postBoundStorageUnits + surfaceRunoffUnits + actualCropEtUnits + drainageUnits + overflowUnits;
    if (massBalanceLeft !== massBalanceRight) throw new Error(`CAP04_FORECAST_MASS_BALANCE_NOT_CLOSED:${formatAmount(massBalanceLeft - massBalanceRight)}`);

    const rainfallVarianceUnits = relativeVarianceV1(grossPrecipitationUnits, rainfallRelativeStddevUnits);
    const cropEtVarianceUnits = relativeVarianceV1(requestedCropEtUnits, cropEtRelativeStddevUnits);
    const nextVarianceUnits = previousVarianceUnits + rainfallVarianceUnits + cropEtVarianceUnits + structuralVarianceUnits;
    if (nextVarianceUnits <= previousVarianceUnits) throw new Error("CAP04_FORECAST_VARIANCE_MUST_INCREASE");
    const storageStddevUnits = sqrtScale12ToScale6V1(nextVarianceUnits);
    const intervalMarginUnits = multiplyFixedUnitsV1(storageStddevUnits, 6, z196Units, 6, 6);
    const rawIntervalLowerUnits = postBoundStorageUnits - intervalMarginUnits;
    const rawIntervalUpperUnits = postBoundStorageUnits + intervalMarginUnits;
    const emittedIntervalLowerUnits = clampFixedUnitsV1(rawIntervalLowerUnits, 0n, saturationStorageUnits);
    const emittedIntervalUpperUnits = clampFixedUnitsV1(rawIntervalUpperUnits, 0n, saturationStorageUnits);

    const rawAwfUnitsScale12 = divideFixedUnitsV1(postBoundStorageUnits - wiltingStorageUnits, 6, availableDenominatorUnits, 6, 12);
    const clampedAwfUnitsScale12 = clampFixedUnitsV1(rawAwfUnitsScale12, 0n, 1_000_000_000_000n);
    const publishedAwfUnits = rescaleFixedUnitsV1(clampedAwfUnitsScale12, 12, 6);
    const depletionUnits = fieldCapacityUnits > postBoundStorageUnits ? fieldCapacityUnits - postBoundStorageUnits : 0n;
    const publishedVarianceUnits = rescaleFixedUnitsV1(nextVarianceUnits, 12, 6);

    const point: Cap04ForecastPointV1 = {
      horizon_hour: forcing.horizon_hour,
      interval_start: forcing.interval_start,
      interval_end: forcing.interval_end,
      target_time: forcing.target_time,
      previous_storage_mm: formatAmount(previousStorageUnits),
      gross_precipitation_assumption_mm: formatAmount(grossPrecipitationUnits),
      surface_runoff_mm: formatAmount(surfaceRunoffUnits),
      effective_precipitation_mm: formatAmount(effectivePrecipitationUnits),
      assumed_irrigation_mm: "0.000000",
      reference_et0_mm: formatAmount(referenceEt0Units),
      crop_stage_code: forcing.crop_stage_code,
      kc: formatAmount(kcUnits),
      requested_crop_et_mm: formatAmount(requestedCropEtUnits),
      actual_crop_et_mm: formatAmount(actualCropEtUnits),
      unmet_crop_et_mm: formatAmount(unmetCropEtUnits),
      drainage_mm: formatAmount(drainageUnits),
      saturation_overflow_mm: formatAmount(overflowUnits),
      storage_mean_mm: formatAmount(postBoundStorageUnits),
      storage_variance_mm2: formatAmount(publishedVarianceUnits),
      storage_interval_unclipped_lower_mm: formatAmount(rawIntervalLowerUnits),
      storage_interval_unclipped_upper_mm: formatAmount(rawIntervalUpperUnits),
      storage_interval_emitted_lower_mm: formatAmount(emittedIntervalLowerUnits),
      storage_interval_emitted_upper_mm: formatAmount(emittedIntervalUpperUnits),
      available_water_fraction: formatAmount(publishedAwfUnits),
      depletion_from_field_capacity_mm: formatAmount(depletionUnits),
      mass_balance_error_mm: "0.000000",
      determinism_hash: "",
    };
    const traceWithoutHash: Omit<Cap04ForecastMathPointTraceV1, "point_semantic_hash"> = {
      horizon_hour: forcing.horizon_hour,
      previous_storage_variance_mm2_decimal: formatVariance(previousVarianceUnits),
      rainfall_variance_mm2_decimal: formatVariance(rainfallVarianceUnits),
      crop_et_variance_mm2_decimal: formatVariance(cropEtVarianceUnits),
      baseline_irrigation_variance_mm2_decimal: "0.000000000000",
      structural_variance_mm2_decimal: formatVariance(structuralVarianceUnits),
      storage_variance_mm2_decimal: formatVariance(nextVarianceUnits),
      storage_stddev_mm: formatAmount(storageStddevUnits),
      pre_bound_storage_mm: formatAmount(preBoundStorageUnits),
      post_bound_storage_mm: formatAmount(postBoundStorageUnits),
      lower_bound_applied: lowerBoundApplied,
      upper_bound_applied: upperBoundApplied,
      overflow_mm: formatAmount(overflowUnits),
      physical_bound_applied: lowerBoundApplied || upperBoundApplied,
      lower_interval_bound_applied: rawIntervalLowerUnits !== emittedIntervalLowerUnits,
      upper_interval_bound_applied: rawIntervalUpperUnits !== emittedIntervalUpperUnits,
      latent_variance_reduced_by_clipping: false,
      interval_semantics: CAP04_FORECAST_INTERVAL_SEMANTICS_V1,
    };
    const pointHashBasis = { ...point } as Partial<Cap04ForecastPointV1>;
    delete pointHashBasis.determinism_hash;
    point.determinism_hash = semanticHashV1({ point: pointHashBasis, computation_trace: traceWithoutHash });
    points.push(point);
    pointTraces.push({ ...traceWithoutHash, point_semantic_hash: point.determinism_hash });

    totalPrecipitationUnits += grossPrecipitationUnits;
    totalCropEtUnits += actualCropEtUnits;
    totalRunoffUnits += surfaceRunoffUnits;
    totalDrainageUnits += drainageUnits;
    totalOverflowUnits += overflowUnits;
    if (publishedAwfUnits < minimumAwfUnits) minimumAwfUnits = publishedAwfUnits;
    previousStorageUnits = postBoundStorageUnits;
    previousVarianceUnits = nextVarianceUnits;
  }

  const limitations = sortedUniqueV1([
    "CONTROLLED_SYNTHETIC",
    "NO_CALIBRATED_FORECAST_PROBABILITY",
    "NO_NEW_IRRIGATION_ASSUMPTION",
    "NO_OBSERVATION_UPDATE_APPLIED",
    "NORMALITY_NOT_FIELD_VALIDATED",
    "NOT_DECISION",
    "NOT_FIELD_CALIBRATED",
    "NOT_RECOMMENDATION",
    "WEATHER_ENSEMBLE_UNCERTAINTY_NOT_MODELED",
  ]);
  const forecastPayload: Cap04ForecastRunPayloadV1 = {
    status: "COMPLETED",
    issued_at: issuedAt,
    source_posterior_ref: sourcePosteriorRef,
    source_posterior_hash: sourcePosteriorHash,
    runtime_config_ref: runtimeConfigRef,
    runtime_config_hash: runtimeConfigHash,
    baseline_assumption: CAP04_FORECAST_BASELINE_ASSUMPTION_V1,
    points,
    reason_codes: [],
    scenario_eligible: true,
    forcing_window_hash: input.forcing_window.forcing_window_hash,
    forcing_cycle_key: input.forcing_window.forcing_cycle_key,
    weather_snapshot_ref: input.forcing_window.weather_snapshot_ref,
    weather_snapshot_hash: input.forcing_window.weather_snapshot_hash,
    et0_snapshot_ref: input.forcing_window.et0_snapshot_ref,
    et0_snapshot_hash: input.forcing_window.et0_snapshot_hash,
    crop_stage_context_ref: input.forcing_window.crop_stage_context_ref,
    crop_stage_context_hash: input.forcing_window.crop_stage_context_hash,
    future_forcing_pair_policy_id: input.forcing_window.future_forcing_pair_policy_id,
    future_forcing_policy_id: input.forcing_window.future_forcing_policy_id,
    future_forcing_fallback_policy_id: input.forcing_window.future_forcing_fallback_policy_id,
    forecast_method_id: CAP04_FORECAST_METHOD_ID_V1,
    forecast_method_version: CAP04_FORECAST_METHOD_VERSION_V1,
    uncertainty_propagation_method_id: CAP04_UNCERTAINTY_PROPAGATION_METHOD_ID_V1,
    forecast_interval_method_id: CAP04_FORECAST_INTERVAL_METHOD_ID_V1,
    limitations,
  };
  const resultWithoutHash: Omit<Cap04Pure72hForecastMathResultV1, "forecast_math_hash"> = {
    schema_version: "geox_mcft_cap_04_pure_72h_forecast_math_result_v1",
    contract_id: CAP04_PURE_FORECAST_MATH_CONTRACT_ID_V1,
    forecast_payload: forecastPayload,
    point_traces: pointTraces,
    trajectory_hash: computeCap04ForecastTrajectoryHashV1(points),
    aggregates: {
      final_storage_mm: points[71].storage_mean_mm,
      minimum_available_water_fraction: formatAmount(minimumAwfUnits),
      total_precipitation_mm: formatAmount(totalPrecipitationUnits),
      total_crop_et_mm: formatAmount(totalCropEtUnits),
      total_irrigation_mm: "0.000000",
      total_runoff_mm: formatAmount(totalRunoffUnits),
      total_drainage_mm: formatAmount(totalDrainageUnits),
      total_overflow_mm: formatAmount(totalOverflowUnits),
    },
    uncertainty_basis: {
      method_id: "ADDITIVE_STORAGE_VARIANCE_ZERO_COVARIANCE_V1",
      interval_method_id: "NORMAL_95_PERCENT_Z_1_96_V1",
      interval_semantics: CAP04_FORECAST_INTERVAL_SEMANTICS_V1,
      source_posterior_storage_variance_authority: "COMPUTATION_BASIS_STORAGE_VARIANCE_MM2_DECIMAL",
      physical_clipping_reduces_latent_variance: false,
    },
    limitations,
  };
  const result: Cap04Pure72hForecastMathResultV1 = {
    ...resultWithoutHash,
    forecast_math_hash: computeCap04ForecastMathHashV1(resultWithoutHash),
  };
  validateCap04Pure72hForecastMathResultV1(result);
  return result;
}
