// apps/server/src/domain/twin_runtime/external_formal_cap04_forecast_authority_v1.ts
// Purpose: re-canonicalize frozen CAP04 compatibility Forecast results into honest External Formal Forecast authority by rebinding only crop/provenance metadata while preserving the complete 72-point numerical trace.
// Boundary: pure authority adaptation only; no Forecast recomputation, Evidence selection, persistence, database, provider fetch, scheduler, route, Scenario, Recommendation, Action, or O00 execution.

import { semanticHashV1 } from "./canonical_identity_v1.js";
import {
  attachCap04CanonicalCompletedForecastAuthorityV1,
  validateCap04CanonicalForecastRunPayloadV1,
  type Cap04CanonicalBlockedForecastRunPayloadV1,
  type Cap04CanonicalCompletedForecastRunPayloadV1,
} from "./forecast_canonical_authority_v1.js";
import type { Cap04ForecastRunPayloadV1 } from "./forecast_scenario_contracts_v1.js";
import type { Cap04Pure72hForecastMathResultV1 } from "./forecast_math_contracts_v1.js";
import {
  computeCap04ForcingWindowHashV1,
  validateCap04ForecastForcingWindowV1,
  type Cap04ForecastForcingWindowV1,
} from "./future_forcing_contracts_v1.js";
import {
  MCFT_CAP09_EXTERNAL_FORMAL_MODEL_PARAMETER_AUTHORITY_V1,
  MCFT_CAP09_EXTERNAL_FORMAL_RUNTIME_MODE_V1,
  validateExternalFormalRuntimeConfigPayloadV1,
  type ExternalFormalRuntimeConfigPayloadV1,
} from "./external_formal_runtime_config_v1.js";
import type { CanonicalObjectEnvelopeV1 } from "./canonical_object_contracts_v1.js";

export const EXTERNAL_FORMAL_CAP04_FORECAST_AUTHORITY_PROFILE_ID_V1 =
  "MCFT_CAP09_EXTERNAL_FORMAL_CAP04_FORECAST_AUTHORITY_V1" as const;

export type ExternalFormalCompletedForecastAuthorityViewV1 = {
  profile_id: typeof EXTERNAL_FORMAL_CAP04_FORECAST_AUTHORITY_PROFILE_ID_V1;
  forcing_window_candidate: Cap04ForecastForcingWindowV1;
  forecast_candidate: Cap04CanonicalCompletedForecastRunPayloadV1;
  compatibility_numeric_digest: string;
  external_candidate_numeric_digest: string;
  numerical_identity_preserved: true;
  runtime_mode: typeof MCFT_CAP09_EXTERNAL_FORMAL_RUNTIME_MODE_V1;
  model_parameter_authority: typeof MCFT_CAP09_EXTERNAL_FORMAL_MODEL_PARAMETER_AUTHORITY_V1;
  field_calibration_status: "NOT_FIELD_CALIBRATED";
  canonical_persistence_authorized: false;
};

export type ExternalFormalBlockedForecastAuthorityViewV1 = {
  profile_id: typeof EXTERNAL_FORMAL_CAP04_FORECAST_AUTHORITY_PROFILE_ID_V1;
  forecast_candidate: Cap04CanonicalBlockedForecastRunPayloadV1;
  runtime_mode: typeof MCFT_CAP09_EXTERNAL_FORMAL_RUNTIME_MODE_V1;
  model_parameter_authority: typeof MCFT_CAP09_EXTERNAL_FORMAL_MODEL_PARAMETER_AUTHORITY_V1;
  field_calibration_status: "NOT_FIELD_CALIBRATED";
  canonical_persistence_authorized: false;
};

function requiredStringV1(value: unknown, code: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(code);
  return value;
}

function uniqueSortedV1(values: readonly string[]): string[] {
  return [...new Set(values.filter((value) => typeof value === "string" && value.trim()))].sort();
}

function externalLimitationsV1(values: readonly string[], additions: readonly string[] = []): string[] {
  return uniqueSortedV1([
    ...values.filter((value) => ![
      "CONTROLLED_SYNTHETIC",
      "CONTROLLED_REPLAY",
      "CONTROLLED_SYNTHETIC_REPLAY_PROXY",
    ].includes(value)),
    MCFT_CAP09_EXTERNAL_FORMAL_RUNTIME_MODE_V1,
    MCFT_CAP09_EXTERNAL_FORMAL_MODEL_PARAMETER_AUTHORITY_V1,
    "NOT_FIELD_CALIBRATED",
    "EXTERNAL_PUBLIC_RESEARCH_SCOPE",
    "NO_RECOMMENDATION",
    "NO_DECISION",
    "NO_ACTION",
    ...additions,
  ]);
}

function assertNoReplayCanonicalMarkerV1(value: unknown, code: string): void {
  const text = JSON.stringify(value);
  for (const marker of [
    "CONTROLLED_SYNTHETIC_REPLAY_PROXY",
    "CONTROLLED_REPLAY",
    '"runtime_mode":"REPLAY"',
    "field_c8_demo",
  ]) {
    if (text.includes(marker)) throw new Error(`${code}:${marker}`);
  }
}

function externalConfigPayloadV1(
  runtimeConfig: CanonicalObjectEnvelopeV1,
): ExternalFormalRuntimeConfigPayloadV1 {
  if (runtimeConfig.object_type !== "twin_runtime_config_v1") {
    throw new Error("EXTERNAL_CAP04_FORECAST_RUNTIME_CONFIG_OBJECT_TYPE_REQUIRED");
  }
  validateExternalFormalRuntimeConfigPayloadV1(runtimeConfig.payload);
  const payload = runtimeConfig.payload as unknown as ExternalFormalRuntimeConfigPayloadV1;
  if (payload.config_role !== "HOURLY_CAP04") {
    throw new Error("EXTERNAL_CAP04_FORECAST_HOURLY_CONFIG_REQUIRED");
  }
  if (runtimeConfig.logical_time !== payload.effective_logical_time
    || runtimeConfig.as_of !== payload.effective_logical_time) {
    throw new Error("EXTERNAL_CAP04_FORECAST_RUNTIME_CONFIG_TIME_MISMATCH");
  }
  return payload;
}

function numericalDigestV1(payload: Cap04CanonicalCompletedForecastRunPayloadV1): string {
  return semanticHashV1({
    issued_at: payload.issued_at,
    source_posterior_ref: payload.source_posterior_ref,
    source_posterior_hash: payload.source_posterior_hash,
    points: payload.points.map((point) => ({
      horizon_hour: point.horizon_hour,
      target_time: point.target_time,
      determinism_hash: point.determinism_hash,
    })),
    point_traces: payload.point_traces,
    trajectory_hash: payload.trajectory_hash,
    aggregates: payload.aggregates,
    uncertainty_basis: payload.uncertainty_basis,
  });
}

function externalizeForcingWindowV1(
  compatibilityWindow: Cap04ForecastForcingWindowV1,
  runtimeConfig: CanonicalObjectEnvelopeV1,
  external: ExternalFormalRuntimeConfigPayloadV1,
): Cap04ForecastForcingWindowV1 {
  if (compatibilityWindow.logical_time !== external.effective_logical_time) {
    throw new Error("EXTERNAL_CAP04_FORECAST_FORCING_TIME_MISMATCH");
  }
  if (compatibilityWindow.runtime_config_ref !== runtimeConfig.object_id
    || compatibilityWindow.runtime_config_hash !== runtimeConfig.determinism_hash) {
    throw new Error("EXTERNAL_CAP04_FORECAST_FORCING_RUNTIME_CONFIG_MISMATCH");
  }

  const externalCropRef = requiredStringV1(
    external.crop_stage_context_authority.context_ref,
    "EXTERNAL_CAP04_FORECAST_CROP_REF_REQUIRED",
  );
  const externalCropHash = requiredStringV1(
    external.crop_stage_context_authority.context_hash,
    "EXTERNAL_CAP04_FORECAST_CROP_HASH_REQUIRED",
  );
  const points = compatibilityWindow.points.map((point) => ({
    ...structuredClone(point),
    crop_stage_context_ref: externalCropRef,
    crop_stage_context_hash: externalCropHash,
    limitations: externalLimitationsV1(point.limitations, [
      "EXTERNAL_CROP_AUTHORITY_REBOUND_BEFORE_CANONICALIZATION",
    ]),
  }));
  const output: Cap04ForecastForcingWindowV1 = {
    ...structuredClone(compatibilityWindow),
    crop_stage_context_ref: externalCropRef,
    crop_stage_context_hash: externalCropHash,
    points,
    forcing_window_hash: computeCap04ForcingWindowHashV1(points),
  };
  validateCap04ForecastForcingWindowV1(output);
  assertNoReplayCanonicalMarkerV1(output, "EXTERNAL_CAP04_FORECAST_FORCING_REPLAY_LEAKAGE");
  return output;
}

function completedBasePayloadV1(
  compatibility: Cap04CanonicalCompletedForecastRunPayloadV1,
  externalWindow: Cap04ForecastForcingWindowV1,
  external: ExternalFormalRuntimeConfigPayloadV1,
): Cap04ForecastRunPayloadV1 {
  return {
    status: "COMPLETED",
    issued_at: compatibility.issued_at,
    source_posterior_ref: compatibility.source_posterior_ref,
    source_posterior_hash: compatibility.source_posterior_hash,
    runtime_config_ref: compatibility.runtime_config_ref,
    runtime_config_hash: compatibility.runtime_config_hash,
    baseline_assumption: compatibility.baseline_assumption,
    points: structuredClone(compatibility.points),
    reason_codes: [],
    scenario_eligible: true,
    forcing_window_hash: externalWindow.forcing_window_hash,
    forcing_cycle_key: externalWindow.forcing_cycle_key,
    weather_snapshot_ref: externalWindow.weather_snapshot_ref,
    weather_snapshot_hash: externalWindow.weather_snapshot_hash,
    et0_snapshot_ref: externalWindow.et0_snapshot_ref,
    et0_snapshot_hash: externalWindow.et0_snapshot_hash,
    crop_stage_context_ref: external.crop_stage_context_authority.context_ref,
    crop_stage_context_hash: external.crop_stage_context_authority.context_hash,
    future_forcing_pair_policy_id: compatibility.future_forcing_pair_policy_id,
    future_forcing_policy_id: compatibility.future_forcing_policy_id,
    future_forcing_fallback_policy_id: compatibility.future_forcing_fallback_policy_id,
    forecast_method_id: compatibility.forecast_method_id,
    forecast_method_version: compatibility.forecast_method_version,
    uncertainty_propagation_method_id: compatibility.uncertainty_propagation_method_id,
    forecast_interval_method_id: compatibility.forecast_interval_method_id,
    limitations: externalLimitationsV1(compatibility.limitations, [
      "FORECAST_MATH_REUSED_FROM_FROZEN_CAP04_KERNEL",
      "EXTERNAL_CROP_AUTHORITY_REBOUND_BEFORE_CANONICALIZATION",
    ]),
  };
}

export function buildExternalFormalCompletedForecastAuthorityV1(input: {
  compatibility_result: Cap04Pure72hForecastMathResultV1;
  runtime_config: CanonicalObjectEnvelopeV1;
}): ExternalFormalCompletedForecastAuthorityViewV1 {
  const external = externalConfigPayloadV1(input.runtime_config);
  const compatibility = input.compatibility_result.forecast_payload;
  validateCap04CanonicalForecastRunPayloadV1(compatibility);
  if (compatibility.status !== "COMPLETED" || compatibility.forcing_window_authority === null) {
    throw new Error("EXTERNAL_CAP04_FORECAST_COMPLETED_COMPATIBILITY_RESULT_REQUIRED");
  }
  if (compatibility.runtime_config_ref !== input.runtime_config.object_id
    || compatibility.runtime_config_hash !== input.runtime_config.determinism_hash
    || compatibility.issued_at !== external.effective_logical_time) {
    throw new Error("EXTERNAL_CAP04_FORECAST_COMPATIBILITY_CONFIG_MISMATCH");
  }

  const externalWindow = externalizeForcingWindowV1(
    compatibility.forcing_window_authority,
    input.runtime_config,
    external,
  );
  const forecastCandidate = attachCap04CanonicalCompletedForecastAuthorityV1({
    forecast_payload: completedBasePayloadV1(compatibility, externalWindow, external),
    forcing_window: externalWindow,
    point_traces: structuredClone(input.compatibility_result.point_traces),
    trajectory_hash: input.compatibility_result.trajectory_hash,
    aggregates: structuredClone(input.compatibility_result.aggregates),
    uncertainty_basis: structuredClone(input.compatibility_result.uncertainty_basis),
  });
  validateCap04CanonicalForecastRunPayloadV1(forecastCandidate);
  assertNoReplayCanonicalMarkerV1(forecastCandidate, "EXTERNAL_CAP04_FORECAST_CANONICAL_REPLAY_LEAKAGE");

  const compatibilityDigest = numericalDigestV1(compatibility);
  const externalDigest = numericalDigestV1(forecastCandidate);
  if (compatibilityDigest !== externalDigest) {
    throw new Error("EXTERNAL_CAP04_FORECAST_NUMERICAL_IDENTITY_MISMATCH");
  }

  return {
    profile_id: EXTERNAL_FORMAL_CAP04_FORECAST_AUTHORITY_PROFILE_ID_V1,
    forcing_window_candidate: externalWindow,
    forecast_candidate: forecastCandidate,
    compatibility_numeric_digest: compatibilityDigest,
    external_candidate_numeric_digest: externalDigest,
    numerical_identity_preserved: true,
    runtime_mode: MCFT_CAP09_EXTERNAL_FORMAL_RUNTIME_MODE_V1,
    model_parameter_authority: MCFT_CAP09_EXTERNAL_FORMAL_MODEL_PARAMETER_AUTHORITY_V1,
    field_calibration_status: "NOT_FIELD_CALIBRATED",
    canonical_persistence_authorized: false,
  };
}

export function buildExternalFormalBlockedForecastAuthorityV1(input: {
  compatibility_forecast: Cap04CanonicalBlockedForecastRunPayloadV1;
  runtime_config: CanonicalObjectEnvelopeV1;
}): ExternalFormalBlockedForecastAuthorityViewV1 {
  const external = externalConfigPayloadV1(input.runtime_config);
  validateCap04CanonicalForecastRunPayloadV1(input.compatibility_forecast);
  if (input.compatibility_forecast.status !== "BLOCKED") {
    throw new Error("EXTERNAL_CAP04_BLOCKED_FORECAST_REQUIRED");
  }
  if (input.compatibility_forecast.runtime_config_ref !== input.runtime_config.object_id
    || input.compatibility_forecast.runtime_config_hash !== input.runtime_config.determinism_hash
    || input.compatibility_forecast.issued_at !== external.effective_logical_time) {
    throw new Error("EXTERNAL_CAP04_BLOCKED_FORECAST_CONFIG_MISMATCH");
  }
  const candidate: Cap04CanonicalBlockedForecastRunPayloadV1 = {
    ...structuredClone(input.compatibility_forecast),
    crop_stage_context_ref: external.crop_stage_context_authority.context_ref,
    crop_stage_context_hash: external.crop_stage_context_authority.context_hash,
    limitations: externalLimitationsV1(input.compatibility_forecast.limitations, [
      "EXTERNAL_CROP_AUTHORITY_REBOUND_BEFORE_CANONICALIZATION",
    ]),
  };
  validateCap04CanonicalForecastRunPayloadV1(candidate);
  assertNoReplayCanonicalMarkerV1(candidate, "EXTERNAL_CAP04_BLOCKED_FORECAST_CANONICAL_REPLAY_LEAKAGE");
  return {
    profile_id: EXTERNAL_FORMAL_CAP04_FORECAST_AUTHORITY_PROFILE_ID_V1,
    forecast_candidate: candidate,
    runtime_mode: MCFT_CAP09_EXTERNAL_FORMAL_RUNTIME_MODE_V1,
    model_parameter_authority: MCFT_CAP09_EXTERNAL_FORMAL_MODEL_PARAMETER_AUTHORITY_V1,
    field_calibration_status: "NOT_FIELD_CALIBRATED",
    canonical_persistence_authorized: false,
  };
}
