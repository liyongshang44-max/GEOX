// scripts/runtime_acceptance/DIAG_MCFT_CAP_06_S1_CORRECTED_REGIMES.ts
// Purpose: prove that the corrected S1 controlled 24-case profile covers the frozen CAP-06 wetness regimes without changing Dynamics or thresholds.
// Boundary: temporary in-memory diagnostic only; no database, canonical append, projection, Runtime authority, State, checkpoint, Candidate, Evaluation, Model Activation, S2 implementation, or CAP-07 authority.

import assert from "node:assert/strict";
import { executeHourlyWaterBalanceV1 } from "../../apps/server/src/domain/soil_water/hourly_water_balance_v1.js";
import {
  formatFixedDecimalV1,
  parseFixedDecimalV1,
} from "../../apps/server/src/domain/soil_water/fixed_point_water_decimal_v1.js";
import {
  CAP06_S1_BASE_DRAINAGE_COEFFICIENT_V1,
  buildCap06S1ControlledDatasetV1,
} from "./mcft_cap_06_s1_residual_windows_fixture_v1.js";

function fixed6V1(value: unknown, code: string): string {
  const number = Number(value);
  if (!Number.isFinite(number)) throw new Error(code);
  return number.toFixed(6);
}

function classifyV1(excessUnits: bigint, spanUnits: bigint): "LOW_EXCESS" | "MID_EXCESS" | "HIGH_EXCESS" {
  if (spanUnits <= 0n) throw new Error("CAP06_S1_CORRECTION_REGIME_SPAN_INVALID");
  if (excessUnits * 100n < spanUnits * 10n) return "LOW_EXCESS";
  if (excessUnits * 100n < spanUnits * 30n) return "MID_EXCESS";
  return "HIGH_EXCESS";
}

async function main(): Promise<void> {
  const dataset = await buildCap06S1ControlledDatasetV1();
  assert.equal(dataset.cases.length, 24);
  assert.equal(dataset.calibration_window_refs.length, 16);
  assert.equal(dataset.holdout_window_refs.length, 8);

  const cases = dataset.cases.map((caseItem) => {
    const payload = caseItem.source_runtime_config.payload as Record<string, any>;
    const config = {
      root_zone_depth_mm: fixed6V1(payload.soil_hydraulic_snapshot?.root_zone_depth_mm, "CAP06_S1_CORRECTION_ROOT_DEPTH_REQUIRED"),
      wilting_point_storage_mm: fixed6V1(payload.soil_hydraulic_snapshot?.wilting_point_storage_mm, "CAP06_S1_CORRECTION_WILTING_REQUIRED"),
      field_capacity_storage_mm: fixed6V1(payload.soil_hydraulic_snapshot?.field_capacity_storage_mm, "CAP06_S1_CORRECTION_FIELD_CAPACITY_REQUIRED"),
      saturation_storage_mm: fixed6V1(payload.soil_hydraulic_snapshot?.saturation_storage_mm, "CAP06_S1_CORRECTION_SATURATION_REQUIRED"),
      saturation_fraction: fixed6V1(payload.soil_hydraulic_snapshot?.saturation_fraction, "CAP06_S1_CORRECTION_SATURATION_FRACTION_REQUIRED"),
      runoff_fraction: fixed6V1(payload.dynamics_parameters?.runoff_fraction, "CAP06_S1_CORRECTION_RUNOFF_REQUIRED"),
      drainage_coefficient_per_hour: fixed6V1(payload.dynamics_parameters?.drainage_coefficient_per_hour, "CAP06_S1_CORRECTION_DRAINAGE_REQUIRED"),
      structural_process_stddev_mm_per_hour: fixed6V1(payload.process_uncertainty?.structural_process_stddev_mm_per_hour, "CAP06_S1_CORRECTION_STRUCTURAL_REQUIRED"),
      rainfall_relative_stddev: fixed6V1(payload.process_uncertainty?.rainfall_relative_stddev, "CAP06_S1_CORRECTION_RAINFALL_REQUIRED"),
      crop_et_relative_stddev: fixed6V1(payload.process_uncertainty?.crop_et_relative_stddev, "CAP06_S1_CORRECTION_ET_REQUIRED"),
      executed_irrigation_relative_stddev: fixed6V1(payload.process_uncertainty?.executed_irrigation_relative_stddev, "CAP06_S1_CORRECTION_IRRIGATION_REQUIRED"),
    };
    assert.equal(config.drainage_coefficient_per_hour, CAP06_S1_BASE_DRAINAGE_COEFFICIENT_V1);
    const forecastPayload = caseItem.source_forecast.payload as Record<string, any>;
    const replay = executeHourlyWaterBalanceV1({
      interval_start_exclusive: caseItem.forecast_point.interval_start,
      interval_end_inclusive: caseItem.forecast_point.interval_end,
      previous_storage_mm_decimal: caseItem.forecast_point.previous_storage_mm,
      previous_variance_basis: {
        basis_origin: "CARRIED_FROM_PREVIOUS_CONTINUATION_STATE",
        previous_state_ref: String(forecastPayload.source_posterior_ref),
        previous_storage_variance_mm2_decimal: "0.000000000000",
      },
      gross_rainfall_mm_decimal: caseItem.forecast_point.gross_precipitation_assumption_mm,
      historical_et0_mm_decimal: caseItem.forecast_point.reference_et0_mm,
      crop_stage_code: caseItem.forecast_point.crop_stage_code,
      kc_decimal: caseItem.forecast_point.kc,
      executed_irrigation_candidates: [],
      config,
    });
    assert.equal(replay.mass_balance_trace.next_storage_mm, caseItem.base_replay_storage_mm);
    assert.equal(replay.mass_balance_trace.next_storage_mm, caseItem.forecast_point.storage_mean_mm);
    assert.equal(replay.mass_balance_trace.mass_balance_error_mm, "0.000000");

    const storageBeforeDrainageUnits = parseFixedDecimalV1(replay.mass_balance_trace.storage_before_drainage_mm, 6);
    const fieldCapacityUnits = parseFixedDecimalV1(config.field_capacity_storage_mm, 6);
    const saturationUnits = parseFixedDecimalV1(config.saturation_storage_mm, 6);
    const excessUnits = storageBeforeDrainageUnits > fieldCapacityUnits
      ? storageBeforeDrainageUnits - fieldCapacityUnits
      : 0n;
    const spanUnits = saturationUnits - fieldCapacityUnits;
    const ratioScale9 = (excessUnits * 1_000_000_000n) / spanUnits;
    return {
      case_index: caseItem.case_index,
      residual_ref: caseItem.residual.object_id,
      residual_hash: caseItem.residual.determinism_hash,
      role: caseItem.case_index < 16 ? "CALIBRATION" : "HOLDOUT",
      forecast_target_time: caseItem.residual.payload.forecast_target_time,
      gross_precipitation_assumption_mm: caseItem.forecast_point.gross_precipitation_assumption_mm,
      excess_above_field_capacity_mm: formatFixedDecimalV1(excessUnits, 6),
      normalized_excess_ratio_scale_9: formatFixedDecimalV1(ratioScale9, 9),
      wetness_regime: classifyV1(excessUnits, spanUnits),
      base_replay_storage_mm: caseItem.base_replay_storage_mm,
      hidden_replay_storage_mm: caseItem.hidden_replay_storage_mm,
    };
  });

  const calibrationCases = cases.slice(0, 16);
  const holdoutCases = cases.slice(16);
  const countRegimes = (items: typeof cases) => items.reduce<Record<string, number>>((counts, item) => {
    counts[item.wetness_regime] = (counts[item.wetness_regime] ?? 0) + 1;
    return counts;
  }, {});
  const calibrationRegimeCount = Object.keys(countRegimes(calibrationCases)).length;
  assert.ok(calibrationRegimeCount >= 2, `CAP06_S1_CORRECTION_CALIBRATION_REGIME_COUNT:${calibrationRegimeCount}`);

  console.log(`S1_CORRECTION_DIAGNOSTIC_JSON:${JSON.stringify({
    schema_version: "geox_mcft_cap_06_s1_corrected_regime_diagnostic_v1",
    profile_id: dataset.profile_id,
    total_case_count: cases.length,
    calibration_case_count: calibrationCases.length,
    holdout_case_count: holdoutCases.length,
    calibration_regime_counts: countRegimes(calibrationCases),
    holdout_regime_counts: countRegimes(holdoutCases),
    calibration_represented_regime_count: calibrationRegimeCount,
    residual_set_hash: dataset.residual_set_hash,
    calibration_window_hash: dataset.calibration_window_hash,
    holdout_window_hash: dataset.holdout_window_hash,
    case_input_set_hash: dataset.case_input_set_hash,
    ordered_residual_refs: dataset.ordered_residual_refs,
    ordered_residual_hashes: dataset.ordered_residual_hashes,
    cases,
  })}`);
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : String(error));
  process.exitCode = 1;
});
