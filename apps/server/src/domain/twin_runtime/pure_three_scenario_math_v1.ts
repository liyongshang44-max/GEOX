// apps/server/src/domain/twin_runtime/pure_three_scenario_math_v1.ts
// Purpose: execute the bounded MCFT-CAP-04 S4 three-option Scenario math from one completed source Forecast, its frozen forcing trace, and one pinned Runtime Config.
// Boundary: pure fixed-point Domain math only; no forcing reselection, Evidence reads, action lifecycle reads, persistence, canonical append, migration, projection, route, scheduler, filesystem, network, environment, or wall clock.

import { semanticHashV1 } from "./canonical_identity_v1.js";
import {
  CAP04_B_TRANSACTION_VARIANT_V1,
  CAP04_SCENARIO_OPTION_IDS_V1,
  CAP04_SCENARIO_POLICY_ID_V1,
  CAP04_THREE_SCENARIO_SET_CONTRACT_ID_V1,
  type Cap04ForecastPointV1,
  type Cap04ScenarioDifferenceFromBaselineV1,
  type Cap04ScenarioOptionIdV1,
  type Cap04ScenarioOptionV1,
  type Cap04ScenarioSetEnvelopeV1,
} from "./forecast_scenario_contracts_v1.js";
import {
  validateCap04RuntimeConfigPayloadV1,
  type Cap04RuntimeConfigPayloadV1,
} from "./forecast_scenario_runtime_config_v1.js";
import {
  CAP04_FORECAST_INTERVAL_SEMANTICS_V1,
  validateCap04Pure72hForecastMathResultV1,
  type Cap04Pure72hForecastMathResultV1,
} from "./forecast_math_contracts_v1.js";
import {
  validateCap04ForecastForcingWindowV1,
  type Cap04ForecastForcingWindowV1,
} from "./future_forcing_contracts_v1.js";
import {
  CAP04_PURE_THREE_SCENARIO_MATH_CONTRACT_ID_V1,
  CAP04_SCENARIO_ACTION_COMPLIANCE_LIMITATION_V1,
  computeCap04ScenarioMathHashV1,
  computeCap04ScenarioOptionHashV1,
  computeCap04ScenarioTrajectoryHashV1,
  validateCap04PureThreeScenarioMathResultV1,
  type Cap04PureThreeScenarioMathResultV1,
} from "./scenario_math_contracts_v1.js";
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

export type Cap04PureThreeScenarioMathInputV1 = {
  source_forecast: {
    ref: string;
    hash: string;
    math_result: Cap04Pure72hForecastMathResultV1;
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

function decimal6V1(value: unknown, code: string): string {
  return normalizeFixedDecimalV1(typeof value === "number" ? String(value) : value, WATER_AMOUNT_SCALE_V1, code);
}

function amountUnitsV1(value: unknown, code: string): bigint {
  return requireNonNegativeFixedUnitsV1(parseFixedDecimalV1(decimal6V1(value, code), WATER_AMOUNT_SCALE_V1, code), `${code}_NEGATIVE`);
}

function signedUnitsV1(value: string): bigint {
  return parseFixedDecimalV1(value, WATER_AMOUNT_SCALE_V1);
}

function varianceUnitsV1(value: unknown, code: string): bigint {
  return requireNonNegativeFixedUnitsV1(parseFixedDecimalV1(value, WATER_VARIANCE_SCALE_V1, code), `${code}_NEGATIVE`);
}

function relativeVarianceV1(amountUnits: bigint, relativeStddevUnits: bigint): bigint {
  const stddevUnits = multiplyFixedUnitsV1(amountUnits, 6, relativeStddevUnits, 6, 6);
  return squareScale6ToScale12V1(stddevUnits);
}

function sortedUniqueV1(values: readonly string[]): string[] {
  return [...new Set(values)].sort();
}

function addHoursV1(value: string, hours: number): string {
  return new Date(Date.parse(value) + hours * 3_600_000).toISOString();
}

function formatSignedV1(value: bigint): string {
  return formatFixedDecimalV1(value, WATER_AMOUNT_SCALE_V1);
}

function optionMetricsV1(points: readonly Cap04ForecastPointV1[], thresholdUnits: bigint): {
  minimumAwf: string;
  firstStress: string | null;
  stressHours: number;
  finalStorage: string;
  totalPrecipitation: string;
  totalCropEt: string;
  totalIrrigation: string;
  totalRunoff: string;
  totalDrainage: string;
  totalOverflow: string;
} {
  let minimumAwf = 1_000_000n;
  let firstStress: string | null = null;
  let stressHours = 0;
  let precipitation = 0n;
  let cropEt = 0n;
  let irrigation = 0n;
  let runoff = 0n;
  let drainage = 0n;
  let overflow = 0n;
  for (const point of points) {
    const awf = signedUnitsV1(point.available_water_fraction);
    if (awf < minimumAwf) minimumAwf = awf;
    if (awf < thresholdUnits) {
      stressHours += 1;
      if (firstStress === null) firstStress = point.target_time;
    }
    precipitation += signedUnitsV1(point.gross_precipitation_assumption_mm);
    cropEt += signedUnitsV1(point.actual_crop_et_mm);
    irrigation += signedUnitsV1(point.assumed_irrigation_mm);
    runoff += signedUnitsV1(point.surface_runoff_mm);
    drainage += signedUnitsV1(point.drainage_mm);
    overflow += signedUnitsV1(point.saturation_overflow_mm);
  }
  return {
    minimumAwf: formatSignedV1(minimumAwf),
    firstStress,
    stressHours,
    finalStorage: points[71].storage_mean_mm,
    totalPrecipitation: formatSignedV1(precipitation),
    totalCropEt: formatSignedV1(cropEt),
    totalIrrigation: formatSignedV1(irrigation),
    totalRunoff: formatSignedV1(runoff),
    totalDrainage: formatSignedV1(drainage),
    totalOverflow: formatSignedV1(overflow),
  };
}

function zeroDifferenceV1(): Cap04ScenarioDifferenceFromBaselineV1 {
  return {
    final_storage_delta_mm: "0.000000",
    minimum_awf_delta: "0.000000",
    stress_hour_count_delta: 0,
    total_irrigation_delta_mm: "0.000000",
    total_drainage_delta_mm: "0.000000",
    total_overflow_delta_mm: "0.000000",
  };
}

function differenceV1(option: Cap04ScenarioOptionV1, baseline: Cap04ScenarioOptionV1): Cap04ScenarioDifferenceFromBaselineV1 {
  return {
    final_storage_delta_mm: formatSignedV1(signedUnitsV1(option.final_storage_mm) - signedUnitsV1(baseline.final_storage_mm)),
    minimum_awf_delta: formatSignedV1(signedUnitsV1(option.minimum_available_water_fraction) - signedUnitsV1(baseline.minimum_available_water_fraction)),
    stress_hour_count_delta: option.stress_hour_count - baseline.stress_hour_count,
    total_irrigation_delta_mm: formatSignedV1(signedUnitsV1(option.total_irrigation_mm) - signedUnitsV1(baseline.total_irrigation_mm)),
    total_drainage_delta_mm: formatSignedV1(signedUnitsV1(option.total_drainage_mm) - signedUnitsV1(baseline.total_drainage_mm)),
    total_overflow_delta_mm: formatSignedV1(signedUnitsV1(option.total_overflow_mm) - signedUnitsV1(baseline.total_overflow_mm)),
  };
}

function buildIrrigationTrajectoryV1(input: Cap04PureThreeScenarioMathInputV1, effectiveIrrigationUnits: bigint, optionId: Cap04ScenarioOptionIdV1): Cap04ForecastPointV1[] {
  const source = input.source_forecast.math_result;
  const config = input.runtime_config.payload;
  const hydraulic = config.soil_hydraulic_snapshot;
  const dynamics = config.dynamics_parameters;
  const uncertainty = config.process_uncertainty;
  let previousStorageUnits = amountUnitsV1(source.forecast_payload.points[0].previous_storage_mm, "CAP04_SCENARIO_SOURCE_STORAGE_REQUIRED");
  let previousVarianceUnits = varianceUnitsV1(source.point_traces[0].previous_storage_variance_mm2_decimal, "CAP04_SCENARIO_SOURCE_VARIANCE_REQUIRED");
  const wiltingStorageUnits = amountUnitsV1(hydraulic.wilting_point_storage_mm, "CAP04_SCENARIO_WILTING_STORAGE_REQUIRED");
  const fieldCapacityUnits = amountUnitsV1(hydraulic.field_capacity_storage_mm, "CAP04_SCENARIO_FIELD_CAPACITY_REQUIRED");
  const saturationStorageUnits = amountUnitsV1(hydraulic.saturation_storage_mm, "CAP04_SCENARIO_SATURATION_STORAGE_REQUIRED");
  const runoffFractionUnits = amountUnitsV1(dynamics.runoff_fraction, "CAP04_SCENARIO_RUNOFF_FRACTION_REQUIRED");
  const drainageCoefficientUnits = amountUnitsV1(dynamics.drainage_coefficient_per_hour, "CAP04_SCENARIO_DRAINAGE_COEFFICIENT_REQUIRED");
  const rainfallRelativeStddevUnits = amountUnitsV1(uncertainty.rainfall_relative_stddev, "CAP04_SCENARIO_RAINFALL_STDDEV_REQUIRED");
  const cropEtRelativeStddevUnits = amountUnitsV1(uncertainty.crop_et_relative_stddev, "CAP04_SCENARIO_CROP_ET_STDDEV_REQUIRED");
  const structuralStddevUnits = amountUnitsV1(uncertainty.structural_process_stddev_mm_per_hour, "CAP04_SCENARIO_STRUCTURAL_STDDEV_REQUIRED");
  const structuralVarianceUnits = squareScale6ToScale12V1(structuralStddevUnits);
  const z196Units = parseFixedDecimalV1("1.960000", WATER_AMOUNT_SCALE_V1);
  const availableDenominatorUnits = fieldCapacityUnits - wiltingStorageUnits;
  const formatAmount = (value: bigint): string => formatFixedDecimalV1(value, WATER_AMOUNT_SCALE_V1);
  const formatVariance = (value: bigint): string => formatFixedDecimalV1(value, WATER_VARIANCE_SCALE_V1);
  const points: Cap04ForecastPointV1[] = [];

  for (const forcing of input.forcing_window.points) {
    const irrigationUnits = forcing.horizon_hour === 1 ? effectiveIrrigationUnits : 0n;
    const grossPrecipitationUnits = amountUnitsV1(forcing.precipitation_assumption_mm, "CAP04_SCENARIO_PRECIPITATION_REQUIRED");
    const referenceEt0Units = amountUnitsV1(forcing.et0_assumption_mm, "CAP04_SCENARIO_ET0_REQUIRED");
    const kcUnits = amountUnitsV1(forcing.kc, "CAP04_SCENARIO_KC_REQUIRED");
    const surfaceRunoffUnits = multiplyFixedUnitsV1(grossPrecipitationUnits, 6, runoffFractionUnits, 6, 6);
    const effectivePrecipitationUnits = grossPrecipitationUnits - surfaceRunoffUnits;
    const requestedCropEtUnits = multiplyFixedUnitsV1(referenceEt0Units, 6, kcUnits, 6, 6);
    const waterBeforeEtUnits = previousStorageUnits + effectivePrecipitationUnits + irrigationUnits;
    const actualCropEtUnits = requestedCropEtUnits < waterBeforeEtUnits ? requestedCropEtUnits : waterBeforeEtUnits;
    const unmetCropEtUnits = requestedCropEtUnits - actualCropEtUnits;
    const storageBeforeDrainageUnits = waterBeforeEtUnits - actualCropEtUnits;
    const excessAboveFieldCapacityUnits = storageBeforeDrainageUnits > fieldCapacityUnits ? storageBeforeDrainageUnits - fieldCapacityUnits : 0n;
    const drainageUnits = multiplyFixedUnitsV1(excessAboveFieldCapacityUnits, 6, drainageCoefficientUnits, 6, 6);
    const preBoundStorageUnits = storageBeforeDrainageUnits - drainageUnits;
    const postBoundStorageUnits = clampFixedUnitsV1(preBoundStorageUnits, 0n, saturationStorageUnits);
    const overflowUnits = preBoundStorageUnits > saturationStorageUnits ? preBoundStorageUnits - saturationStorageUnits : 0n;
    const massBalanceLeft = previousStorageUnits + grossPrecipitationUnits + irrigationUnits;
    const massBalanceRight = postBoundStorageUnits + surfaceRunoffUnits + actualCropEtUnits + drainageUnits + overflowUnits;
    if (massBalanceLeft !== massBalanceRight) throw new Error(`CAP04_SCENARIO_MASS_BALANCE_NOT_CLOSED:${optionId}`);

    const rainfallVarianceUnits = relativeVarianceV1(grossPrecipitationUnits, rainfallRelativeStddevUnits);
    const cropEtVarianceUnits = relativeVarianceV1(requestedCropEtUnits, cropEtRelativeStddevUnits);
    const nextVarianceUnits = previousVarianceUnits + rainfallVarianceUnits + cropEtVarianceUnits + structuralVarianceUnits;
    const storageStddevUnits = sqrtScale12ToScale6V1(nextVarianceUnits);
    const intervalMarginUnits = multiplyFixedUnitsV1(storageStddevUnits, 6, z196Units, 6, 6);
    const rawIntervalLowerUnits = postBoundStorageUnits - intervalMarginUnits;
    const rawIntervalUpperUnits = postBoundStorageUnits + intervalMarginUnits;
    const emittedIntervalLowerUnits = clampFixedUnitsV1(rawIntervalLowerUnits, 0n, saturationStorageUnits);
    const emittedIntervalUpperUnits = clampFixedUnitsV1(rawIntervalUpperUnits, 0n, saturationStorageUnits);
    const rawAwfUnitsScale12 = divideFixedUnitsV1(postBoundStorageUnits - wiltingStorageUnits, 6, availableDenominatorUnits, 6, 12);
    const publishedAwfUnits = rescaleFixedUnitsV1(clampFixedUnitsV1(rawAwfUnitsScale12, 0n, 1_000_000_000_000n), 12, 6);
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
      assumed_irrigation_mm: formatAmount(irrigationUnits),
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
    const pointHashBasis = { ...point } as Partial<Cap04ForecastPointV1>;
    delete pointHashBasis.determinism_hash;
    point.determinism_hash = semanticHashV1({
      point: pointHashBasis,
      computation_trace: {
        option_id: optionId,
        previous_storage_variance_mm2_decimal: formatVariance(previousVarianceUnits),
        rainfall_variance_mm2_decimal: formatVariance(rainfallVarianceUnits),
        crop_et_variance_mm2_decimal: formatVariance(cropEtVarianceUnits),
        scenario_assumed_irrigation_variance_mm2_decimal: "0.000000000000",
        structural_variance_mm2_decimal: formatVariance(structuralVarianceUnits),
        storage_variance_mm2_decimal: formatVariance(nextVarianceUnits),
        interval_semantics: CAP04_FORECAST_INTERVAL_SEMANTICS_V1,
        latent_variance_reduced_by_clipping: false,
      },
    });
    points.push(point);
    previousStorageUnits = postBoundStorageUnits;
    previousVarianceUnits = nextVarianceUnits;
  }
  return points;
}

export function executeCap04PureThreeScenarioMathV1(input: Cap04PureThreeScenarioMathInputV1): Cap04PureThreeScenarioMathResultV1 {
  validateCap04Pure72hForecastMathResultV1(input.source_forecast.math_result);
  validateCap04RuntimeConfigPayloadV1(input.runtime_config.payload);
  validateCap04ForecastForcingWindowV1(input.forcing_window);
  const sourceForecastRef = requiredStringV1(input.source_forecast.ref, "CAP04_SCENARIO_SOURCE_FORECAST_REF_REQUIRED");
  const sourceForecastHash = requiredStringV1(input.source_forecast.hash, "CAP04_SCENARIO_SOURCE_FORECAST_HASH_REQUIRED");
  const source = input.source_forecast.math_result;
  const forecast = source.forecast_payload;
  const config = input.runtime_config.payload;
  if (forecast.runtime_config_ref !== input.runtime_config.ref || forecast.runtime_config_hash !== input.runtime_config.hash) throw new Error("CAP04_SCENARIO_SOURCE_FORECAST_CONFIG_MISMATCH");
  if (input.forcing_window.runtime_config_ref !== input.runtime_config.ref || input.forcing_window.runtime_config_hash !== input.runtime_config.hash) throw new Error("CAP04_SCENARIO_FORCING_CONFIG_MISMATCH");
  if (forecast.forcing_window_hash !== input.forcing_window.forcing_window_hash || forecast.forcing_cycle_key !== input.forcing_window.forcing_cycle_key) throw new Error("CAP04_SCENARIO_FORCING_TRACE_MISMATCH");
  if (forecast.issued_at !== input.forcing_window.logical_time) throw new Error("CAP04_SCENARIO_LOGICAL_TIME_MISMATCH");
  if (config.scenario_policy_id !== CAP04_SCENARIO_POLICY_ID_V1 || JSON.stringify(config.scenario_option_ids) !== JSON.stringify(CAP04_SCENARIO_OPTION_IDS_V1)) throw new Error("CAP04_SCENARIO_CONFIG_POLICY_MISMATCH");
  const efficiency = config.scenario_application_efficiency_policy;
  const stress = config.stress_threshold_policy;
  const efficiencyUnits = amountUnitsV1(efficiency.value, "CAP04_SCENARIO_EFFICIENCY_REQUIRED");
  const stressThresholdUnits = amountUnitsV1(stress.value, "CAP04_SCENARIO_STRESS_THRESHOLD_REQUIRED");
  const runtimeConfigRef = requiredStringV1(input.runtime_config.ref, "CAP04_SCENARIO_RUNTIME_CONFIG_REF_REQUIRED");
  const runtimeConfigHash = requiredStringV1(input.runtime_config.hash, "CAP04_SCENARIO_RUNTIME_CONFIG_HASH_REQUIRED");
  const sourcePosteriorRef = forecast.source_posterior_ref;
  const sourcePosteriorHash = forecast.source_posterior_hash;

  const createOption = (optionId: Cap04ScenarioOptionIdV1, requestedText: "0.000000" | "15.000000" | "25.000000", points: Cap04ForecastPointV1[]): Cap04ScenarioOptionV1 => {
    const requestedUnits = amountUnitsV1(requestedText, "CAP04_SCENARIO_REQUESTED_IRRIGATION_REQUIRED");
    const effectiveUnits = multiplyFixedUnitsV1(requestedUnits, 6, efficiencyUnits, 6, 6);
    const metrics = optionMetricsV1(points, stressThresholdUnits);
    const limitations = sortedUniqueV1([
      "CONTROLLED_SYNTHETIC",
      "NOT_DECISION",
      "NOT_EXECUTED",
      "NOT_FIELD_CALIBRATED",
      "NOT_RECOMMENDATION",
      ...(optionId === "NO_ACTION" ? ["NO_ACTION_EXACT_SOURCE_FORECAST_COPY"] : [CAP04_SCENARIO_ACTION_COMPLIANCE_LIMITATION_V1, "APPLICATION_EFFICIENCY_UNCERTAINTY_NOT_MODELED"]),
    ]);
    return {
      option_id: optionId,
      option_kind: optionId === "NO_ACTION" ? "NO_ACTION" : "IMMEDIATE_IRRIGATION",
      source_forecast_ref: sourceForecastRef,
      source_forecast_hash: sourceForecastHash,
      source_posterior_ref: sourcePosteriorRef,
      source_posterior_hash: sourcePosteriorHash,
      runtime_config_ref: runtimeConfigRef,
      runtime_config_hash: runtimeConfigHash,
      requested_irrigation_mm: requestedText,
      application_efficiency_fraction: decimal6V1(efficiency.value, "CAP04_SCENARIO_EFFICIENCY_REQUIRED"),
      effective_irrigation_mm: formatSignedV1(effectiveUnits),
      application_horizon: optionId === "NO_ACTION" ? null : 1,
      application_interval: optionId === "NO_ACTION" ? null : { interval_start: forecast.issued_at, interval_end: addHoursV1(forecast.issued_at, 1) },
      epistemic_status: "ASSUMED",
      execution_status: "NOT_EXECUTED",
      trajectory_points: points,
      minimum_available_water_fraction: metrics.minimumAwf,
      first_stress_target_time: metrics.firstStress,
      stress_hour_count: metrics.stressHours,
      final_storage_mm: metrics.finalStorage,
      total_precipitation_mm: metrics.totalPrecipitation,
      total_crop_et_mm: metrics.totalCropEt,
      total_irrigation_mm: metrics.totalIrrigation,
      total_runoff_mm: metrics.totalRunoff,
      total_drainage_mm: metrics.totalDrainage,
      total_overflow_mm: metrics.totalOverflow,
      difference_from_no_action: zeroDifferenceV1(),
      uncertainty_basis: {
        method_id: "ADDITIVE_STORAGE_VARIANCE_ZERO_COVARIANCE_V1",
        interval_method_id: "NORMAL_95_PERCENT_Z_1_96_V1",
        scenario_assumed_irrigation_variance_mm2: "0.000000",
        execution_compliance_variance_modeled: false,
        equipment_variance_modeled: false,
        application_efficiency_uncertainty_modeled: false,
        physical_clipping_reduces_latent_variance: false,
      },
      assumption_basis: {
        source_forecast_ref: sourceForecastRef,
        source_forecast_hash: sourceForecastHash,
        runtime_config_ref: runtimeConfigRef,
        runtime_config_hash: runtimeConfigHash,
        scenario_policy_id: CAP04_SCENARIO_POLICY_ID_V1,
        option_id: optionId,
      },
      limitations,
    };
  };

  const noAction = createOption("NO_ACTION", "0.000000", structuredClone(forecast.points));
  const irrigation15Effective = multiplyFixedUnitsV1(amountUnitsV1("15.000000", "CAP04_SCENARIO_15MM_REQUIRED"), 6, efficiencyUnits, 6, 6);
  const irrigation25Effective = multiplyFixedUnitsV1(amountUnitsV1("25.000000", "CAP04_SCENARIO_25MM_REQUIRED"), 6, efficiencyUnits, 6, 6);
  const irrigation15 = createOption("IRRIGATE_NOW_15MM", "15.000000", buildIrrigationTrajectoryV1(input, irrigation15Effective, "IRRIGATE_NOW_15MM"));
  const irrigation25 = createOption("IRRIGATE_NOW_25MM", "25.000000", buildIrrigationTrajectoryV1(input, irrigation25Effective, "IRRIGATE_NOW_25MM"));
  irrigation15.difference_from_no_action = differenceV1(irrigation15, noAction);
  irrigation25.difference_from_no_action = differenceV1(irrigation25, noAction);
  const options = [noAction, irrigation15, irrigation25];
  const scenarioSetLimitations = sortedUniqueV1([
    "CONTROLLED_SYNTHETIC",
    "NO_CALIBRATED_STRESS_PROBABILITY",
    "NO_EXECUTION_EVIDENCE",
    "NOT_DECISION",
    "NOT_FIELD_CALIBRATED",
    "NOT_RECOMMENDATION",
    CAP04_SCENARIO_ACTION_COMPLIANCE_LIMITATION_V1,
  ]);
  const scenarioSetPayload: Cap04ScenarioSetEnvelopeV1["payload"] = {
    record_set_contract_id: CAP04_THREE_SCENARIO_SET_CONTRACT_ID_V1,
    transaction_variant: CAP04_B_TRANSACTION_VARIANT_V1,
    source_forecast_ref: sourceForecastRef,
    source_forecast_hash: sourceForecastHash,
    source_posterior_ref: sourcePosteriorRef,
    source_posterior_hash: sourcePosteriorHash,
    scenario_policy_id: CAP04_SCENARIO_POLICY_ID_V1,
    runtime_config_ref: runtimeConfigRef,
    runtime_config_hash: runtimeConfigHash,
    options,
    limitations: scenarioSetLimitations,
  };
  const optionTrajectoryHashes = Object.fromEntries(options.map((option) => [option.option_id, computeCap04ScenarioTrajectoryHashV1(option.trajectory_points)])) as Record<Cap04ScenarioOptionIdV1, string>;
  const optionSemanticHashes = Object.fromEntries(options.map((option) => [option.option_id, computeCap04ScenarioOptionHashV1(option)])) as Record<Cap04ScenarioOptionIdV1, string>;
  const resultWithoutHash: Omit<Cap04PureThreeScenarioMathResultV1, "scenario_math_hash"> = {
    schema_version: "geox_mcft_cap_04_pure_three_scenario_math_result_v1",
    contract_id: CAP04_PURE_THREE_SCENARIO_MATH_CONTRACT_ID_V1,
    source_forecast_ref: sourceForecastRef,
    source_forecast_hash: sourceForecastHash,
    source_forecast_math_hash: source.forecast_math_hash,
    source_forecast_payload: structuredClone(forecast),
    scenario_policy_id: CAP04_SCENARIO_POLICY_ID_V1,
    application_efficiency_basis: {
      component_ref: efficiency.component_ref,
      policy_id: efficiency.policy_id,
      value: decimal6V1(efficiency.value, "CAP04_SCENARIO_EFFICIENCY_REQUIRED"),
      parameter_class: efficiency.parameter_class,
      field_calibration_status: efficiency.field_calibration_status,
      runtime_config_ref: runtimeConfigRef,
      runtime_config_hash: runtimeConfigHash,
    },
    stress_threshold_basis: {
      component_ref: stress.component_ref,
      policy_id: stress.policy_id,
      value: decimal6V1(stress.value, "CAP04_SCENARIO_STRESS_THRESHOLD_REQUIRED"),
      comparator: stress.comparator,
      runtime_config_ref: runtimeConfigRef,
      runtime_config_hash: runtimeConfigHash,
    },
    scenario_set_payload: scenarioSetPayload,
    option_trajectory_hashes: optionTrajectoryHashes,
    option_semantic_hashes: optionSemanticHashes,
    limitations: scenarioSetLimitations,
  };
  const result: Cap04PureThreeScenarioMathResultV1 = {
    ...resultWithoutHash,
    scenario_math_hash: computeCap04ScenarioMathHashV1(resultWithoutHash),
  };
  validateCap04PureThreeScenarioMathResultV1(result);
  return result;
}
