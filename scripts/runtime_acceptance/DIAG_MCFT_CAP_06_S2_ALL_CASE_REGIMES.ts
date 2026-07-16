// scripts/runtime_acceptance/DIAG_MCFT_CAP_06_S2_ALL_CASE_REGIMES.ts
// Purpose: classify all 24 effective S1 controlled cases under the frozen CAP-06 wetness-regime formula.
// Boundary: temporary in-memory diagnostic only; no database, canonical write, projection, Runtime authority, State, checkpoint, route, scheduler, Model Activation, S3, or CAP-07 authority.

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
  if (spanUnits <= 0n) throw new Error("S2_DIAG_REGIME_SPAN_INVALID");
  if (excessUnits * 100n < spanUnits * 10n) return "LOW_EXCESS";
  if (excessUnits * 100n < spanUnits * 30n) return "MID_EXCESS";
  return "HIGH_EXCESS";
}

async function main(): Promise<void> {
  const controlled = await buildCap06S1ControlledDatasetV1();
  assert.equal(controlled.cases.length, 24);
  const cases = controlled.cases.map((caseItem) => {
    const payload = caseItem.source_runtime_config.payload as Record<string, any>;
    const config = {
      root_zone_depth_mm: fixed6V1(payload.soil_hydraulic_snapshot?.root_zone_depth_mm, "S2_DIAG_ROOT_DEPTH_REQUIRED"),
      wilting_point_storage_mm: fixed6V1(payload.soil_hydraulic_snapshot?.wilting_point_storage_mm, "S2_DIAG_WILTING_REQUIRED"),
      field_capacity_storage_mm: fixed6V1(payload.soil_hydraulic_snapshot?.field_capacity_storage_mm, "S2_DIAG_FIELD_CAPACITY_REQUIRED"),
      saturation_storage_mm: fixed6V1(payload.soil_hydraulic_snapshot?.saturation_storage_mm, "S2_DIAG_SATURATION_REQUIRED"),
      saturation_fraction: fixed6V1(payload.soil_hydraulic_snapshot?.saturation_fraction, "S2_DIAG_SATURATION_FRACTION_REQUIRED"),
      runoff_fraction: fixed6V1(payload.dynamics_parameters?.runoff_fraction, "S2_DIAG_RUNOFF_REQUIRED"),
      drainage_coefficient_per_hour: fixed6V1(payload.dynamics_parameters?.drainage_coefficient_per_hour, "S2_DIAG_DRAINAGE_REQUIRED"),
      structural_process_stddev_mm_per_hour: fixed6V1(payload.process_uncertainty?.structural_process_stddev_mm_per_hour, "S2_DIAG_STRUCTURAL_REQUIRED"),
      rainfall_relative_stddev: fixed6V1(payload.process_uncertainty?.rainfall_relative_stddev, "S2_DIAG_RAINFALL_REQUIRED"),
      crop_et_relative_stddev: fixed6V1(payload.process_uncertainty?.crop_et_relative_stddev, "S2_DIAG_ET_REQUIRED"),
      executed_irrigation_relative_stddev: fixed6V1(payload.process_uncertainty?.executed_irrigation_relative_stddev, "S2_DIAG_IRRIGATION_REQUIRED"),
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
    const excessUnits = parseFixedDecimalV1(replay.mass_balance_trace.storage_before_drainage_mm, 6)
      - parseFixedDecimalV1(config.field_capacity_storage_mm, 6);
    const nonNegativeExcess = excessUnits > 0n ? excessUnits : 0n;
    const spanUnits = parseFixedDecimalV1(config.saturation_storage_mm, 6)
      - parseFixedDecimalV1(config.field_capacity_storage_mm, 6);
    const ratioScale9 = spanUnits === 0n ? 0n : (nonNegativeExcess * 1_000_000_000n) / spanUnits;
    return {
      case_index: caseItem.case_index,
      residual_ref: caseItem.residual.object_id,
      forecast_target_time: caseItem.residual.payload.forecast_target_time,
      excess_above_field_capacity_mm: formatFixedDecimalV1(nonNegativeExcess, 6),
      saturation_minus_field_capacity_mm: formatFixedDecimalV1(spanUnits, 6),
      normalized_excess_ratio_scale_9: formatFixedDecimalV1(ratioScale9, 9),
      wetness_regime: classifyV1(nonNegativeExcess, spanUnits),
    };
  });
  const regimeCounts = cases.reduce<Record<string, number>>((counts, item) => {
    counts[item.wetness_regime] = (counts[item.wetness_regime] ?? 0) + 1;
    return counts;
  }, {});
  const maximumRatio = cases.reduce((maximum, item) => {
    const current = parseFixedDecimalV1(item.normalized_excess_ratio_scale_9, 9);
    return current > maximum ? current : maximum;
  }, 0n);
  console.log(`S2_ALL_CASE_REGIMES_JSON:${JSON.stringify({
    schema_version: "geox_mcft_cap_06_s2_all_case_regimes_diagnostic_v1",
    case_count: cases.length,
    regime_counts: regimeCounts,
    maximum_normalized_excess_ratio_scale_9: formatFixedDecimalV1(maximumRatio, 9),
    cases,
  })}`);
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : String(error));
  process.exitCode = 1;
});
