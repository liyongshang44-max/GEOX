// apps/server/src/runtime/twin_runtime/external_formal_cap04_input_authority_v1.ts
// Purpose: fail closed unless one caller-supplied CAP04 tick is bound to the exact Amendment-05 External scope, five-source authority profile, and External crop-context authority before any frozen compatibility kernel is invoked.
// Boundary: pure validation/resolution only; no State math, Forecast math, canonical persistence, database, provider fetch, scheduler, route, wall clock, recommendation, action, or O00 execution.

import {
  MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1,
  validateExternalFormalRuntimeConfigPayloadV1,
  type ExternalFormalRuntimeConfigPayloadV1,
} from "../../domain/twin_runtime/external_formal_runtime_config_v1.js";
import {
  MCFT_CAP09_EXTERNAL_FORMAL_FUTURE_ET0_BINDING_ID_V1,
  MCFT_CAP09_EXTERNAL_FORMAL_FUTURE_WEATHER_BINDING_ID_V1,
  MCFT_CAP09_EXTERNAL_FORMAL_HISTORICAL_ET0_BINDING_ID_V1,
  MCFT_CAP09_EXTERNAL_FORMAL_RAINFALL_BINDING_ID_V1,
  MCFT_CAP09_EXTERNAL_FORMAL_SOIL_BINDING_ID_V1,
} from "../../domain/twin_runtime/external_formal_evidence_binding_profile_v1.js";
import {
  validateCanonicalObjectV1,
  type CanonicalObjectEnvelopeV1,
} from "../../domain/twin_runtime/canonical_object_contracts_v1.js";
import {
  resolveContinuationCropStageContextV1,
  type ContinuationCropStageConfigurationContextV1,
  type ResolvedContinuationCropStageContextV1,
} from "./continuation_evidence_window_service_v1.js";
import type {
  CanonicalReplayEvidenceRecordV1,
  TwinScopeKeyV1,
} from "./ports.js";

export const EXTERNAL_FORMAL_CAP04_INPUT_AUTHORITY_PROFILE_ID_V1 =
  "MCFT_CAP09_EXTERNAL_FORMAL_CAP04_INPUT_AUTHORITY_V1" as const;

export type ExternalFormalCap04InputAuthorityV1 = {
  profile_id: typeof EXTERNAL_FORMAL_CAP04_INPUT_AUTHORITY_PROFILE_ID_V1;
  runtime_config_ref: string;
  runtime_config_hash: string;
  logical_time: string;
  scope: TwinScopeKeyV1;
  resolved_crop_stage_context: ResolvedContinuationCropStageContextV1;
  binding_cardinality: {
    soil: number;
    rainfall: number;
    historical_et0: number;
    future_weather: number;
    future_et0: number;
  };
  exact_five_binding_profile_enforced: true;
  commercial_operation_evidence_forbidden: true;
  canonical_persistence_authorized: false;
};

type ScopeLikeV1 = {
  tenant_id: string;
  project_id: string;
  group_id: string | null;
  field_id: string;
  season_id: string | null;
  zone_id: string | null;
};

type EvidenceAuthorityV1 = {
  binding_id: string;
  epistemic_class: string;
  count_key: keyof ExternalFormalCap04InputAuthorityV1["binding_cardinality"];
};

const AUTHORITY_BY_RECORD_TYPE_V1: Readonly<Record<string, EvidenceAuthorityV1>> = {
  soil_moisture_observation_v1: {
    binding_id: MCFT_CAP09_EXTERNAL_FORMAL_SOIL_BINDING_ID_V1,
    epistemic_class: "OBSERVED",
    count_key: "soil",
  },
  observed_rainfall_v1: {
    binding_id: MCFT_CAP09_EXTERNAL_FORMAL_RAINFALL_BINDING_ID_V1,
    epistemic_class: "OBSERVED",
    count_key: "rainfall",
  },
  historical_et0_estimate_v1: {
    binding_id: MCFT_CAP09_EXTERNAL_FORMAL_HISTORICAL_ET0_BINDING_ID_V1,
    epistemic_class: "ESTIMATED",
    count_key: "historical_et0",
  },
  future_weather_assumption_v1: {
    binding_id: MCFT_CAP09_EXTERNAL_FORMAL_FUTURE_WEATHER_BINDING_ID_V1,
    epistemic_class: "ASSUMED",
    count_key: "future_weather",
  },
  future_et0_assumption_v1: {
    binding_id: MCFT_CAP09_EXTERNAL_FORMAL_FUTURE_ET0_BINDING_ID_V1,
    epistemic_class: "ASSUMED",
    count_key: "future_et0",
  },
};

const FORBIDDEN_OPERATION_RECORD_TYPES_V1 = new Set([
  "approved_irrigation_plan_snapshot_v1",
  "irrigation_execution_evidence_v1",
]);

function requiredStringV1(value: unknown, code: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(code);
  return value;
}

function canonicalHourV1(value: unknown, code: string): string {
  const text = requiredStringV1(value, code);
  const parsed = Date.parse(text);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== text || !text.endsWith(":00:00.000Z")) {
    throw new Error(code);
  }
  return text;
}

function exactScopeV1(actual: ScopeLikeV1, expected: TwinScopeKeyV1, code: string): void {
  for (const field of ["tenant_id", "project_id", "group_id", "field_id", "season_id", "zone_id"] as const) {
    if (actual[field] !== expected[field]) throw new Error(`${code}:${field}`);
  }
}

function exactExternalScopeV1(scope: TwinScopeKeyV1): void {
  exactScopeV1(scope, { ...MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1 }, "EXTERNAL_CAP04_INPUT_SCOPE_MISMATCH");
}

function assertNoReplayAuthorityMarkerV1(value: unknown, code: string): void {
  const text = JSON.stringify(value);
  for (const marker of [
    "CONTROLLED_SYNTHETIC_REPLAY_PROXY",
    "CONTROLLED_REPLAY",
    "runtime_mode\":\"REPLAY",
  ]) {
    if (text.includes(marker)) throw new Error(`${code}:${marker}`);
  }
}

function validateEvidenceRecordV1(
  record: CanonicalReplayEvidenceRecordV1,
  scope: TwinScopeKeyV1,
  counts: ExternalFormalCap04InputAuthorityV1["binding_cardinality"],
): void {
  if (FORBIDDEN_OPERATION_RECORD_TYPES_V1.has(record.record_type)) {
    throw new Error(`EXTERNAL_CAP04_COMMERCIAL_OPERATION_EVIDENCE_FORBIDDEN:${record.record_type}`);
  }

  const authority = AUTHORITY_BY_RECORD_TYPE_V1[record.record_type];
  if (!authority) return;

  exactScopeV1(record, scope, `EXTERNAL_CAP04_EVIDENCE_SCOPE_MISMATCH:${record.record_type}`);
  if (record.binding_id !== authority.binding_id) {
    throw new Error(`EXTERNAL_CAP04_EVIDENCE_BINDING_MISMATCH:${record.record_type}`);
  }
  if (record.epistemic_class !== authority.epistemic_class) {
    throw new Error(`EXTERNAL_CAP04_EVIDENCE_EPISTEMIC_CLASS_MISMATCH:${record.record_type}`);
  }
  if (record.quality?.status !== "PASS" && record.quality?.status !== "LIMITED" && record.quality?.status !== "FAIL") {
    throw new Error(`EXTERNAL_CAP04_EVIDENCE_QUALITY_STATUS_INVALID:${record.record_type}`);
  }
  assertNoReplayAuthorityMarkerV1(
    {
      binding_id: record.binding_id,
      origin_source_kind: record.origin_source_kind,
      limitations: record.limitations,
    },
    `EXTERNAL_CAP04_EVIDENCE_REPLAY_AUTHORITY_FORBIDDEN:${record.record_type}`,
  );
  counts[authority.count_key] += 1;
}

function requireEvidenceFamiliesV1(
  counts: ExternalFormalCap04InputAuthorityV1["binding_cardinality"],
): void {
  for (const key of ["soil", "rainfall", "historical_et0", "future_weather", "future_et0"] as const) {
    if (counts[key] < 1) throw new Error(`EXTERNAL_CAP04_REQUIRED_EVIDENCE_FAMILY_MISSING:${key}`);
  }
}

export function validateExternalFormalCap04InputAuthorityV1(input: {
  scope: TwinScopeKeyV1;
  logical_time: string;
  runtime_config: CanonicalObjectEnvelopeV1;
  candidate_records: readonly CanonicalReplayEvidenceRecordV1[];
  crop_stage_context: ContinuationCropStageConfigurationContextV1;
}): ExternalFormalCap04InputAuthorityV1 {
  const logicalTime = canonicalHourV1(input.logical_time, "EXTERNAL_CAP04_INPUT_LOGICAL_TIME_INVALID");
  exactExternalScopeV1(input.scope);

  validateCanonicalObjectV1(input.runtime_config);
  if (input.runtime_config.object_type !== "twin_runtime_config_v1") {
    throw new Error("EXTERNAL_CAP04_INPUT_RUNTIME_CONFIG_OBJECT_TYPE_REQUIRED");
  }
  exactScopeV1(input.runtime_config, input.scope, "EXTERNAL_CAP04_INPUT_RUNTIME_CONFIG_SCOPE_MISMATCH");
  if (input.runtime_config.logical_time !== logicalTime || input.runtime_config.as_of !== logicalTime) {
    throw new Error("EXTERNAL_CAP04_INPUT_RUNTIME_CONFIG_TIME_MISMATCH");
  }
  validateExternalFormalRuntimeConfigPayloadV1(input.runtime_config.payload);
  const runtime = input.runtime_config.payload as unknown as ExternalFormalRuntimeConfigPayloadV1;
  if (runtime.config_role !== "HOURLY_CAP04" || runtime.effective_logical_time !== logicalTime) {
    throw new Error("EXTERNAL_CAP04_INPUT_HOURLY_RUNTIME_CONFIG_REQUIRED");
  }

  const resolvedCrop = resolveContinuationCropStageContextV1({
    logical_time: logicalTime,
    context_ref: runtime.crop_stage_context_authority.context_ref,
    context_hash: runtime.crop_stage_context_authority.context_hash,
    context: input.crop_stage_context,
  });
  if (resolvedCrop.configuration_matrix_ref !== runtime.crop_stage_context_authority.configuration_matrix_ref
    || resolvedCrop.configuration_matrix_hash !== runtime.crop_stage_context_authority.configuration_matrix_hash) {
    throw new Error("EXTERNAL_CAP04_INPUT_CROP_CONFIGURATION_AUTHORITY_MISMATCH");
  }
  assertNoReplayAuthorityMarkerV1(resolvedCrop, "EXTERNAL_CAP04_INPUT_CROP_REPLAY_AUTHORITY_FORBIDDEN");

  const counts: ExternalFormalCap04InputAuthorityV1["binding_cardinality"] = {
    soil: 0,
    rainfall: 0,
    historical_et0: 0,
    future_weather: 0,
    future_et0: 0,
  };
  for (const record of input.candidate_records) validateEvidenceRecordV1(record, input.scope, counts);
  requireEvidenceFamiliesV1(counts);

  return {
    profile_id: EXTERNAL_FORMAL_CAP04_INPUT_AUTHORITY_PROFILE_ID_V1,
    runtime_config_ref: input.runtime_config.object_id,
    runtime_config_hash: input.runtime_config.determinism_hash,
    logical_time: logicalTime,
    scope: structuredClone(input.scope),
    resolved_crop_stage_context: resolvedCrop,
    binding_cardinality: counts,
    exact_five_binding_profile_enforced: true,
    commercial_operation_evidence_forbidden: true,
    canonical_persistence_authorized: false,
  };
}
