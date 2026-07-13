// apps/server/src/domain/twin_runtime/future_forcing_contracts_v1.ts
// Purpose: freeze the CAP-04 coherent weather/ET0 forcing-cycle identity, exact 72-point Forecast forcing DTO, deterministic window hash, and no-future-leakage validation.
// Boundary: pure contracts and validation only; no Evidence loading, pair selection, persistence, Forecast equations, Scenario equations, filesystem, network, environment, or wall clock.

import { semanticHashV1 } from "./canonical_identity_v1.js";
import {
  validateContinuationScopeV1,
  type ContinuationScopeV1,
} from "./continuation_operation_identity_v1.js";
import {
  CAP04_FUTURE_FORCING_FALLBACK_POLICY_ID_V1,
  CAP04_FUTURE_FORCING_FRESHNESS_POLICY_ID_V1,
  CAP04_FUTURE_FORCING_PAIR_POLICY_ID_V1,
  CAP04_FUTURE_FORCING_POLICY_ID_V1,
} from "./forecast_scenario_runtime_config_v1.js";

export const CAP04_FUTURE_FORCING_POINT_COUNT_V1 = 72 as const;
export const CAP04_FUTURE_FORCING_STEP_HOURS_V1 = 1 as const;
export const CAP04_FUTURE_FORCING_BLOCK_REASON_V1 = "NO_COMPLETE_MATCHING_FORCING_CYCLE" as const;
export const CAP04_FUTURE_FORCING_SELECTION_POLICY_ID_V1 =
  "FORECAST_AT_T_SELECTS_LATEST_AVAILABLE_MATCHING_FORCING_CYCLE" as const;

export type Cap04ForcingCycleBasisV1 = {
  scope: ContinuationScopeV1;
  issued_at: string;
  available_to_runtime_at: string;
  valid_from: string;
  valid_to: string;
};

export type Cap04ForecastForcingPointV1 = {
  horizon_hour: number;
  interval_start: string;
  interval_end: string;
  target_time: string;
  forcing_cycle_key: string;
  precipitation_assumption_mm: number;
  precipitation_snapshot_ref: string;
  precipitation_snapshot_hash: string;
  precipitation_issued_at: string;
  precipitation_available_to_runtime_at: string;
  precipitation_epistemic_status: "ASSUMED";
  et0_assumption_mm: number;
  et0_snapshot_ref: string;
  et0_snapshot_hash: string;
  et0_issued_at: string;
  et0_available_to_runtime_at: string;
  et0_epistemic_status: "ASSUMED";
  crop_stage_context_ref: string;
  crop_stage_context_hash: string;
  crop_stage_code: string;
  kc: number;
  runtime_config_ref: string;
  runtime_config_hash: string;
  transformation_refs: string[];
  limitations: string[];
};

export type Cap04ForecastForcingWindowV1 = {
  contract_id: "MCFT_CAP_04_FUTURE_FORCING_WINDOW_V1";
  logical_time: string;
  selection_policy_id: typeof CAP04_FUTURE_FORCING_SELECTION_POLICY_ID_V1;
  future_forcing_pair_policy_id: typeof CAP04_FUTURE_FORCING_PAIR_POLICY_ID_V1;
  future_forcing_policy_id: typeof CAP04_FUTURE_FORCING_POLICY_ID_V1;
  future_forcing_fallback_policy_id: typeof CAP04_FUTURE_FORCING_FALLBACK_POLICY_ID_V1;
  future_forcing_freshness_policy_id: typeof CAP04_FUTURE_FORCING_FRESHNESS_POLICY_ID_V1;
  forcing_cycle_key: string;
  forcing_cycle_basis: Cap04ForcingCycleBasisV1;
  weather_snapshot_ref: string;
  weather_snapshot_hash: string;
  weather_snapshot_issued_at: string;
  weather_snapshot_available_to_runtime_at: string;
  et0_snapshot_ref: string;
  et0_snapshot_hash: string;
  et0_snapshot_issued_at: string;
  et0_snapshot_available_to_runtime_at: string;
  crop_stage_context_ref: string;
  crop_stage_context_hash: string;
  crop_stage_code: string;
  kc: number;
  runtime_config_ref: string;
  runtime_config_hash: string;
  evidence_refs: string[];
  points: Cap04ForecastForcingPointV1[];
  forcing_window_hash: string;
};

export type Cap04FutureForcingSelectionTraceV1 = {
  candidate_snapshot_count: number;
  eligible_snapshot_count: number;
  collapsed_snapshot_count: number;
  matching_pair_count: number;
  excluded_reason_counts: Record<string, number>;
};

export type Cap04FutureForcingSelectionResultV1 =
  | {
      status: "SELECTED";
      window: Cap04ForecastForcingWindowV1;
      trace: Cap04FutureForcingSelectionTraceV1;
    }
  | {
      status: "BLOCKED";
      reason_codes: [typeof CAP04_FUTURE_FORCING_BLOCK_REASON_V1];
      trace: Cap04FutureForcingSelectionTraceV1;
    };

function requiredStringV1(value: unknown, code: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(code);
  return value;
}

function recordV1(value: unknown, code: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(code);
  return value as Record<string, unknown>;
}

function canonicalIsoV1(value: unknown, code: string): string {
  const text = requiredStringV1(value, code);
  const parsed = Date.parse(text);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== text) throw new Error(code);
  return text;
}

function canonicalHourV1(value: unknown, code: string): string {
  const text = canonicalIsoV1(value, code);
  if (!text.endsWith(":00:00.000Z")) throw new Error(code);
  return text;
}

function addHoursV1(value: string, hours: number): string {
  return new Date(Date.parse(value) + hours * 60 * 60 * 1000).toISOString();
}

function nonNegativeNumberV1(value: unknown, code: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) throw new Error(code);
  return value;
}

function exactScopeV1(actual: ContinuationScopeV1, expected: ContinuationScopeV1, code: string): void {
  for (const field of ["tenant_id", "project_id", "group_id", "field_id", "season_id", "zone_id"] as const) {
    if (actual[field] !== expected[field]) throw new Error(code);
  }
}

function validateSortedUniqueStringsV1(value: unknown, code: string): asserts value is string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || !item.trim())) throw new Error(code);
  const canonical = [...new Set(value)].sort();
  if (JSON.stringify(value) !== JSON.stringify(canonical)) throw new Error(code);
}

export function validateCap04ForcingCycleBasisV1(value: unknown): asserts value is Cap04ForcingCycleBasisV1 {
  const basis = recordV1(value, "CAP04_FORCING_CYCLE_BASIS_REQUIRED");
  validateContinuationScopeV1(basis.scope as ContinuationScopeV1);
  canonicalIsoV1(basis.issued_at, "CAP04_FORCING_ISSUED_AT_INVALID");
  canonicalIsoV1(basis.available_to_runtime_at, "CAP04_FORCING_AVAILABLE_AT_INVALID");
  canonicalHourV1(basis.valid_from, "CAP04_FORCING_VALID_FROM_INVALID");
  canonicalHourV1(basis.valid_to, "CAP04_FORCING_VALID_TO_INVALID");
  if (Date.parse(String(basis.valid_to)) <= Date.parse(String(basis.valid_from))) throw new Error("CAP04_FORCING_VALID_RANGE_INVALID");
}

export function deriveCap04ForcingCycleKeyV1(basis: Cap04ForcingCycleBasisV1): string {
  validateCap04ForcingCycleBasisV1(basis);
  return `ffcycle_${semanticHashV1(basis).slice(7, 31)}`;
}

export function computeCap04ForcingWindowHashV1(points: readonly Cap04ForecastForcingPointV1[]): string {
  return semanticHashV1(points);
}

export function validateCap04ForecastForcingPointV1(
  value: unknown,
  expected: {
    logical_time: string;
    horizon_hour: number;
    forcing_cycle_key: string;
    weather_snapshot_ref: string;
    weather_snapshot_hash: string;
    weather_snapshot_issued_at: string;
    weather_snapshot_available_to_runtime_at: string;
    et0_snapshot_ref: string;
    et0_snapshot_hash: string;
    et0_snapshot_issued_at: string;
    et0_snapshot_available_to_runtime_at: string;
    crop_stage_context_ref: string;
    crop_stage_context_hash: string;
    crop_stage_code: string;
    kc: number;
    runtime_config_ref: string;
    runtime_config_hash: string;
  },
): asserts value is Cap04ForecastForcingPointV1 {
  const point = recordV1(value, "CAP04_FORCING_POINT_REQUIRED");
  if (point.horizon_hour !== expected.horizon_hour) throw new Error("CAP04_FORCING_HORIZON_MISMATCH");
  const intervalStart = addHoursV1(expected.logical_time, expected.horizon_hour - 1);
  const intervalEnd = addHoursV1(expected.logical_time, expected.horizon_hour);
  if (point.interval_start !== intervalStart || point.interval_end !== intervalEnd || point.target_time !== intervalEnd) throw new Error("CAP04_FORCING_POINT_TIME_MISMATCH");
  if (point.forcing_cycle_key !== expected.forcing_cycle_key) throw new Error("CAP04_FORCING_POINT_CYCLE_KEY_MISMATCH");
  if (point.precipitation_snapshot_ref !== expected.weather_snapshot_ref || point.precipitation_snapshot_hash !== expected.weather_snapshot_hash) throw new Error("CAP04_FORCING_POINT_WEATHER_IDENTITY_MISMATCH");
  if (point.precipitation_issued_at !== expected.weather_snapshot_issued_at || point.precipitation_available_to_runtime_at !== expected.weather_snapshot_available_to_runtime_at) throw new Error("CAP04_FORCING_POINT_WEATHER_TIME_MISMATCH");
  if (point.precipitation_epistemic_status !== "ASSUMED") throw new Error("CAP04_FORCING_POINT_WEATHER_EPISTEMIC_MISMATCH");
  nonNegativeNumberV1(point.precipitation_assumption_mm, "CAP04_FORCING_PRECIPITATION_INVALID");
  if (point.et0_snapshot_ref !== expected.et0_snapshot_ref || point.et0_snapshot_hash !== expected.et0_snapshot_hash) throw new Error("CAP04_FORCING_POINT_ET0_IDENTITY_MISMATCH");
  if (point.et0_issued_at !== expected.et0_snapshot_issued_at || point.et0_available_to_runtime_at !== expected.et0_snapshot_available_to_runtime_at) throw new Error("CAP04_FORCING_POINT_ET0_TIME_MISMATCH");
  if (point.et0_epistemic_status !== "ASSUMED") throw new Error("CAP04_FORCING_POINT_ET0_EPISTEMIC_MISMATCH");
  nonNegativeNumberV1(point.et0_assumption_mm, "CAP04_FORCING_ET0_INVALID");
  if (point.crop_stage_context_ref !== expected.crop_stage_context_ref || point.crop_stage_context_hash !== expected.crop_stage_context_hash || point.crop_stage_code !== expected.crop_stage_code || point.kc !== expected.kc) throw new Error("CAP04_FORCING_POINT_CROP_STAGE_MISMATCH");
  if (point.runtime_config_ref !== expected.runtime_config_ref || point.runtime_config_hash !== expected.runtime_config_hash) throw new Error("CAP04_FORCING_POINT_CONFIG_MISMATCH");
  validateSortedUniqueStringsV1(point.transformation_refs, "CAP04_FORCING_POINT_TRANSFORMATION_REFS_INVALID");
  validateSortedUniqueStringsV1(point.limitations, "CAP04_FORCING_POINT_LIMITATIONS_INVALID");
}

export function validateCap04ForecastForcingWindowV1(value: unknown): asserts value is Cap04ForecastForcingWindowV1 {
  const window = recordV1(value, "CAP04_FORCING_WINDOW_REQUIRED");
  if (window.contract_id !== "MCFT_CAP_04_FUTURE_FORCING_WINDOW_V1") throw new Error("CAP04_FORCING_WINDOW_CONTRACT_MISMATCH");
  const logicalTime = canonicalHourV1(window.logical_time, "CAP04_FORCING_LOGICAL_TIME_INVALID");
  if (window.selection_policy_id !== CAP04_FUTURE_FORCING_SELECTION_POLICY_ID_V1) throw new Error("CAP04_FORCING_SELECTION_POLICY_MISMATCH");
  if (window.future_forcing_pair_policy_id !== CAP04_FUTURE_FORCING_PAIR_POLICY_ID_V1) throw new Error("CAP04_FORCING_PAIR_POLICY_MISMATCH");
  if (window.future_forcing_policy_id !== CAP04_FUTURE_FORCING_POLICY_ID_V1) throw new Error("CAP04_FORCING_POLICY_MISMATCH");
  if (window.future_forcing_fallback_policy_id !== CAP04_FUTURE_FORCING_FALLBACK_POLICY_ID_V1) throw new Error("CAP04_FORCING_FALLBACK_POLICY_MISMATCH");
  if (window.future_forcing_freshness_policy_id !== CAP04_FUTURE_FORCING_FRESHNESS_POLICY_ID_V1) throw new Error("CAP04_FORCING_FRESHNESS_POLICY_MISMATCH");
  validateCap04ForcingCycleBasisV1(window.forcing_cycle_basis);
  const basis = window.forcing_cycle_basis as Cap04ForcingCycleBasisV1;
  if (basis.valid_from !== logicalTime || basis.valid_to !== addHoursV1(logicalTime, CAP04_FUTURE_FORCING_POINT_COUNT_V1)) throw new Error("CAP04_FORCING_WINDOW_COVERAGE_MISMATCH");
  if (Date.parse(basis.issued_at) > Date.parse(logicalTime) || Date.parse(basis.available_to_runtime_at) > Date.parse(logicalTime)) throw new Error("CAP04_FORCING_FUTURE_LEAKAGE_FORBIDDEN");
  if (window.forcing_cycle_key !== deriveCap04ForcingCycleKeyV1(basis)) throw new Error("CAP04_FORCING_CYCLE_KEY_MISMATCH");
  const weatherRef = requiredStringV1(window.weather_snapshot_ref, "CAP04_WEATHER_SNAPSHOT_REF_REQUIRED");
  const weatherHash = requiredStringV1(window.weather_snapshot_hash, "CAP04_WEATHER_SNAPSHOT_HASH_REQUIRED");
  const weatherIssued = canonicalIsoV1(window.weather_snapshot_issued_at, "CAP04_WEATHER_ISSUED_AT_INVALID");
  const weatherAvailable = canonicalIsoV1(window.weather_snapshot_available_to_runtime_at, "CAP04_WEATHER_AVAILABLE_AT_INVALID");
  const et0Ref = requiredStringV1(window.et0_snapshot_ref, "CAP04_ET0_SNAPSHOT_REF_REQUIRED");
  const et0Hash = requiredStringV1(window.et0_snapshot_hash, "CAP04_ET0_SNAPSHOT_HASH_REQUIRED");
  const et0Issued = canonicalIsoV1(window.et0_snapshot_issued_at, "CAP04_ET0_ISSUED_AT_INVALID");
  const et0Available = canonicalIsoV1(window.et0_snapshot_available_to_runtime_at, "CAP04_ET0_AVAILABLE_AT_INVALID");
  if (weatherIssued !== basis.issued_at || et0Issued !== basis.issued_at || weatherAvailable !== basis.available_to_runtime_at || et0Available !== basis.available_to_runtime_at) throw new Error("CAP04_FORCING_PAIR_TIME_MISMATCH");
  const cropStageRef = requiredStringV1(window.crop_stage_context_ref, "CAP04_CROP_STAGE_REF_REQUIRED");
  const cropStageHash = requiredStringV1(window.crop_stage_context_hash, "CAP04_CROP_STAGE_HASH_REQUIRED");
  const cropStageCode = requiredStringV1(window.crop_stage_code, "CAP04_CROP_STAGE_CODE_REQUIRED");
  const kc = nonNegativeNumberV1(window.kc, "CAP04_CROP_STAGE_KC_INVALID");
  const runtimeConfigRef = requiredStringV1(window.runtime_config_ref, "CAP04_RUNTIME_CONFIG_REF_REQUIRED");
  const runtimeConfigHash = requiredStringV1(window.runtime_config_hash, "CAP04_RUNTIME_CONFIG_HASH_REQUIRED");
  validateSortedUniqueStringsV1(window.evidence_refs, "CAP04_FORCING_EVIDENCE_REFS_INVALID");
  const expectedEvidenceRefs = [...new Set([weatherRef, et0Ref])].sort();
  if (JSON.stringify(window.evidence_refs) !== JSON.stringify(expectedEvidenceRefs)) throw new Error("CAP04_FORCING_EVIDENCE_REFS_MISMATCH");
  if (!Array.isArray(window.points) || window.points.length !== CAP04_FUTURE_FORCING_POINT_COUNT_V1) throw new Error("CAP04_FORCING_POINT_COUNT_MISMATCH");
  for (let index = 0; index < window.points.length; index += 1) {
    validateCap04ForecastForcingPointV1(window.points[index], {
      logical_time: logicalTime,
      horizon_hour: index + 1,
      forcing_cycle_key: String(window.forcing_cycle_key),
      weather_snapshot_ref: weatherRef,
      weather_snapshot_hash: weatherHash,
      weather_snapshot_issued_at: weatherIssued,
      weather_snapshot_available_to_runtime_at: weatherAvailable,
      et0_snapshot_ref: et0Ref,
      et0_snapshot_hash: et0Hash,
      et0_snapshot_issued_at: et0Issued,
      et0_snapshot_available_to_runtime_at: et0Available,
      crop_stage_context_ref: cropStageRef,
      crop_stage_context_hash: cropStageHash,
      crop_stage_code: cropStageCode,
      kc,
      runtime_config_ref: runtimeConfigRef,
      runtime_config_hash: runtimeConfigHash,
    });
  }
  if (window.forcing_window_hash !== computeCap04ForcingWindowHashV1(window.points as Cap04ForecastForcingPointV1[])) throw new Error("CAP04_FORCING_WINDOW_HASH_MISMATCH");
  exactScopeV1(basis.scope, basis.scope, "CAP04_FORCING_SCOPE_MISMATCH");
}
