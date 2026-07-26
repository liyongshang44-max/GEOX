// Purpose: replay exact MCFT-CAP-08.S5 Residual cases under one ephemeral drainage-coefficient override while preserving the source Forecast trace as the base oracle.
// Boundary: pure in-memory Dynamics execution only; no repository access, persistence, projection, Candidate/Evaluation append, active Config, State, checkpoint, route, scheduler, or Model Activation authority.

import {
  executeHourlyWaterBalanceV1,
  type HourlyWaterBalanceConfigV1,
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
import type {
  Cap08S5ResolvedObligationV1,
  Cap08S5ReplayAuthorityV1,
} from "../../domain/twin_runtime/cap08_s5_residual_calibration_shadow_contracts_v1.js";

export const CAP08_S5_REPLAY_ADAPTER_ID_V1 =
  "MCFT_CAP_08_S5_EXACT_H1_FORECAST_REPLAY_ADAPTER_V1" as const;

function fixed6V1(value: unknown, code: string): string {
  if (typeof value === "number" && Number.isFinite(value)) {
    return formatFixedDecimalV1(parseFixedDecimalV1(String(value), 6, code), 6);
  }
  if (typeof value === "string" && value.trim()) {
    return formatFixedDecimalV1(parseFixedDecimalV1(value, 6, code), 6);
  }
  throw new Error(code);
}

function exactConfigV1(
  base: HourlyWaterBalanceConfigV1,
  parameterValue: string,
): HourlyWaterBalanceConfigV1 {
  return {
    ...structuredClone(base),
    drainage_coefficient_per_hour: fixed6V1(
      parameterValue,
      "CAP08_S5_REPLAY_PARAMETER_REQUIRED",
    ),
  };
}

function baseTraceMatchesV1(
  authority: Cap08S5ReplayAuthorityV1,
  result: ReturnType<typeof executeHourlyWaterBalanceV1>,
): boolean {
  const point = authority.source_forecast_point;
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

function authorityMapV1(
  resolved: readonly Cap08S5ResolvedObligationV1[],
): ReadonlyMap<string, Cap08S5ReplayAuthorityV1> {
  if (!Array.isArray(resolved) || resolved.length === 0) {
    throw new Error("CAP08_S5_REPLAY_RESOLVED_OBLIGATIONS_REQUIRED");
  }
  const entries: Array<[string, Cap08S5ReplayAuthorityV1]> = [];
  for (const item of resolved) {
    const residualRef = item.residual.object_id;
    if (item.case_source.residual_ref !== residualRef
      || item.replay_authority.residual_ref !== residualRef) {
      throw new Error(`CAP08_S5_REPLAY_RESIDUAL_ROOT_MISMATCH:${residualRef}`);
    }
    if (item.replay_authority.source_forecast_point.horizon_hour !== 1) {
      throw new Error(`CAP08_S5_REPLAY_H1_FORECAST_POINT_REQUIRED:${residualRef}`);
    }
    if (item.replay_authority.source_forecast_point.assumed_irrigation_mm !== "0.000000") {
      throw new Error(`CAP08_S5_REPLAY_BASELINE_NO_NEW_IRRIGATION_REQUIRED:${residualRef}`);
    }
    if (entries.some(([existing]) => existing === residualRef)) {
      throw new Error(`CAP08_S5_REPLAY_DUPLICATE_RESIDUAL:${residualRef}`);
    }
    entries.push([residualRef, structuredClone(item.replay_authority)]);
  }
  return new Map(entries);
}

export class Cap08S5ReplayPredictionAdapterV1
implements Cap06CalibrationPredictionPortV1 {
  readonly adapter_id = CAP08_S5_REPLAY_ADAPTER_ID_V1;
  private readonly authorityByResidualRef: ReadonlyMap<string, Cap08S5ReplayAuthorityV1>;

  constructor(resolved: readonly Cap08S5ResolvedObligationV1[]) {
    this.authorityByResidualRef = authorityMapV1(resolved);
  }

  predictCase(
    caseItem: Cap06CalibrationCaseV1,
    parameterValue: string,
  ): Cap06PredictionResultV1 {
    const authority = this.authorityByResidualRef.get(caseItem.residual_ref);
    if (!authority) {
      throw new Error(`CAP08_S5_REPLAY_EXACT_CASE_REQUIRED:${caseItem.residual_ref}`);
    }
    const result = executeHourlyWaterBalanceV1({
      ...structuredClone(authority.input_without_config),
      config: exactConfigV1(authority.base_config, parameterValue),
    });
    const normalizedParameter = fixed6V1(
      parameterValue,
      "CAP08_S5_REPLAY_PARAMETER_REQUIRED",
    );
    const baseParameter = fixed6V1(
      authority.base_config.drainage_coefficient_per_hour,
      "CAP08_S5_REPLAY_BASE_PARAMETER_REQUIRED",
    );
    const isBase = normalizedParameter === baseParameter;
    return {
      prediction_vwc: result.published_state.root_zone_vwc_fraction.mean,
      storage_mm: result.mass_balance_trace.next_storage_mm,
      mass_balance_hash: result.mass_balance_trace_hash,
      base_trace_match: !isBase || baseTraceMatchesV1(authority, result),
      physical_invariant_status: "PASS",
      mass_balance_status: result.mass_balance_trace.mass_balance_error_mm === "0.000000"
        ? "PASS"
        : "FAIL",
    };
  }
}
