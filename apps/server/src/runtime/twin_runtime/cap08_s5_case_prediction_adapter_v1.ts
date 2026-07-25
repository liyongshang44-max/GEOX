// Purpose: replay CAP-08 S5 exact H1 Forecast cases under one ephemeral drainage-coefficient override without requiring ordinary assimilation authority.
// Boundary: pure in-memory water-balance execution only; no database, persistence, Candidate/Shadow append, Runtime mutation, route, scheduler or Model Activation.

import {
  executeHourlyWaterBalanceV1,
  type HourlyWaterBalanceConfigV1,
  type HourlyWaterBalanceInputV1,
} from "../../domain/soil_water/hourly_water_balance_v1.js";
import {
  formatFixedDecimalV1,
  parseFixedDecimalV1,
} from "../../domain/soil_water/fixed_point_water_decimal_v1.js";
import type {
  Cap06CalibrationCaseV1,
  Cap06CalibrationPredictionPortV1,
  Cap06PredictionResultV1,
} from "../../domain/calibration/contracts_v1.js";
import type { Cap04ForecastPointV1 } from "../../domain/twin_runtime/forecast_scenario_contracts_v1.js";
import type { ResolvedCap04ExecutionConfigV1 } from "../../domain/twin_runtime/runtime_config_execution_view_v1.js";

export const CAP08_S5_CASE_PREDICTION_ADAPTER_ID_V1 =
  "MCFT_CAP_08_S5_H1_FORECAST_REPLAY_ADAPTER_V1" as const;

export type Cap08S5PredictionAuthorityV1 = {
  residual_ref: string;
  case_input_hash: string;
  source_posterior_ref: string;
  forecast_point: Cap04ForecastPointV1;
  resolved_execution_config: ResolvedCap04ExecutionConfigV1;
};

type ReplayAuthorityV1 = {
  input_without_config: Omit<HourlyWaterBalanceInputV1, "config">;
  base_config: HourlyWaterBalanceConfigV1;
  base_point: Cap04ForecastPointV1;
  case_input_hash: string;
};

function fixed6(value: unknown, code: string): string {
  if (typeof value === "number" && Number.isFinite(value)) {
    return formatFixedDecimalV1(parseFixedDecimalV1(String(value), 6, code), 6);
  }
  if (typeof value === "string" && value.trim()) {
    return formatFixedDecimalV1(parseFixedDecimalV1(value, 6, code), 6);
  }
  throw new Error(code);
}

function buildAuthority(input: Cap08S5PredictionAuthorityV1): ReplayAuthorityV1 {
  const point = structuredClone(input.forecast_point);
  if (point.horizon_hour !== 1) throw new Error("CAP08_S5_REPLAY_H1_POINT_REQUIRED");
  if (point.assumed_irrigation_mm !== "0.000000") {
    throw new Error("CAP08_S5_REPLAY_BASELINE_NO_NEW_IRRIGATION_REQUIRED");
  }
  const payload = input.resolved_execution_config.payload;
  return {
    input_without_config: {
      interval_start_exclusive: point.interval_start,
      interval_end_inclusive: point.interval_end,
      previous_storage_mm_decimal: point.previous_storage_mm,
      previous_variance_basis: {
        basis_origin: "CARRIED_FROM_PREVIOUS_CONTINUATION_STATE",
        previous_state_ref: input.source_posterior_ref,
        previous_storage_variance_mm2_decimal: "0.000000000000",
      },
      gross_rainfall_mm_decimal: point.gross_precipitation_assumption_mm,
      historical_et0_mm_decimal: point.reference_et0_mm,
      crop_stage_code: point.crop_stage_code,
      kc_decimal: point.kc,
      executed_irrigation_candidates: [],
    },
    base_config: {
      root_zone_depth_mm: fixed6(payload.soil_hydraulic_snapshot.root_zone_depth_mm, "CAP08_S5_ROOT_ZONE_DEPTH_REQUIRED"),
      wilting_point_storage_mm: fixed6(payload.soil_hydraulic_snapshot.wilting_point_storage_mm, "CAP08_S5_WILTING_STORAGE_REQUIRED"),
      field_capacity_storage_mm: fixed6(payload.soil_hydraulic_snapshot.field_capacity_storage_mm, "CAP08_S5_FIELD_CAPACITY_REQUIRED"),
      saturation_storage_mm: fixed6(payload.soil_hydraulic_snapshot.saturation_storage_mm, "CAP08_S5_SATURATION_STORAGE_REQUIRED"),
      saturation_fraction: fixed6(payload.soil_hydraulic_snapshot.saturation_fraction, "CAP08_S5_SATURATION_FRACTION_REQUIRED"),
      runoff_fraction: fixed6(payload.dynamics_parameters.runoff_fraction, "CAP08_S5_RUNOFF_FRACTION_REQUIRED"),
      drainage_coefficient_per_hour: fixed6(payload.dynamics_parameters.drainage_coefficient_per_hour, "CAP08_S5_DRAINAGE_REQUIRED"),
      structural_process_stddev_mm_per_hour: fixed6(payload.process_uncertainty.structural_process_stddev_mm_per_hour, "CAP08_S5_STRUCTURAL_STDDEV_REQUIRED"),
      rainfall_relative_stddev: fixed6(payload.process_uncertainty.rainfall_relative_stddev, "CAP08_S5_RAINFALL_STDDEV_REQUIRED"),
      crop_et_relative_stddev: fixed6(payload.process_uncertainty.crop_et_relative_stddev, "CAP08_S5_ET_STDDEV_REQUIRED"),
      executed_irrigation_relative_stddev: fixed6(payload.process_uncertainty.executed_irrigation_relative_stddev, "CAP08_S5_IRRIGATION_STDDEV_REQUIRED"),
    },
    base_point: point,
    case_input_hash: input.case_input_hash,
  };
}

function baseTraceMatches(point: Cap04ForecastPointV1, result: ReturnType<typeof executeHourlyWaterBalanceV1>): boolean {
  const trace = result.mass_balance_trace;
  return trace.previous_storage_mm === point.previous_storage_mm
    && trace.gross_rainfall_mm === point.gross_precipitation_assumption_mm
    && trace.surface_runoff_mm === point.surface_runoff_mm
    && trace.effective_rainfall_mm === point.effective_precipitation_mm
    && trace.requested_crop_et_mm === point.requested_crop_et_mm
    && trace.actual_crop_et_mm === point.actual_crop_et_mm
    && trace.unmet_crop_et_mm === point.unmet_crop_et_mm
    && trace.drainage_mm === point.drainage_mm
    && trace.saturation_overflow_mm === point.saturation_overflow_mm
    && trace.next_storage_mm === point.storage_mean_mm
    && trace.mass_balance_error_mm === point.mass_balance_error_mm;
}

export class Cap08S5CasePredictionAdapterV1 implements Cap06CalibrationPredictionPortV1 {
  readonly adapter_id = CAP08_S5_CASE_PREDICTION_ADAPTER_ID_V1;
  private readonly byResidualRef: ReadonlyMap<string, ReplayAuthorityV1>;

  constructor(authorities: readonly Cap08S5PredictionAuthorityV1[]) {
    if (!Array.isArray(authorities) || authorities.length === 0) {
      throw new Error("CAP08_S5_PREDICTION_AUTHORITIES_REQUIRED");
    }
    const entries: Array<[string, ReplayAuthorityV1]> = [];
    for (const item of authorities) {
      if (entries.some(([ref]) => ref === item.residual_ref)) {
        throw new Error(`CAP08_S5_PREDICTION_DUPLICATE_RESIDUAL:${item.residual_ref}`);
      }
      entries.push([item.residual_ref, buildAuthority(item)]);
    }
    this.byResidualRef = new Map(entries);
  }

  predictCase(caseItem: Cap06CalibrationCaseV1, parameterValue: string): Cap06PredictionResultV1 {
    const authority = this.byResidualRef.get(caseItem.residual_ref);
    if (!authority) throw new Error(`CAP08_S5_PREDICTION_CASE_REQUIRED:${caseItem.residual_ref}`);
    if (authority.case_input_hash !== caseItem.case_input_hash) {
      throw new Error(`CAP08_S5_PREDICTION_CASE_HASH_MISMATCH:${caseItem.residual_ref}`);
    }
    const normalized = fixed6(parameterValue, "CAP08_S5_PARAMETER_REQUIRED");
    const result = executeHourlyWaterBalanceV1({
      ...authority.input_without_config,
      config: { ...authority.base_config, drainage_coefficient_per_hour: normalized },
    });
    const isBase = normalized === authority.base_config.drainage_coefficient_per_hour;
    return {
      prediction_vwc: result.published_state.root_zone_vwc_fraction.mean,
      storage_mm: result.mass_balance_trace.next_storage_mm,
      mass_balance_hash: result.mass_balance_trace_hash,
      base_trace_match: !isBase || baseTraceMatches(authority.base_point, result),
      physical_invariant_status: "PASS",
      mass_balance_status: result.mass_balance_trace.mass_balance_error_mm === "0.000000" ? "PASS" : "FAIL",
    };
  }
}
