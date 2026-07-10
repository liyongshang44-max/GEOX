// apps/server/src/domain/soil_water/hourly_water_balance_v1.ts
// Purpose: execute the transparent deterministic MCFT-CAP-02 single-zone hourly water-balance propagation from explicit fixed-point inputs.
// Boundary: pure domain Dynamics only; no Evidence selection, persistence, Runtime orchestration, observation assimilation, Forecast success, recommendation, or action.

import {
  validateContinuationRuntimeConfigPayloadV1,
  type ContinuationRuntimeConfigPayloadV1,
} from "../twin_runtime/continuation_runtime_config_v1.js";
import {
  buildAdditiveProcessUncertaintyBudgetV1,
  type AdditiveProcessUncertaintyBudgetV1,
  type PreviousStorageVarianceBasisV1,
} from "./additive_process_uncertainty_budget_v1.js";
import {
  aggregateExecutedIrrigationV1,
  type ExecutedIrrigationAggregationV1,
} from "./executed_irrigation_input_v1.js";
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
} from "./fixed_point_water_decimal_v1.js";
import {
  buildWaterMassBalanceTraceV1,
  type WaterMassBalanceTraceV1,
} from "./water_mass_balance_trace_v1.js";

export const HOURLY_WATER_BALANCE_MODEL_ID_V1 = "ROOT_ZONE_HOURLY_WATER_BALANCE_V1" as const;
export const HOURLY_WATER_BALANCE_SCHEMA_V1 = "mcft_cap_02_hourly_water_balance_result_v1" as const;

export type HourlyWaterBalanceConfigV1 = {
  root_zone_depth_mm: string;
  wilting_point_storage_mm: string;
  field_capacity_storage_mm: string;
  saturation_storage_mm: string;
  saturation_fraction: string;
  runoff_fraction: string;
  drainage_coefficient_per_hour: string;
  structural_process_stddev_mm_per_hour: string;
  rainfall_relative_stddev: string;
  crop_et_relative_stddev: string;
  executed_irrigation_relative_stddev: string;
};

export type HourlyWaterBalanceInputV1 = {
  interval_start_exclusive: string;
  interval_end_inclusive: string;
  previous_storage_mm_decimal: string;
  previous_variance_basis: PreviousStorageVarianceBasisV1;
  gross_rainfall_mm_decimal: string;
  historical_et0_mm_decimal: string;
  crop_stage_code: string;
  kc_decimal: string;
  executed_irrigation_candidates: unknown[];
  config: HourlyWaterBalanceConfigV1;
};

export type HourlyWaterBalanceResultV1 = {
  schema_version: typeof HOURLY_WATER_BALANCE_SCHEMA_V1;
  model_id: typeof HOURLY_WATER_BALANCE_MODEL_ID_V1;
  model_version: 1;
  step_duration: "PT1H";
  truth_class: "CONTROLLED_SYNTHETIC";
  calibration_status: "NOT_FIELD_CALIBRATED";
  mass_balance_trace: WaterMassBalanceTraceV1;
  mass_balance_trace_hash: string;
  irrigation_aggregation: ExecutedIrrigationAggregationV1;
  uncertainty_budget: AdditiveProcessUncertaintyBudgetV1;
  computation_basis: {
    basis_origin: PreviousStorageVarianceBasisV1["basis_origin"];
    previous_storage_mean_mm_decimal: { value: string; scale: 6 };
    previous_storage_variance_mm2_decimal: { value: string; scale: 12 };
    storage_mean_mm_decimal: { value: string; scale: 6 };
    storage_variance_mm2_decimal: { value: string; scale: 12 };
    source_posterior_ref?: string;
    source_vwc_variance?: string;
    root_zone_depth_mm?: "300.000000";
    previous_state_ref?: string;
  };
  published_state: {
    root_zone_storage_mm: {
      mean: string;
      stddev: string;
    };
    root_zone_vwc_fraction: {
      mean: string;
      variance: string;
      stddev: string;
    };
    available_water_fraction: string;
    available_water_fraction_trace: {
      raw_value: string;
      lower_bound: "0.000000";
      upper_bound: "1.000000";
      clipping_applied: boolean;
      published_value: string;
      rounding_rule: "DECIMAL_HALF_AWAY_FROM_ZERO_V1";
    };
    depletion_from_field_capacity_mm: string;
    confidence_interval: AdditiveProcessUncertaintyBudgetV1["interval"];
  };
  limitations: readonly [
    "CONTROLLED_SYNTHETIC",
    "NOT_FIELD_CALIBRATED",
    "NO_OBSERVATION_UPDATE_APPLIED",
    "NO_SPATIAL_EXECUTION_OVERLAP_DEDUPLICATION"
  ];
};

function decimalFromConfigNumberV1(value: unknown, scale: number, code: string): string {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(code);
  return normalizeFixedDecimalV1(String(value), scale, code);
}

export function buildHourlyWaterBalanceConfigFromContinuationRuntimeConfigV1(
  payload: unknown,
): HourlyWaterBalanceConfigV1 {
  validateContinuationRuntimeConfigPayloadV1(payload);
  const config = payload as ContinuationRuntimeConfigPayloadV1;
  return {
    root_zone_depth_mm: decimalFromConfigNumberV1(config.soil_hydraulic_snapshot.root_zone_depth_mm, 6, "DYNAMICS_ROOT_DEPTH_CONFIG_INVALID"),
    wilting_point_storage_mm: decimalFromConfigNumberV1(config.soil_hydraulic_snapshot.wilting_point_storage_mm, 6, "DYNAMICS_WILTING_STORAGE_CONFIG_INVALID"),
    field_capacity_storage_mm: decimalFromConfigNumberV1(config.soil_hydraulic_snapshot.field_capacity_storage_mm, 6, "DYNAMICS_FIELD_CAPACITY_CONFIG_INVALID"),
    saturation_storage_mm: decimalFromConfigNumberV1(config.soil_hydraulic_snapshot.saturation_storage_mm, 6, "DYNAMICS_SATURATION_STORAGE_CONFIG_INVALID"),
    saturation_fraction: decimalFromConfigNumberV1(config.soil_hydraulic_snapshot.saturation_fraction, 6, "DYNAMICS_SATURATION_FRACTION_CONFIG_INVALID"),
    runoff_fraction: decimalFromConfigNumberV1(config.dynamics_parameters.runoff_fraction, 6, "DYNAMICS_RUNOFF_CONFIG_INVALID"),
    drainage_coefficient_per_hour: decimalFromConfigNumberV1(config.dynamics_parameters.drainage_coefficient_per_hour, 6, "DYNAMICS_DRAINAGE_CONFIG_INVALID"),
    structural_process_stddev_mm_per_hour: decimalFromConfigNumberV1(config.process_uncertainty.structural_process_stddev_mm_per_hour, 6, "DYNAMICS_STRUCTURAL_STDDEV_CONFIG_INVALID"),
    rainfall_relative_stddev: decimalFromConfigNumberV1(config.process_uncertainty.rainfall_relative_stddev, 6, "DYNAMICS_RAINFALL_STDDEV_CONFIG_INVALID"),
    crop_et_relative_stddev: decimalFromConfigNumberV1(config.process_uncertainty.crop_et_relative_stddev, 6, "DYNAMICS_CROP_ET_STDDEV_CONFIG_INVALID"),
    executed_irrigation_relative_stddev: decimalFromConfigNumberV1(config.process_uncertainty.executed_irrigation_relative_stddev, 6, "DYNAMICS_IRRIGATION_STDDEV_CONFIG_INVALID"),
  };
}

function requireCropStageCodeV1(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) throw new Error("DYNAMICS_CROP_STAGE_CODE_REQUIRED");
  return value;
}

export function executeHourlyWaterBalanceV1(input: HourlyWaterBalanceInputV1): HourlyWaterBalanceResultV1 {
  const previousStorageUnits = requireNonNegativeFixedUnitsV1(
    parseFixedDecimalV1(input.previous_storage_mm_decimal, WATER_AMOUNT_SCALE_V1, "DYNAMICS_PREVIOUS_STORAGE_REQUIRED"),
    "DYNAMICS_PREVIOUS_STORAGE_NEGATIVE",
  );
  const grossRainfallUnits = requireNonNegativeFixedUnitsV1(
    parseFixedDecimalV1(input.gross_rainfall_mm_decimal, WATER_AMOUNT_SCALE_V1, "DYNAMICS_RAINFALL_REQUIRED"),
    "DYNAMICS_RAINFALL_NEGATIVE",
  );
  const referenceEt0Units = requireNonNegativeFixedUnitsV1(
    parseFixedDecimalV1(input.historical_et0_mm_decimal, WATER_AMOUNT_SCALE_V1, "DYNAMICS_ET0_REQUIRED"),
    "DYNAMICS_ET0_NEGATIVE",
  );
  const kcUnits = requireNonNegativeFixedUnitsV1(
    parseFixedDecimalV1(input.kc_decimal, WATER_AMOUNT_SCALE_V1, "DYNAMICS_KC_REQUIRED"),
    "DYNAMICS_KC_NEGATIVE",
  );
  const rootDepthUnits = requireNonNegativeFixedUnitsV1(
    parseFixedDecimalV1(input.config.root_zone_depth_mm, WATER_AMOUNT_SCALE_V1, "DYNAMICS_ROOT_DEPTH_REQUIRED"),
    "DYNAMICS_ROOT_DEPTH_NEGATIVE",
  );
  if (rootDepthUnits !== 300_000_000n) throw new Error("DYNAMICS_GOVERNED_ROOT_DEPTH_MUST_BE_300MM");
  const wiltingStorageUnits = requireNonNegativeFixedUnitsV1(
    parseFixedDecimalV1(input.config.wilting_point_storage_mm, WATER_AMOUNT_SCALE_V1, "DYNAMICS_WILTING_STORAGE_REQUIRED"),
    "DYNAMICS_WILTING_STORAGE_NEGATIVE",
  );
  const fieldCapacityUnits = requireNonNegativeFixedUnitsV1(
    parseFixedDecimalV1(input.config.field_capacity_storage_mm, WATER_AMOUNT_SCALE_V1, "DYNAMICS_FIELD_CAPACITY_REQUIRED"),
    "DYNAMICS_FIELD_CAPACITY_NEGATIVE",
  );
  const saturationStorageUnits = requireNonNegativeFixedUnitsV1(
    parseFixedDecimalV1(input.config.saturation_storage_mm, WATER_AMOUNT_SCALE_V1, "DYNAMICS_SATURATION_STORAGE_REQUIRED"),
    "DYNAMICS_SATURATION_STORAGE_NEGATIVE",
  );
  if (!(wiltingStorageUnits < fieldCapacityUnits && fieldCapacityUnits < saturationStorageUnits)) {
    throw new Error("DYNAMICS_HYDRAULIC_STORAGE_ORDER_INVALID");
  }
  if (previousStorageUnits > saturationStorageUnits) throw new Error("DYNAMICS_PREVIOUS_STORAGE_ABOVE_SATURATION");

  const runoffFractionUnits = parseFixedDecimalV1(input.config.runoff_fraction, WATER_AMOUNT_SCALE_V1, "DYNAMICS_RUNOFF_FRACTION_REQUIRED");
  if (runoffFractionUnits < 0n || runoffFractionUnits > 1_000_000n) throw new Error("DYNAMICS_RUNOFF_FRACTION_OUT_OF_RANGE");
  const drainageCoefficientUnits = parseFixedDecimalV1(input.config.drainage_coefficient_per_hour, WATER_AMOUNT_SCALE_V1, "DYNAMICS_DRAINAGE_COEFFICIENT_REQUIRED");
  if (drainageCoefficientUnits < 0n || drainageCoefficientUnits > 1_000_000n) throw new Error("DYNAMICS_DRAINAGE_COEFFICIENT_OUT_OF_RANGE");

  const irrigation = aggregateExecutedIrrigationV1({
    candidates: input.executed_irrigation_candidates,
    interval_start_exclusive: input.interval_start_exclusive,
    interval_end_inclusive: input.interval_end_inclusive,
  });
  const effectiveIrrigationUnits = parseFixedDecimalV1(irrigation.effective_irrigation_mm, WATER_AMOUNT_SCALE_V1);
  const surfaceRunoffUnits = multiplyFixedUnitsV1(
    grossRainfallUnits,
    WATER_AMOUNT_SCALE_V1,
    runoffFractionUnits,
    WATER_AMOUNT_SCALE_V1,
    WATER_AMOUNT_SCALE_V1,
  );
  const effectiveRainfallUnits = grossRainfallUnits - surfaceRunoffUnits;
  const requestedCropEtUnits = multiplyFixedUnitsV1(
    referenceEt0Units,
    WATER_AMOUNT_SCALE_V1,
    kcUnits,
    WATER_AMOUNT_SCALE_V1,
    WATER_AMOUNT_SCALE_V1,
  );
  const waterBeforeEtUnits = previousStorageUnits + effectiveRainfallUnits + effectiveIrrigationUnits;
  const actualCropEtUnits = requestedCropEtUnits < waterBeforeEtUnits ? requestedCropEtUnits : waterBeforeEtUnits;
  const unmetCropEtUnits = requestedCropEtUnits - actualCropEtUnits;
  const storageBeforeDrainageUnits = waterBeforeEtUnits - actualCropEtUnits;
  const excessAboveFieldCapacityUnits = storageBeforeDrainageUnits > fieldCapacityUnits
    ? storageBeforeDrainageUnits - fieldCapacityUnits
    : 0n;
  const drainageUnits = multiplyFixedUnitsV1(
    excessAboveFieldCapacityUnits,
    WATER_AMOUNT_SCALE_V1,
    drainageCoefficientUnits,
    WATER_AMOUNT_SCALE_V1,
    WATER_AMOUNT_SCALE_V1,
  );
  const storageAfterDrainageUnits = storageBeforeDrainageUnits - drainageUnits;
  const saturationOverflowUnits = storageAfterDrainageUnits > saturationStorageUnits
    ? storageAfterDrainageUnits - saturationStorageUnits
    : 0n;
  const nextStorageUnits = storageAfterDrainageUnits - saturationOverflowUnits;
  if (nextStorageUnits < 0n || nextStorageUnits > saturationStorageUnits) throw new Error("DYNAMICS_NEXT_STORAGE_OUT_OF_BOUNDS");

  const formatAmount = (value: bigint) => formatFixedDecimalV1(value, WATER_AMOUNT_SCALE_V1);
  const traceResult = buildWaterMassBalanceTraceV1({
    previous_storage_mm: formatAmount(previousStorageUnits),
    gross_rainfall_mm: formatAmount(grossRainfallUnits),
    surface_runoff_mm: formatAmount(surfaceRunoffUnits),
    effective_rainfall_mm: formatAmount(effectiveRainfallUnits),
    execution_events: irrigation.selected_events,
    effective_irrigation_mm: formatAmount(effectiveIrrigationUnits),
    reference_et0_mm: formatAmount(referenceEt0Units),
    crop_stage_code: requireCropStageCodeV1(input.crop_stage_code),
    kc: formatAmount(kcUnits),
    requested_crop_et_mm: formatAmount(requestedCropEtUnits),
    actual_crop_et_mm: formatAmount(actualCropEtUnits),
    unmet_crop_et_mm: formatAmount(unmetCropEtUnits),
    storage_before_drainage_mm: formatAmount(storageBeforeDrainageUnits),
    drainage_mm: formatAmount(drainageUnits),
    storage_after_drainage_mm: formatAmount(storageAfterDrainageUnits),
    saturation_overflow_mm: formatAmount(saturationOverflowUnits),
    next_storage_mm: formatAmount(nextStorageUnits),
  });

  const uncertainty = buildAdditiveProcessUncertaintyBudgetV1({
    previous_variance_basis: input.previous_variance_basis,
    root_zone_depth_mm: input.config.root_zone_depth_mm,
    saturation_fraction: input.config.saturation_fraction,
    next_storage_mean_mm: formatAmount(nextStorageUnits),
    gross_rainfall_mm: formatAmount(grossRainfallUnits),
    requested_crop_et_mm: formatAmount(requestedCropEtUnits),
    effective_irrigation_mm: formatAmount(effectiveIrrigationUnits),
    rainfall_relative_stddev: input.config.rainfall_relative_stddev,
    crop_et_relative_stddev: input.config.crop_et_relative_stddev,
    executed_irrigation_relative_stddev: input.config.executed_irrigation_relative_stddev,
    structural_process_stddev_mm_per_hour: input.config.structural_process_stddev_mm_per_hour,
  });
  const nextVarianceUnits = parseFixedDecimalV1(uncertainty.next_storage_variance_mm2, WATER_VARIANCE_SCALE_V1);
  const previousVarianceUnits = parseFixedDecimalV1(uncertainty.previous_storage_variance_mm2, WATER_VARIANCE_SCALE_V1);
  const vwcMeanUnits = divideFixedUnitsV1(
    nextStorageUnits,
    WATER_AMOUNT_SCALE_V1,
    rootDepthUnits,
    WATER_AMOUNT_SCALE_V1,
    WATER_AMOUNT_SCALE_V1,
  );

  const availableNumeratorUnits = nextStorageUnits - wiltingStorageUnits;
  const availableDenominatorUnits = fieldCapacityUnits - wiltingStorageUnits;
  const rawAvailableWaterUnitsScale12 = divideFixedUnitsV1(
    availableNumeratorUnits,
    WATER_AMOUNT_SCALE_V1,
    availableDenominatorUnits,
    WATER_AMOUNT_SCALE_V1,
    WATER_VARIANCE_SCALE_V1,
  );
  const clampedAvailableWaterUnitsScale12 = clampFixedUnitsV1(
    rawAvailableWaterUnitsScale12,
    0n,
    1_000_000_000_000n,
  );
  const publishedAvailableWaterUnits = rescaleFixedUnitsV1(
    clampedAvailableWaterUnitsScale12,
    WATER_VARIANCE_SCALE_V1,
    WATER_AMOUNT_SCALE_V1,
  );
  const depletionUnits = fieldCapacityUnits > nextStorageUnits ? fieldCapacityUnits - nextStorageUnits : 0n;

  const computationBasis: HourlyWaterBalanceResultV1["computation_basis"] = {
    basis_origin: input.previous_variance_basis.basis_origin,
    previous_storage_mean_mm_decimal: { value: formatAmount(previousStorageUnits), scale: 6 },
    previous_storage_variance_mm2_decimal: {
      value: formatFixedDecimalV1(previousVarianceUnits, WATER_VARIANCE_SCALE_V1),
      scale: 12,
    },
    storage_mean_mm_decimal: { value: formatAmount(nextStorageUnits), scale: 6 },
    storage_variance_mm2_decimal: {
      value: formatFixedDecimalV1(nextVarianceUnits, WATER_VARIANCE_SCALE_V1),
      scale: 12,
    },
  };
  if (input.previous_variance_basis.basis_origin === "DERIVED_FROM_MCFT_CAP_01_POSTERIOR_V1") {
    computationBasis.source_posterior_ref = input.previous_variance_basis.source_posterior_ref;
    computationBasis.source_vwc_variance = normalizeFixedDecimalV1(
      input.previous_variance_basis.source_vwc_variance,
      WATER_VARIANCE_SCALE_V1,
    );
    computationBasis.root_zone_depth_mm = "300.000000";
  } else {
    computationBasis.previous_state_ref = input.previous_variance_basis.previous_state_ref;
  }

  return {
    schema_version: HOURLY_WATER_BALANCE_SCHEMA_V1,
    model_id: HOURLY_WATER_BALANCE_MODEL_ID_V1,
    model_version: 1,
    step_duration: "PT1H",
    truth_class: "CONTROLLED_SYNTHETIC",
    calibration_status: "NOT_FIELD_CALIBRATED",
    mass_balance_trace: traceResult.trace,
    mass_balance_trace_hash: traceResult.mass_balance_trace_hash,
    irrigation_aggregation: irrigation,
    uncertainty_budget: uncertainty,
    computation_basis: computationBasis,
    published_state: {
      root_zone_storage_mm: {
        mean: formatAmount(nextStorageUnits),
        stddev: uncertainty.next_storage_stddev_mm,
      },
      root_zone_vwc_fraction: {
        mean: formatAmount(vwcMeanUnits),
        variance: uncertainty.next_vwc_variance,
        stddev: uncertainty.next_vwc_stddev,
      },
      available_water_fraction: formatAmount(publishedAvailableWaterUnits),
      available_water_fraction_trace: {
        raw_value: formatFixedDecimalV1(rawAvailableWaterUnitsScale12, WATER_VARIANCE_SCALE_V1),
        lower_bound: "0.000000",
        upper_bound: "1.000000",
        clipping_applied: rawAvailableWaterUnitsScale12 !== clampedAvailableWaterUnitsScale12,
        published_value: formatAmount(publishedAvailableWaterUnits),
        rounding_rule: "DECIMAL_HALF_AWAY_FROM_ZERO_V1",
      },
      depletion_from_field_capacity_mm: formatAmount(depletionUnits),
      confidence_interval: uncertainty.interval,
    },
    limitations: [
      "CONTROLLED_SYNTHETIC",
      "NOT_FIELD_CALIBRATED",
      "NO_OBSERVATION_UPDATE_APPLIED",
      "NO_SPATIAL_EXECUTION_OVERLAP_DEDUPLICATION",
    ],
  };
}
