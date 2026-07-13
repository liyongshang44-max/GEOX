// apps/server/src/domain/twin_runtime/scenario_math_contracts_v1.ts
// Purpose: freeze the MCFT-CAP-04 S4 pure three-option Scenario math result, exact NO_ACTION copy, stress/delta aggregates, and deterministic hashes.
// Boundary: pure contracts only; no forcing selection, Forecast recomputation, persistence, canonical append, migration, projection, route, scheduler, filesystem, network, environment, or wall clock.

import { semanticHashV1 } from "./canonical_identity_v1.js";
import {
  CAP04_SCENARIO_OPTION_IDS_V1,
  CAP04_SCENARIO_POLICY_ID_V1,
  validateCap04ForecastRunPayloadV1,
  validateCap04ScenarioSetPayloadV1,
  type Cap04ForecastPointV1,
  type Cap04ForecastRunPayloadV1,
  type Cap04ScenarioOptionIdV1,
  type Cap04ScenarioOptionV1,
  type Cap04ScenarioSetEnvelopeV1,
} from "./forecast_scenario_contracts_v1.js";

export const CAP04_PURE_THREE_SCENARIO_MATH_CONTRACT_ID_V1 = "MCFT_CAP_04_PURE_THREE_SCENARIO_MATH_V1" as const;
export const CAP04_SCENARIO_ACTION_COMPLIANCE_LIMITATION_V1 = "SCENARIO_ACTION_COMPLIANCE_UNCERTAINTY_NOT_MODELED" as const;

export type Cap04PureThreeScenarioMathResultV1 = {
  schema_version: "geox_mcft_cap_04_pure_three_scenario_math_result_v1";
  contract_id: typeof CAP04_PURE_THREE_SCENARIO_MATH_CONTRACT_ID_V1;
  source_forecast_ref: string;
  source_forecast_hash: string;
  source_forecast_math_hash: string;
  source_forecast_payload: Cap04ForecastRunPayloadV1;
  scenario_policy_id: typeof CAP04_SCENARIO_POLICY_ID_V1;
  application_efficiency_basis: {
    component_ref: string;
    policy_id: string;
    value: string;
    parameter_class: "CONTROLLED_SYNTHETIC";
    field_calibration_status: "NOT_FIELD_CALIBRATED";
    runtime_config_ref: string;
    runtime_config_hash: string;
  };
  stress_threshold_basis: {
    component_ref: string;
    policy_id: string;
    value: string;
    comparator: "STRICT_LESS_THAN";
    runtime_config_ref: string;
    runtime_config_hash: string;
  };
  scenario_set_payload: Cap04ScenarioSetEnvelopeV1["payload"];
  option_trajectory_hashes: Record<Cap04ScenarioOptionIdV1, string>;
  option_semantic_hashes: Record<Cap04ScenarioOptionIdV1, string>;
  scenario_math_hash: string;
  limitations: string[];
};

function requiredStringV1(value: unknown, code: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(code);
  return value;
}

function exactDecimal6V1(value: unknown, code: string): string {
  const text = requiredStringV1(value, code);
  if (!/^-?\d+\.\d{6}$/.test(text)) throw new Error(code);
  return text;
}

function decimal6UnitsV1(value: unknown, code: string): bigint {
  const text = exactDecimal6V1(value, code);
  const negative = text.startsWith("-");
  const unsigned = negative ? text.slice(1) : text;
  const [whole, fraction] = unsigned.split(".");
  const units = BigInt(whole) * 1_000_000n + BigInt(fraction);
  return negative ? -units : units;
}

function formatDecimal6V1(value: bigint): string {
  const negative = value < 0n;
  const magnitude = negative ? -value : value;
  const whole = magnitude / 1_000_000n;
  const fraction = String(magnitude % 1_000_000n).padStart(6, "0");
  return `${negative ? "-" : ""}${whole}.${fraction}`;
}

function sortedUniqueV1(values: unknown, code: string): asserts values is string[] {
  if (!Array.isArray(values) || values.some((value) => typeof value !== "string" || !value.trim())) throw new Error(code);
  if (JSON.stringify(values) !== JSON.stringify([...new Set(values)].sort())) throw new Error(code);
}

function addHoursV1(value: string, hours: number): string {
  return new Date(Date.parse(value) + hours * 3_600_000).toISOString();
}

function optionMetricsV1(option: Cap04ScenarioOptionV1, thresholdUnits: bigint): {
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
  let minimumAwfUnits: bigint | null = null;
  let firstStress: string | null = null;
  let stressHours = 0;
  let totalPrecipitation = 0n;
  let totalCropEt = 0n;
  let totalIrrigation = 0n;
  let totalRunoff = 0n;
  let totalDrainage = 0n;
  let totalOverflow = 0n;
  for (const point of option.trajectory_points) {
    const awf = decimal6UnitsV1(point.available_water_fraction, "CAP04_SCENARIO_AWF_INVALID");
    if (minimumAwfUnits === null || awf < minimumAwfUnits) minimumAwfUnits = awf;
    if (awf < thresholdUnits) {
      stressHours += 1;
      if (firstStress === null) firstStress = point.target_time;
    }
    totalPrecipitation += decimal6UnitsV1(point.gross_precipitation_assumption_mm, "CAP04_SCENARIO_PRECIPITATION_INVALID");
    totalCropEt += decimal6UnitsV1(point.actual_crop_et_mm, "CAP04_SCENARIO_CROP_ET_INVALID");
    totalIrrigation += decimal6UnitsV1(point.assumed_irrigation_mm, "CAP04_SCENARIO_IRRIGATION_INVALID");
    totalRunoff += decimal6UnitsV1(point.surface_runoff_mm, "CAP04_SCENARIO_RUNOFF_INVALID");
    totalDrainage += decimal6UnitsV1(point.drainage_mm, "CAP04_SCENARIO_DRAINAGE_INVALID");
    totalOverflow += decimal6UnitsV1(point.saturation_overflow_mm, "CAP04_SCENARIO_OVERFLOW_INVALID");
  }
  return {
    minimumAwf: formatDecimal6V1(minimumAwfUnits ?? 0n),
    firstStress,
    stressHours,
    finalStorage: option.trajectory_points[71].storage_mean_mm,
    totalPrecipitation: formatDecimal6V1(totalPrecipitation),
    totalCropEt: formatDecimal6V1(totalCropEt),
    totalIrrigation: formatDecimal6V1(totalIrrigation),
    totalRunoff: formatDecimal6V1(totalRunoff),
    totalDrainage: formatDecimal6V1(totalDrainage),
    totalOverflow: formatDecimal6V1(totalOverflow),
  };
}

function containsForbiddenScenarioAuthorityKeyV1(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  if (Array.isArray(value)) return value.some(containsForbiddenScenarioAuthorityKeyV1);
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (["assumption_ref", "receipt", "executed_irrigation_candidates", "as_executed_record", "irrigation_execution_evidence"].includes(key.toLowerCase())) return true;
    if (containsForbiddenScenarioAuthorityKeyV1(child)) return true;
  }
  return false;
}

export function computeCap04ScenarioTrajectoryHashV1(points: readonly Cap04ForecastPointV1[]): string {
  return semanticHashV1(points.map((point) => point.determinism_hash));
}

export function computeCap04ScenarioOptionHashV1(option: Cap04ScenarioOptionV1): string {
  return semanticHashV1(option as unknown as Record<string, unknown>);
}

export function computeCap04ScenarioMathHashV1(
  input: Omit<Cap04PureThreeScenarioMathResultV1, "scenario_math_hash">,
): string {
  return semanticHashV1(input as unknown as Record<string, unknown>);
}

export function validateCap04PureThreeScenarioMathResultV1(value: Cap04PureThreeScenarioMathResultV1): void {
  if (!value || typeof value !== "object") throw new Error("CAP04_SCENARIO_MATH_RESULT_REQUIRED");
  if (value.schema_version !== "geox_mcft_cap_04_pure_three_scenario_math_result_v1") throw new Error("CAP04_SCENARIO_MATH_SCHEMA_MISMATCH");
  if (value.contract_id !== CAP04_PURE_THREE_SCENARIO_MATH_CONTRACT_ID_V1) throw new Error("CAP04_SCENARIO_MATH_CONTRACT_MISMATCH");
  for (const field of ["source_forecast_ref", "source_forecast_hash", "source_forecast_math_hash"] as const) requiredStringV1(value[field], `CAP04_SCENARIO_MATH_${field.toUpperCase()}_REQUIRED`);
  validateCap04ForecastRunPayloadV1(value.source_forecast_payload);
  if (value.source_forecast_payload.status !== "COMPLETED" || value.source_forecast_payload.scenario_eligible !== true) throw new Error("CAP04_SCENARIO_MATH_COMPLETED_FORECAST_REQUIRED");
  if (value.scenario_policy_id !== CAP04_SCENARIO_POLICY_ID_V1) throw new Error("CAP04_SCENARIO_MATH_POLICY_MISMATCH");
  exactDecimal6V1(value.application_efficiency_basis.value, "CAP04_SCENARIO_EFFICIENCY_VALUE_INVALID");
  exactDecimal6V1(value.stress_threshold_basis.value, "CAP04_SCENARIO_STRESS_THRESHOLD_INVALID");
  if (value.application_efficiency_basis.parameter_class !== "CONTROLLED_SYNTHETIC" || value.application_efficiency_basis.field_calibration_status !== "NOT_FIELD_CALIBRATED") throw new Error("CAP04_SCENARIO_EFFICIENCY_AUTHORITY_MISMATCH");
  if (value.stress_threshold_basis.comparator !== "STRICT_LESS_THAN") throw new Error("CAP04_SCENARIO_STRESS_COMPARATOR_MISMATCH");
  if (value.application_efficiency_basis.runtime_config_ref !== value.source_forecast_payload.runtime_config_ref
    || value.application_efficiency_basis.runtime_config_hash !== value.source_forecast_payload.runtime_config_hash
    || value.stress_threshold_basis.runtime_config_ref !== value.source_forecast_payload.runtime_config_ref
    || value.stress_threshold_basis.runtime_config_hash !== value.source_forecast_payload.runtime_config_hash) throw new Error("CAP04_SCENARIO_POLICY_CONFIG_IDENTITY_MISMATCH");
  if (value.scenario_set_payload.source_forecast_ref !== value.source_forecast_ref || value.scenario_set_payload.source_forecast_hash !== value.source_forecast_hash) throw new Error("CAP04_SCENARIO_SET_FORECAST_IDENTITY_MISMATCH");
  validateCap04ScenarioSetPayloadV1(value.scenario_set_payload, value.source_forecast_payload);
  if (containsForbiddenScenarioAuthorityKeyV1(value.scenario_set_payload)) throw new Error("CAP04_SCENARIO_FAKE_EXECUTION_AUTHORITY_FORBIDDEN");
  const thresholdUnits = decimal6UnitsV1(value.stress_threshold_basis.value, "CAP04_SCENARIO_STRESS_THRESHOLD_INVALID");
  const options = value.scenario_set_payload.options;
  const noAction = options[0];
  for (let index = 0; index < CAP04_SCENARIO_OPTION_IDS_V1.length; index += 1) {
    const optionId = CAP04_SCENARIO_OPTION_IDS_V1[index];
    const option = options[index];
    if (option.option_id !== optionId) throw new Error("CAP04_SCENARIO_MATH_OPTION_ORDER_MISMATCH");
    const trajectoryHash = computeCap04ScenarioTrajectoryHashV1(option.trajectory_points);
    if (value.option_trajectory_hashes[optionId] !== trajectoryHash) throw new Error("CAP04_SCENARIO_TRAJECTORY_HASH_MISMATCH");
    if (value.option_semantic_hashes[optionId] !== computeCap04ScenarioOptionHashV1(option)) throw new Error("CAP04_SCENARIO_OPTION_HASH_MISMATCH");
    const metrics = optionMetricsV1(option, thresholdUnits);
    if (option.minimum_available_water_fraction !== metrics.minimumAwf
      || option.first_stress_target_time !== metrics.firstStress
      || option.stress_hour_count !== metrics.stressHours
      || option.final_storage_mm !== metrics.finalStorage
      || option.total_precipitation_mm !== metrics.totalPrecipitation
      || option.total_crop_et_mm !== metrics.totalCropEt
      || option.total_irrigation_mm !== metrics.totalIrrigation
      || option.total_runoff_mm !== metrics.totalRunoff
      || option.total_drainage_mm !== metrics.totalDrainage
      || option.total_overflow_mm !== metrics.totalOverflow) throw new Error("CAP04_SCENARIO_AGGREGATE_MISMATCH");
    if (option.assumption_basis.source_forecast_ref !== value.source_forecast_ref || option.assumption_basis.source_forecast_hash !== value.source_forecast_hash) throw new Error("CAP04_SCENARIO_ASSUMPTION_FORECAST_IDENTITY_MISMATCH");
    if (option.assumption_basis.runtime_config_ref !== value.source_forecast_payload.runtime_config_ref || option.assumption_basis.runtime_config_hash !== value.source_forecast_payload.runtime_config_hash) throw new Error("CAP04_SCENARIO_ASSUMPTION_CONFIG_IDENTITY_MISMATCH");
    if (option.application_efficiency_fraction !== value.application_efficiency_basis.value) throw new Error("CAP04_SCENARIO_OPTION_EFFICIENCY_MISMATCH");
    const requested = decimal6UnitsV1(option.requested_irrigation_mm, "CAP04_SCENARIO_REQUESTED_IRRIGATION_INVALID");
    const efficiency = decimal6UnitsV1(option.application_efficiency_fraction, "CAP04_SCENARIO_EFFICIENCY_VALUE_INVALID");
    const expectedEffective = (requested * efficiency + 500_000n) / 1_000_000n;
    if (decimal6UnitsV1(option.effective_irrigation_mm, "CAP04_SCENARIO_EFFECTIVE_IRRIGATION_INVALID") !== expectedEffective) throw new Error("CAP04_SCENARIO_EFFECTIVE_IRRIGATION_MISMATCH");
    if (optionId === "NO_ACTION") {
      if (trajectoryHash !== computeCap04ScenarioTrajectoryHashV1(value.source_forecast_payload.points)) throw new Error("CAP04_NO_ACTION_TRAJECTORY_HASH_MISMATCH");
    } else {
      if (option.application_interval?.interval_start !== value.source_forecast_payload.issued_at || option.application_interval?.interval_end !== addHoursV1(value.source_forecast_payload.issued_at, 1)) throw new Error("CAP04_SCENARIO_APPLICATION_INTERVAL_MISMATCH");
      if (option.trajectory_points[0].assumed_irrigation_mm !== option.effective_irrigation_mm || option.trajectory_points.slice(1).some((point) => point.assumed_irrigation_mm !== "0.000000")) throw new Error("CAP04_SCENARIO_IRRIGATION_HORIZON_MISMATCH");
      if (!option.limitations.includes(CAP04_SCENARIO_ACTION_COMPLIANCE_LIMITATION_V1)) throw new Error("CAP04_SCENARIO_COMPLIANCE_LIMITATION_REQUIRED");
    }
  }
  for (const option of options) {
    const delta = option.difference_from_no_action;
    const expected = {
      final_storage_delta_mm: formatDecimal6V1(decimal6UnitsV1(option.final_storage_mm, "CAP04_SCENARIO_FINAL_STORAGE_INVALID") - decimal6UnitsV1(noAction.final_storage_mm, "CAP04_SCENARIO_BASELINE_FINAL_STORAGE_INVALID")),
      minimum_awf_delta: formatDecimal6V1(decimal6UnitsV1(option.minimum_available_water_fraction, "CAP04_SCENARIO_MIN_AWF_INVALID") - decimal6UnitsV1(noAction.minimum_available_water_fraction, "CAP04_SCENARIO_BASELINE_MIN_AWF_INVALID")),
      stress_hour_count_delta: option.stress_hour_count - noAction.stress_hour_count,
      total_irrigation_delta_mm: formatDecimal6V1(decimal6UnitsV1(option.total_irrigation_mm, "CAP04_SCENARIO_TOTAL_IRRIGATION_INVALID") - decimal6UnitsV1(noAction.total_irrigation_mm, "CAP04_SCENARIO_BASELINE_TOTAL_IRRIGATION_INVALID")),
      total_drainage_delta_mm: formatDecimal6V1(decimal6UnitsV1(option.total_drainage_mm, "CAP04_SCENARIO_TOTAL_DRAINAGE_INVALID") - decimal6UnitsV1(noAction.total_drainage_mm, "CAP04_SCENARIO_BASELINE_TOTAL_DRAINAGE_INVALID")),
      total_overflow_delta_mm: formatDecimal6V1(decimal6UnitsV1(option.total_overflow_mm, "CAP04_SCENARIO_TOTAL_OVERFLOW_INVALID") - decimal6UnitsV1(noAction.total_overflow_mm, "CAP04_SCENARIO_BASELINE_TOTAL_OVERFLOW_INVALID")),
    };
    if (JSON.stringify(delta) !== JSON.stringify(expected)) throw new Error("CAP04_SCENARIO_DELTA_MISMATCH");
  }
  sortedUniqueV1(value.limitations, "CAP04_SCENARIO_MATH_LIMITATIONS_INVALID");
  sortedUniqueV1(value.scenario_set_payload.limitations, "CAP04_SCENARIO_SET_LIMITATIONS_INVALID");
  const hashBasis = structuredClone(value) as Partial<Cap04PureThreeScenarioMathResultV1>;
  delete hashBasis.scenario_math_hash;
  if (value.scenario_math_hash !== computeCap04ScenarioMathHashV1(hashBasis as Omit<Cap04PureThreeScenarioMathResultV1, "scenario_math_hash">)) throw new Error("CAP04_SCENARIO_MATH_HASH_MISMATCH");
}
