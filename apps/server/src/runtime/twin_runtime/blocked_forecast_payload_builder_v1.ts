// apps/server/src/runtime/twin_runtime/blocked_forecast_payload_builder_v1.ts
// Purpose: construct the legal canonical CAP-04 BLOCKED Forecast payload used by A2 when no complete matching Future Forcing pair is available.
// Boundary: pure construction and validation only; no Evidence selection, State math, persistence, projection, route, scheduler, filesystem, network, environment, or wall clock.

import {
  CAP04_CANONICAL_FORECAST_AUTHORITY_CONTRACT_ID_V1,
  validateCap04CanonicalForecastRunPayloadV1,
  type Cap04CanonicalBlockedForecastRunPayloadV1,
} from "../../domain/twin_runtime/forecast_canonical_authority_v1.js";
import { CAP04_FORECAST_BASELINE_ASSUMPTION_V1 } from "../../domain/twin_runtime/forecast_scenario_contracts_v1.js";
import {
  validateCap04RuntimeConfigPayloadV1,
  type Cap04RuntimeConfigPayloadV1,
} from "../../domain/twin_runtime/forecast_scenario_runtime_config_v1.js";

export type BuildCap04BlockedForecastPayloadInputV1 = {
  issued_at: string;
  source_posterior_ref: string;
  source_posterior_hash: string;
  runtime_config_ref: string;
  runtime_config_hash: string;
  runtime_config_payload: Cap04RuntimeConfigPayloadV1;
  reason_codes: readonly string[];
  limitations?: readonly string[];
};

function requiredStringV1(value: unknown, code: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(code);
  return value;
}

function canonicalHourV1(value: unknown, code: string): string {
  const text = requiredStringV1(value, code);
  const parsed = Date.parse(text);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== text || !text.endsWith(":00:00.000Z")) throw new Error(code);
  return text;
}

function sortedUniqueV1(values: readonly string[], code: string): string[] {
  if (!Array.isArray(values) || values.some((value) => typeof value !== "string" || !value.trim())) throw new Error(code);
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

export function buildCap04BlockedForecastPayloadV1(
  input: BuildCap04BlockedForecastPayloadInputV1,
): Cap04CanonicalBlockedForecastRunPayloadV1 {
  const issuedAt = canonicalHourV1(input.issued_at, "CAP04_BLOCKED_FORECAST_ISSUED_AT_INVALID");
  const sourcePosteriorRef = requiredStringV1(input.source_posterior_ref, "CAP04_BLOCKED_FORECAST_SOURCE_POSTERIOR_REF_REQUIRED");
  const sourcePosteriorHash = requiredStringV1(input.source_posterior_hash, "CAP04_BLOCKED_FORECAST_SOURCE_POSTERIOR_HASH_REQUIRED");
  const runtimeConfigRef = requiredStringV1(input.runtime_config_ref, "CAP04_BLOCKED_FORECAST_RUNTIME_CONFIG_REF_REQUIRED");
  const runtimeConfigHash = requiredStringV1(input.runtime_config_hash, "CAP04_BLOCKED_FORECAST_RUNTIME_CONFIG_HASH_REQUIRED");
  validateCap04RuntimeConfigPayloadV1(input.runtime_config_payload);
  const config = input.runtime_config_payload;
  if (config.effective_logical_time !== issuedAt) throw new Error("CAP04_BLOCKED_FORECAST_CONFIG_EFFECTIVE_TIME_MISMATCH");
  const reasonCodes = sortedUniqueV1(input.reason_codes, "CAP04_BLOCKED_FORECAST_REASON_CODES_INVALID");
  if (reasonCodes.length === 0) throw new Error("CAP04_BLOCKED_FORECAST_REASON_CODES_REQUIRED");
  const limitations = sortedUniqueV1([
    "FORECAST_BLOCKED",
    "NO_COMPLETE_MATCHING_FORCING_CYCLE",
    "NOT_DECISION",
    "NOT_RECOMMENDATION",
    ...(input.limitations ?? []),
  ], "CAP04_BLOCKED_FORECAST_LIMITATIONS_INVALID");
  const payload: Cap04CanonicalBlockedForecastRunPayloadV1 = {
    status: "BLOCKED",
    issued_at: issuedAt,
    source_posterior_ref: sourcePosteriorRef,
    source_posterior_hash: sourcePosteriorHash,
    runtime_config_ref: runtimeConfigRef,
    runtime_config_hash: runtimeConfigHash,
    baseline_assumption: CAP04_FORECAST_BASELINE_ASSUMPTION_V1,
    points: [],
    reason_codes: reasonCodes,
    scenario_eligible: false,
    forcing_window_hash: null,
    forcing_cycle_key: null,
    weather_snapshot_ref: null,
    weather_snapshot_hash: null,
    et0_snapshot_ref: null,
    et0_snapshot_hash: null,
    crop_stage_context_ref: config.crop_stage_context.context_ref,
    crop_stage_context_hash: config.crop_stage_context.context_hash,
    future_forcing_pair_policy_id: config.future_forcing_pair_policy_id,
    future_forcing_policy_id: config.future_forcing_policy_id,
    future_forcing_fallback_policy_id: config.future_forcing_fallback_policy_id,
    forecast_method_id: config.forecast_method_id,
    forecast_method_version: config.forecast_method_version,
    uncertainty_propagation_method_id: config.uncertainty_propagation_method_id,
    forecast_interval_method_id: config.forecast_interval_method_id,
    limitations,
    canonical_authority_contract_id: CAP04_CANONICAL_FORECAST_AUTHORITY_CONTRACT_ID_V1,
    forcing_window_authority: null,
    point_traces: [],
    trajectory_hash: null,
    aggregates: null,
    uncertainty_basis: null,
  };
  validateCap04CanonicalForecastRunPayloadV1(payload);
  return payload;
}
