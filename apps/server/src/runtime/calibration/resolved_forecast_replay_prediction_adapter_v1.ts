// Purpose: replay exact resolved CAP-06 H1 Forecast cases under one ephemeral drainage-coefficient override for S5 calibration compute.
// Boundary: pure in-memory Dynamics execution only; no repository access, external forcing retrieval, persistence, projection, Candidate/Evaluation append, Runtime authority, State/checkpoint mutation, route, scheduler, or Model Activation.

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
import type { ResolvedForecastObservationCaseV1 } from "../../domain/twin_runtime/resolved_forecast_observation_case_v1.js";

export const CAP06_RESOLVED_FORECAST_REPLAY_ADAPTER_ID_V1 =
  "MCFT_CAP_06_RESOLVED_H1_FORECAST_REPLAY_ADAPTER_V1" as const;

type ReplayAuthorityV1 = {
  case_item: ResolvedForecastObservationCaseV1;
  input_without_config: Omit<HourlyWaterBalanceInputV1, "config">;
  base_config: HourlyWaterBalanceConfigV1;
};

function fixed6V1(value: unknown, code: string): string {
  if (typeof value === "number" && Number.isFinite(value)) {
    return formatFixedDecimalV1(parseFixedDecimalV1(String(value), 6, code), 6);
  }
  if (typeof value === "string" && value.trim()) {
    return formatFixedDecimalV1(parseFixedDecimalV1(value, 6, code), 6);
  }
  throw new Error(code);
}

function configV1(item: ResolvedForecastObservationCaseV1): HourlyWaterBalanceConfigV1 {
  const payload = item.resolved_execution_config.payload;
  return {
    root_zone_depth_mm: fixed6V1(
      payload.soil_hydraulic_snapshot.root_zone_depth_mm,
      "CAP06_REPLAY_ROOT_ZONE_DEPTH_REQUIRED",
    ),
    wilting_point_storage_mm: fixed6V1(
      payload.soil_hydraulic_snapshot.wilting_point_storage_mm,
      "CAP06_REPLAY_WILTING_STORAGE_REQUIRED",
    ),
    field_capacity_storage_mm: fixed6V1(
      payload.soil_hydraulic_snapshot.field_capacity_storage_mm,
      "CAP06_REPLAY_FIELD_CAPACITY_REQUIRED",
    ),
    saturation_storage_mm: fixed6V1(
      payload.soil_hydraulic_snapshot.saturation_storage_mm,
      "CAP06_REPLAY_SATURATION_STORAGE_REQUIRED",
    ),
    saturation_fraction: fixed6V1(
      payload.soil_hydraulic_snapshot.saturation_fraction,
      "CAP06_REPLAY_SATURATION_FRACTION_REQUIRED",
    ),
    runoff_fraction: fixed6V1(
      payload.dynamics_parameters.runoff_fraction,
      "CAP06_REPLAY_RUNOFF_FRACTION_REQUIRED",
    ),
    drainage_coefficient_per_hour: fixed6V1(
      payload.dynamics_parameters.drainage_coefficient_per_hour,
      "CAP06_REPLAY_DRAINAGE_COEFFICIENT_REQUIRED",
    ),
    structural_process_stddev_mm_per_hour: fixed6V1(
      payload.process_uncertainty.structural_process_stddev_mm_per_hour,
      "CAP06_REPLAY_STRUCTURAL_STDDEV_REQUIRED",
    ),
    rainfall_relative_stddev: fixed6V1(
      payload.process_uncertainty.rainfall_relative_stddev,
      "CAP06_REPLAY_RAINFALL_STDDEV_REQUIRED",
    ),
    crop_et_relative_stddev: fixed6V1(
      payload.process_uncertainty.crop_et_relative_stddev,
      "CAP06_REPLAY_CROP_ET_STDDEV_REQUIRED",
    ),
    executed_irrigation_relative_stddev: fixed6V1(
      payload.process_uncertainty.executed_irrigation_relative_stddev,
      "CAP06_REPLAY_IRRIGATION_STDDEV_REQUIRED",
    ),
  };
}

function replayInputV1(
  item: ResolvedForecastObservationCaseV1,
): Omit<HourlyWaterBalanceInputV1, "config"> {
  const point = item.source_forecast_point;
  if (point.horizon_hour !== 1) throw new Error("CAP06_REPLAY_H1_FORECAST_POINT_REQUIRED");
  if (point.assumed_irrigation_mm !== "0.000000") {
    throw new Error("CAP06_REPLAY_BASELINE_NO_NEW_IRRIGATION_REQUIRED");
  }
  return {
    interval_start_exclusive: point.interval_start,
    interval_end_inclusive: point.interval_end,
    previous_storage_mm_decimal: point.previous_storage_mm,
    previous_variance_basis: {
      basis_origin: "CARRIED_FROM_PREVIOUS_CONTINUATION_STATE",
      previous_state_ref: item.source_posterior.object_id,
      previous_storage_variance_mm2_decimal: "0.000000000000",
    },
    gross_rainfall_mm_decimal: point.gross_precipitation_assumption_mm,
    historical_et0_mm_decimal: point.reference_et0_mm,
    crop_stage_code: point.crop_stage_code,
    kc_decimal: point.kc,
    executed_irrigation_candidates: [],
  };
}

function baseTraceMatchesV1(
  item: ResolvedForecastObservationCaseV1,
  result: ReturnType<typeof executeHourlyWaterBalanceV1>,
): boolean {
  const point = item.source_forecast_point;
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

function buildAuthorityV1(item: ResolvedForecastObservationCaseV1): ReplayAuthorityV1 {
  if (item.case_source.residual_ref !== item.residual.object_id) {
    throw new Error("CAP06_REPLAY_RESOLVED_CASE_ROOT_MISMATCH");
  }
  return {
    case_item: structuredClone(item),
    input_without_config: replayInputV1(item),
    base_config: configV1(item),
  };
}

export class Cap06ResolvedForecastReplayPredictionAdapterV1
implements Cap06CalibrationPredictionPortV1 {
  readonly adapter_id = CAP06_RESOLVED_FORECAST_REPLAY_ADAPTER_ID_V1;
  private readonly byResidualRef: ReadonlyMap<string, ReplayAuthorityV1>;

  constructor(resolvedCases: readonly ResolvedForecastObservationCaseV1[]) {
    if (!Array.isArray(resolvedCases) || resolvedCases.length === 0) {
      throw new Error("CAP06_REPLAY_RESOLVED_CASES_REQUIRED");
    }
    const entries: [string, ReplayAuthorityV1][] = [];
    for (const item of resolvedCases) {
      const authority = buildAuthorityV1(item);
      const ref = authority.case_item.residual.object_id;
      if (entries.some(([existing]) => existing === ref)) {
        throw new Error(`CAP06_REPLAY_DUPLICATE_RESIDUAL:${ref}`);
      }
      entries.push([ref, authority]);
    }
    this.byResidualRef = new Map(entries);
  }

  predictCase(
    caseItem: Cap06CalibrationCaseV1,
    parameterValue: string,
  ): Cap06PredictionResultV1 {
    const authority = this.byResidualRef.get(caseItem.residual_ref);
    if (!authority) throw new Error(`CAP06_REPLAY_EXACT_CASE_REQUIRED:${caseItem.residual_ref}`);
    if (authority.case_item.case_source.case_input_hash !== caseItem.case_input_hash) {
      throw new Error(`CAP06_REPLAY_CASE_INPUT_HASH_MISMATCH:${caseItem.residual_ref}`);
    }
    const normalizedParameter = fixed6V1(parameterValue, "CAP06_REPLAY_PARAMETER_REQUIRED");
    const result = executeHourlyWaterBalanceV1({
      ...authority.input_without_config,
      config: {
        ...authority.base_config,
        drainage_coefficient_per_hour: normalizedParameter,
      },
    });
    const isBase = normalizedParameter === authority.base_config.drainage_coefficient_per_hour;
    return {
      prediction_vwc: result.published_state.root_zone_vwc_fraction.mean,
      storage_mm: result.mass_balance_trace.next_storage_mm,
      mass_balance_hash: result.mass_balance_trace_hash,
      base_trace_match: !isBase || baseTraceMatchesV1(authority.case_item, result),
      physical_invariant_status: "PASS",
      mass_balance_status: result.mass_balance_trace.mass_balance_error_mm === "0.000000"
        ? "PASS"
        : "FAIL",
    };
  }
}
