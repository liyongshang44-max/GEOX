// apps/server/src/domain/twin_runtime/forecast_scenario_contracts_v1.ts
// Purpose: define the additive MCFT-CAP-04 A1, A2 and B contracts plus deterministic Forecast-point and Scenario-option validation.
// Boundary: pure contracts only; no forcing selection, Forecast equations, Scenario equations, persistence, projection, route, scheduler, clock, filesystem or network.

import type { CanonicalObjectEnvelopeV1 } from "./canonical_object_contracts_v1.js";

export const CAP04_COMPLETED_FORECAST_CONTRACT_ID_V1 =
  "MCFT_CAP_04_COMPLETED_FORECAST_CONTINUATION_V1" as const;
export const CAP04_BLOCKED_FORECAST_CONTRACT_ID_V1 =
  "MCFT_CAP_04_BLOCKED_FORECAST_CONTINUATION_V1" as const;
export const CAP04_THREE_SCENARIO_SET_CONTRACT_ID_V1 =
  "MCFT_CAP_04_THREE_SCENARIO_SET_V1" as const;

export const CAP04_A1_OPERATION_VARIANT_V1 = "A1_COMPLETED" as const;
export const CAP04_A2_OPERATION_VARIANT_V1 = "A2_BLOCKED_FORECAST" as const;
export const CAP04_B_TRANSACTION_VARIANT_V1 = "B_SCENARIO_COMMIT" as const;

export const CAP04_FORECAST_POINT_COUNT_V1 = 72 as const;
export const CAP04_FORECAST_HORIZON_HOURS_V1 = 72 as const;
export const CAP04_FORECAST_STEP_HOURS_V1 = 1 as const;
export const CAP04_FORECAST_BASELINE_ASSUMPTION_V1 = "NO_NEW_IRRIGATION" as const;

export const CAP04_SCENARIO_POLICY_ID_V1 = "THREE_OPTION_IRRIGATION_SCENARIO_POLICY_V1" as const;
export const CAP04_SCENARIO_OPTION_IDS_V1 = [
  "NO_ACTION",
  "IRRIGATE_NOW_15MM",
  "IRRIGATE_NOW_25MM",
] as const;
export type Cap04ScenarioOptionIdV1 = (typeof CAP04_SCENARIO_OPTION_IDS_V1)[number];

export const CAP04_A_MEMBER_OBJECT_TYPES_V1 = [
  "twin_evidence_window_v1",
  "twin_state_transition_v1",
  "twin_assimilation_update_v1",
  "twin_state_estimate_v1",
  "twin_forecast_run_v1",
  "twin_runtime_tick_v1",
  "twin_runtime_checkpoint_v1",
  "twin_runtime_health_v1",
] as const;
export type Cap04AMemberObjectTypeV1 = (typeof CAP04_A_MEMBER_OBJECT_TYPES_V1)[number];

export type Cap04AContractIdV1 =
  | typeof CAP04_COMPLETED_FORECAST_CONTRACT_ID_V1
  | typeof CAP04_BLOCKED_FORECAST_CONTRACT_ID_V1;
export type Cap04AOperationVariantV1 =
  | typeof CAP04_A1_OPERATION_VARIANT_V1
  | typeof CAP04_A2_OPERATION_VARIANT_V1;

export type Cap04ForecastPointV1 = {
  horizon_hour: number;
  interval_start: string;
  interval_end: string;
  target_time: string;
  previous_storage_mm: string;
  gross_precipitation_assumption_mm: string;
  surface_runoff_mm: string;
  effective_precipitation_mm: string;
  assumed_irrigation_mm: string;
  reference_et0_mm: string;
  crop_stage_code: string;
  kc: string;
  requested_crop_et_mm: string;
  actual_crop_et_mm: string;
  unmet_crop_et_mm: string;
  drainage_mm: string;
  saturation_overflow_mm: string;
  storage_mean_mm: string;
  storage_variance_mm2: string;
  storage_interval_unclipped_lower_mm: string;
  storage_interval_unclipped_upper_mm: string;
  storage_interval_emitted_lower_mm: string;
  storage_interval_emitted_upper_mm: string;
  available_water_fraction: string;
  depletion_from_field_capacity_mm: string;
  mass_balance_error_mm: "0.000000";
  determinism_hash: string;
};

export type Cap04ForecastRunPayloadV1 = {
  status: "COMPLETED" | "BLOCKED";
  issued_at: string;
  source_posterior_ref: string;
  source_posterior_hash: string;
  runtime_config_ref: string;
  runtime_config_hash: string;
  baseline_assumption: typeof CAP04_FORECAST_BASELINE_ASSUMPTION_V1;
  points: Cap04ForecastPointV1[];
  reason_codes: string[];
  scenario_eligible: boolean;
  forcing_window_hash: string | null;
  forcing_cycle_key: string | null;
  weather_snapshot_ref: string | null;
  weather_snapshot_hash: string | null;
  et0_snapshot_ref: string | null;
  et0_snapshot_hash: string | null;
  crop_stage_context_ref: string;
  crop_stage_context_hash: string;
  future_forcing_pair_policy_id: string;
  future_forcing_policy_id: string;
  future_forcing_fallback_policy_id: string;
  forecast_method_id: string;
  forecast_method_version: string;
  uncertainty_propagation_method_id: string;
  forecast_interval_method_id: string;
  limitations: string[];
};

export type Cap04ScenarioDifferenceFromBaselineV1 = {
  final_storage_delta_mm: string;
  minimum_awf_delta: string;
  stress_hour_count_delta: number;
  total_irrigation_delta_mm: string;
  total_drainage_delta_mm: string;
  total_overflow_delta_mm: string;
};

export type Cap04ScenarioOptionV1 = {
  option_id: Cap04ScenarioOptionIdV1;
  option_kind: "NO_ACTION" | "IMMEDIATE_IRRIGATION";
  source_forecast_ref: string;
  source_forecast_hash: string;
  source_posterior_ref: string;
  source_posterior_hash: string;
  runtime_config_ref: string;
  runtime_config_hash: string;
  requested_irrigation_mm: string;
  application_efficiency_fraction: string;
  effective_irrigation_mm: string;
  application_horizon: number | null;
  application_interval: { interval_start: string; interval_end: string } | null;
  epistemic_status: "ASSUMED";
  execution_status: "NOT_EXECUTED";
  trajectory_points: Cap04ForecastPointV1[];
  minimum_available_water_fraction: string;
  first_stress_target_time: string | null;
  stress_hour_count: number;
  final_storage_mm: string;
  total_precipitation_mm: string;
  total_crop_et_mm: string;
  total_irrigation_mm: string;
  total_runoff_mm: string;
  total_drainage_mm: string;
  total_overflow_mm: string;
  difference_from_no_action: Cap04ScenarioDifferenceFromBaselineV1;
  uncertainty_basis: Record<string, unknown>;
  assumption_basis: {
    source_forecast_ref: string;
    source_forecast_hash: string;
    runtime_config_ref: string;
    runtime_config_hash: string;
    scenario_policy_id: typeof CAP04_SCENARIO_POLICY_ID_V1;
    option_id: Cap04ScenarioOptionIdV1;
  };
  limitations: string[];
};

export type Cap04ScenarioSetEnvelopeV1 = Omit<CanonicalObjectEnvelopeV1, "object_type"> & {
  object_type: "twin_scenario_set_v1";
  payload: {
    record_set_contract_id: typeof CAP04_THREE_SCENARIO_SET_CONTRACT_ID_V1;
    transaction_variant: typeof CAP04_B_TRANSACTION_VARIANT_V1;
    source_forecast_ref: string;
    source_forecast_hash: string;
    source_posterior_ref: string;
    source_posterior_hash: string;
    scenario_policy_id: typeof CAP04_SCENARIO_POLICY_ID_V1;
    runtime_config_ref: string;
    runtime_config_hash: string;
    options: Cap04ScenarioOptionV1[];
    limitations: string[];
  };
};

function requiredStringV1(value: unknown, code: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(code);
  return value;
}

function canonicalHourV1(value: unknown, code: string): string {
  const text = requiredStringV1(value, code);
  const parsed = Date.parse(text);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== text) throw new Error(code);
  if (!text.endsWith(":00:00.000Z")) throw new Error(code);
  return text;
}

function exactDecimal6V1(value: unknown, code: string): string {
  const text = requiredStringV1(value, code);
  if (!/^-?\d+\.\d{6}$/.test(text)) throw new Error(code);
  return text;
}

function addHoursV1(value: string, hours: number): string {
  return new Date(Date.parse(value) + hours * 3_600_000).toISOString();
}

export function validateCap04ForecastPointV1(
  point: Cap04ForecastPointV1,
  issuedAt: string,
  expectedHorizon: number,
): void {
  if (!point || typeof point !== "object") throw new Error("CAP04_FORECAST_POINT_REQUIRED");
  if (point.horizon_hour !== expectedHorizon) throw new Error("CAP04_FORECAST_HORIZON_SEQUENCE_MISMATCH");
  if (expectedHorizon < 1 || expectedHorizon > CAP04_FORECAST_HORIZON_HOURS_V1) throw new Error("CAP04_FORECAST_HORIZON_OUT_OF_RANGE");
  const expectedTarget = addHoursV1(issuedAt, expectedHorizon);
  if (canonicalHourV1(point.target_time, "CAP04_FORECAST_TARGET_TIME_INVALID") !== expectedTarget) throw new Error("CAP04_FORECAST_TARGET_TIME_MISMATCH");
  if (canonicalHourV1(point.interval_end, "CAP04_FORECAST_INTERVAL_END_INVALID") !== expectedTarget) throw new Error("CAP04_FORECAST_INTERVAL_END_MISMATCH");
  if (canonicalHourV1(point.interval_start, "CAP04_FORECAST_INTERVAL_START_INVALID") !== addHoursV1(expectedTarget, -1)) throw new Error("CAP04_FORECAST_INTERVAL_START_MISMATCH");
  for (const field of [
    "previous_storage_mm", "gross_precipitation_assumption_mm", "surface_runoff_mm",
    "effective_precipitation_mm", "assumed_irrigation_mm", "reference_et0_mm", "kc",
    "requested_crop_et_mm", "actual_crop_et_mm", "unmet_crop_et_mm", "drainage_mm",
    "saturation_overflow_mm", "storage_mean_mm", "storage_variance_mm2",
    "storage_interval_unclipped_lower_mm", "storage_interval_unclipped_upper_mm",
    "storage_interval_emitted_lower_mm", "storage_interval_emitted_upper_mm",
    "available_water_fraction", "depletion_from_field_capacity_mm", "mass_balance_error_mm",
  ] as const) exactDecimal6V1(point[field], `CAP04_FORECAST_POINT_${field.toUpperCase()}_INVALID`);
  requiredStringV1(point.crop_stage_code, "CAP04_FORECAST_CROP_STAGE_REQUIRED");
  requiredStringV1(point.determinism_hash, "CAP04_FORECAST_POINT_HASH_REQUIRED");
  if (point.mass_balance_error_mm !== "0.000000") throw new Error("CAP04_FORECAST_MASS_BALANCE_ERROR_NONZERO");
}

export function validateCap04ForecastRunPayloadV1(payload: Cap04ForecastRunPayloadV1): void {
  if (!payload || typeof payload !== "object") throw new Error("CAP04_FORECAST_PAYLOAD_REQUIRED");
  const issuedAt = canonicalHourV1(payload.issued_at, "CAP04_FORECAST_ISSUED_AT_INVALID");
  for (const field of [
    "source_posterior_ref", "source_posterior_hash", "runtime_config_ref", "runtime_config_hash",
    "crop_stage_context_ref", "crop_stage_context_hash", "future_forcing_pair_policy_id",
    "future_forcing_policy_id", "future_forcing_fallback_policy_id", "forecast_method_id",
    "forecast_method_version", "uncertainty_propagation_method_id", "forecast_interval_method_id",
  ] as const) requiredStringV1(payload[field], `CAP04_FORECAST_${field.toUpperCase()}_REQUIRED`);
  if (payload.baseline_assumption !== CAP04_FORECAST_BASELINE_ASSUMPTION_V1) throw new Error("CAP04_FORECAST_BASELINE_ASSUMPTION_MISMATCH");
  if (!Array.isArray(payload.points) || !Array.isArray(payload.reason_codes) || !Array.isArray(payload.limitations)) throw new Error("CAP04_FORECAST_ARRAYS_REQUIRED");
  if (payload.status === "COMPLETED") {
    if (payload.points.length !== CAP04_FORECAST_POINT_COUNT_V1) throw new Error("CAP04_COMPLETED_FORECAST_REQUIRES_72_POINTS");
    payload.points.forEach((point, index) => validateCap04ForecastPointV1(point, issuedAt, index + 1));
    if (payload.reason_codes.length !== 0) throw new Error("CAP04_COMPLETED_FORECAST_REASON_CODES_FORBIDDEN");
    if (payload.scenario_eligible !== true) throw new Error("CAP04_COMPLETED_FORECAST_SCENARIO_ELIGIBLE_REQUIRED");
    for (const field of ["forcing_window_hash", "forcing_cycle_key", "weather_snapshot_ref", "weather_snapshot_hash", "et0_snapshot_ref", "et0_snapshot_hash"] as const) {
      requiredStringV1(payload[field], `CAP04_COMPLETED_FORECAST_${field.toUpperCase()}_REQUIRED`);
    }
  } else if (payload.status === "BLOCKED") {
    if (payload.points.length !== 0) throw new Error("CAP04_BLOCKED_FORECAST_ZERO_POINTS_REQUIRED");
    if (payload.reason_codes.length === 0 || payload.reason_codes.some((value) => typeof value !== "string" || !value)) throw new Error("CAP04_BLOCKED_FORECAST_REASONS_REQUIRED");
    if (payload.scenario_eligible !== false) throw new Error("CAP04_BLOCKED_FORECAST_SCENARIO_INELIGIBLE");
    for (const field of ["forcing_window_hash", "forcing_cycle_key", "weather_snapshot_ref", "weather_snapshot_hash", "et0_snapshot_ref", "et0_snapshot_hash"] as const) {
      if (payload[field] !== null && (typeof payload[field] !== "string" || !payload[field])) throw new Error(`CAP04_BLOCKED_FORECAST_${field.toUpperCase()}_INVALID`);
    }
  } else {
    throw new Error("CAP04_FORECAST_STATUS_UNKNOWN");
  }
}

export function validateCap04ScenarioOptionV1(
  option: Cap04ScenarioOptionV1,
  sourceForecast: Cap04ForecastRunPayloadV1,
  expectedOptionId: Cap04ScenarioOptionIdV1,
): void {
  if (option.option_id !== expectedOptionId) throw new Error("CAP04_SCENARIO_OPTION_ORDER_MISMATCH");
  for (const field of ["source_forecast_ref", "source_forecast_hash", "source_posterior_ref", "source_posterior_hash", "runtime_config_ref", "runtime_config_hash"] as const) {
    requiredStringV1(option[field], `CAP04_SCENARIO_${field.toUpperCase()}_REQUIRED`);
  }
  if (option.source_posterior_ref !== sourceForecast.source_posterior_ref || option.source_posterior_hash !== sourceForecast.source_posterior_hash) throw new Error("CAP04_SCENARIO_SOURCE_POSTERIOR_MISMATCH");
  if (option.runtime_config_ref !== sourceForecast.runtime_config_ref || option.runtime_config_hash !== sourceForecast.runtime_config_hash) throw new Error("CAP04_SCENARIO_RUNTIME_CONFIG_MISMATCH");
  if (option.epistemic_status !== "ASSUMED" || option.execution_status !== "NOT_EXECUTED") throw new Error("CAP04_SCENARIO_ASSUMPTION_STATUS_MISMATCH");
  if (!Array.isArray(option.trajectory_points) || option.trajectory_points.length !== CAP04_FORECAST_POINT_COUNT_V1) throw new Error("CAP04_SCENARIO_REQUIRES_72_POINTS");
  option.trajectory_points.forEach((point, index) => validateCap04ForecastPointV1(point, sourceForecast.issued_at, index + 1));
  if (option.assumption_basis.scenario_policy_id !== CAP04_SCENARIO_POLICY_ID_V1 || option.assumption_basis.option_id !== option.option_id) throw new Error("CAP04_SCENARIO_ASSUMPTION_BASIS_MISMATCH");
  if ("assumption_ref" in (option as unknown as Record<string, unknown>)) throw new Error("CAP04_DANGLING_ASSUMPTION_REF_FORBIDDEN");
  if (option.option_id === "NO_ACTION") {
    if (option.option_kind !== "NO_ACTION" || option.requested_irrigation_mm !== "0.000000" || option.effective_irrigation_mm !== "0.000000" || option.application_horizon !== null || option.application_interval !== null) throw new Error("CAP04_NO_ACTION_CONTRACT_MISMATCH");
    for (const value of Object.values(option.difference_from_no_action)) {
      if (value !== 0 && value !== "0.000000") throw new Error("CAP04_NO_ACTION_DELTA_NONZERO");
    }
    if (JSON.stringify(option.trajectory_points) !== JSON.stringify(sourceForecast.points)) throw new Error("CAP04_NO_ACTION_TRAJECTORY_NOT_DEEP_COPY_EQUIVALENT");
  } else {
    const expectedRequested = option.option_id === "IRRIGATE_NOW_15MM" ? "15.000000" : "25.000000";
    if (option.option_kind !== "IMMEDIATE_IRRIGATION" || option.requested_irrigation_mm !== expectedRequested || option.application_horizon !== 1 || !option.application_interval) throw new Error("CAP04_IRRIGATION_OPTION_CONTRACT_MISMATCH");
  }
  if (!Array.isArray(option.limitations)) throw new Error("CAP04_SCENARIO_LIMITATIONS_REQUIRED");
}

export function validateCap04ScenarioSetPayloadV1(
  payload: Cap04ScenarioSetEnvelopeV1["payload"],
  sourceForecast: Cap04ForecastRunPayloadV1,
): void {
  if (payload.record_set_contract_id !== CAP04_THREE_SCENARIO_SET_CONTRACT_ID_V1) throw new Error("CAP04_SCENARIO_CONTRACT_ID_MISMATCH");
  if (payload.transaction_variant !== CAP04_B_TRANSACTION_VARIANT_V1) throw new Error("CAP04_SCENARIO_TRANSACTION_VARIANT_MISMATCH");
  if (payload.scenario_policy_id !== CAP04_SCENARIO_POLICY_ID_V1) throw new Error("CAP04_SCENARIO_POLICY_MISMATCH");
  if (sourceForecast.status !== "COMPLETED" || sourceForecast.scenario_eligible !== true || sourceForecast.points.length !== 72) throw new Error("CAP04_SCENARIO_REQUIRES_COMPLETED_FORECAST");
  if (payload.source_posterior_ref !== sourceForecast.source_posterior_ref || payload.source_posterior_hash !== sourceForecast.source_posterior_hash) throw new Error("CAP04_SCENARIO_SET_SOURCE_POSTERIOR_MISMATCH");
  if (payload.runtime_config_ref !== sourceForecast.runtime_config_ref || payload.runtime_config_hash !== sourceForecast.runtime_config_hash) throw new Error("CAP04_SCENARIO_SET_RUNTIME_CONFIG_MISMATCH");
  if (!Array.isArray(payload.options) || payload.options.length !== CAP04_SCENARIO_OPTION_IDS_V1.length) throw new Error("CAP04_SCENARIO_SET_OPTION_COUNT_MISMATCH");
  payload.options.forEach((option, index) => validateCap04ScenarioOptionV1(option, sourceForecast, CAP04_SCENARIO_OPTION_IDS_V1[index]));
  if (!Array.isArray(payload.limitations)) throw new Error("CAP04_SCENARIO_SET_LIMITATIONS_REQUIRED");
}
