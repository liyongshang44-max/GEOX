// apps/server/src/runtime/twin_runtime/external_formal_cap04_candidate_executor_v1.ts
// Purpose: execute one persistence-free External Formal CAP04 candidate tick by binding exact External authorities around frozen CAP02/CAP03/CAP04 mathematical kernels, then construct an honest canonical A1/A2 record-set candidate.
// Boundary: deterministic caller-supplied execution only; no database, persistence, lease, provider fetch, scheduler, route, environment, wall clock, Scenario commit, recommendation, action, model activation, or O00 execution.

import {
  computeHourlyWaterBalanceV1,
  type ExecutedIrrigationEventV1,
} from "../../domain/soil_water/hourly_water_balance_v1.js";
import { composeAssimilatedContinuationPosteriorV1 } from "../../domain/soil_water/assimilated_continuation_posterior_v1.js";
import {
  deriveSemanticObjectIdV1,
  semanticHashV1,
} from "../../domain/twin_runtime/canonical_identity_v1.js";
import {
  validateCanonicalObjectV1,
  type CanonicalObjectEnvelopeV1,
} from "../../domain/twin_runtime/canonical_object_contracts_v1.js";
import {
  MCFT_CAP09_EXTERNAL_FORMAL_MODEL_PARAMETER_AUTHORITY_V1,
  MCFT_CAP09_EXTERNAL_FORMAL_RUNTIME_MODE_V1,
  MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1,
  validateExternalFormalRuntimeConfigPayloadV1,
  type ExternalFormalRuntimeConfigPayloadV1,
} from "../../domain/twin_runtime/external_formal_runtime_config_v1.js";
import {
  MCFT_CAP09_EXTERNAL_FORMAL_FUTURE_ET0_BINDING_ID_V1,
  MCFT_CAP09_EXTERNAL_FORMAL_FUTURE_FORCING_BINDING_IDS_V1,
  MCFT_CAP09_EXTERNAL_FORMAL_FUTURE_WEATHER_BINDING_ID_V1,
  MCFT_CAP09_EXTERNAL_FORMAL_HISTORICAL_ET0_BINDING_ID_V1,
  MCFT_CAP09_EXTERNAL_FORMAL_RAINFALL_BINDING_ID_V1,
  MCFT_CAP09_EXTERNAL_FORMAL_SOIL_BINDING_ID_V1,
} from "../../domain/twin_runtime/external_formal_evidence_binding_profile_v1.js";
import { ExternalFormalCap04ExecutionConfigResolverV1 } from "../../domain/twin_runtime/external_formal_cap04_execution_config_resolver_v1.js";
import {
  attachCap04CanonicalCompletedForecastAuthorityV1,
  validateCap04CanonicalForecastRunPayloadV1,
  type Cap04CanonicalForecastRunPayloadV1,
} from "../../domain/twin_runtime/forecast_canonical_authority_v1.js";
import {
  CAP04_A1_OPERATION_VARIANT_V1,
  CAP04_A2_OPERATION_VARIANT_V1,
  CAP04_A_MEMBER_OBJECT_TYPES_V1,
  CAP04_BLOCKED_FORECAST_CONTRACT_ID_V1,
  CAP04_COMPLETED_FORECAST_CONTRACT_ID_V1,
  validateCap04ForecastRunPayloadV1,
  type Cap04AMemberObjectTypeV1,
  type Cap04AOperationVariantV1,
  type Cap04ForecastRunPayloadV1,
} from "../../domain/twin_runtime/forecast_scenario_contracts_v1.js";
import {
  buildCap04ARecordSetIdentityV1,
  deriveCap04ARecordSetIdentityV1,
  type Cap04AOperationKeyV1,
  type Cap04ARecordSetV1,
} from "../../domain/twin_runtime/forecast_scenario_record_set_identity_v1.js";
import { computeCap04AMemberDeterminismHashV1 } from "../../domain/twin_runtime/forecast_scenario_member_hash_v1.js";
import { validateCap04ARecordSetV1 } from "../../domain/twin_runtime/forecast_scenario_record_set_validator_v1.js";
import type { Cap04RuntimeConfigPayloadV1 } from "../../domain/twin_runtime/forecast_scenario_runtime_config_v1.js";
import {
  computeCap04ForcingWindowHashV1,
  validateCap04ForecastForcingWindowV1,
  type Cap04ForecastForcingWindowV1,
} from "../../domain/twin_runtime/future_forcing_contracts_v1.js";
import { executeCap04Pure72hForecastMathV1 } from "../../domain/twin_runtime/pure_72h_forecast_math_v1.js";
import {
  buildAssimilatedContinuationEvidenceWindowV2,
  finalizeAssimilatedContinuationEvidenceWindowV2,
} from "./assimilated_continuation_evidence_window_v2.js";
import { buildCap04BlockedForecastPayloadV1 } from "./blocked_forecast_payload_builder_v1.js";
import type { ContinuationCropStageConfigurationContextV1 } from "./continuation_evidence_window_service_v1.js";
import type { Cap04ARecordSetBuilderSourceMembersV1 } from "./forecast_continuation_record_set_builder_v1.js";
import { selectCap04FutureForcingOutcomeV1 } from "./future_forcing_outcome_classifier_v1.js";
import {
  buildExternalFormalCap04StateSourceMembersV1,
} from "./external_formal_cap04_state_source_builder_v1.js";
import type {
  CanonicalReplayEvidenceRecordV1,
  PreparedNextTickInputV1,
  TwinScopeKeyV1,
} from "./ports.js";

export const EXTERNAL_FORMAL_CAP04_CANDIDATE_EXECUTION_PROFILE_ID_V1 =
  "MCFT_CAP09_EXTERNAL_FORMAL_CAP04_CANDIDATE_EXECUTION_PROFILE_V1" as const;

export type ExecuteExternalFormalCap04CandidateInputV1 = {
  scope: TwinScopeKeyV1;
  logical_time: string;
  created_at: string;
  handoff: PreparedNextTickInputV1;
  runtime_config: CanonicalObjectEnvelopeV1;
  candidate_records: readonly CanonicalReplayEvidenceRecordV1[];
  crop_stage_context: ContinuationCropStageConfigurationContextV1;
};

export type ExternalFormalCap04CandidateExecutionResultV1 = {
  profile_id: typeof EXTERNAL_FORMAL_CAP04_CANDIDATE_EXECUTION_PROFILE_ID_V1;
  status: "COMPLETED" | "BLOCKED";
  record_set: Cap04ARecordSetV1;
  source_members: Cap04ARecordSetBuilderSourceMembersV1;
  compatibility_assimilation_numeric_digest: string;
  canonical_persistence_authorized: false;
  runtime_mode: typeof MCFT_CAP09_EXTERNAL_FORMAL_RUNTIME_MODE_V1;
  model_parameter_authority: typeof MCFT_CAP09_EXTERNAL_FORMAL_MODEL_PARAMETER_AUTHORITY_V1;
  external_crop_authority_preserved: true;
  exact_five_binding_profile_enforced: true;
};

type ScopeLikeV1 = {
  tenant_id: string;
  project_id: string;
  group_id: string | null;
  field_id: string;
  season_id: string | null;
  zone_id: string | null;
};

const EVIDENCE_AUTHORITY_BY_TYPE_V1: Readonly<Record<string, {
  binding_id: string;
  epistemic_class: string;
}>> = {
  soil_moisture_observation_v1: {
    binding_id: MCFT_CAP09_EXTERNAL_FORMAL_SOIL_BINDING_ID_V1,
    epistemic_class: "OBSERVED",
  },
  observed_rainfall_v1: {
    binding_id: MCFT_CAP09_EXTERNAL_FORMAL_RAINFALL_BINDING_ID_V1,
    epistemic_class: "OBSERVED",
  },
  historical_et0_estimate_v1: {
    binding_id: MCFT_CAP09_EXTERNAL_FORMAL_HISTORICAL_ET0_BINDING_ID_V1,
    epistemic_class: "ESTIMATED",
  },
  future_weather_assumption_v1: {
    binding_id: MCFT_CAP09_EXTERNAL_FORMAL_FUTURE_WEATHER_BINDING_ID_V1,
    epistemic_class: "ASSUMED",
  },
  future_et0_assumption_v1: {
    binding_id: MCFT_CAP09_EXTERNAL_FORMAL_FUTURE_ET0_BINDING_ID_V1,
    epistemic_class: "ASSUMED",
  },
};

const SOURCE_MEMBER_TYPES_V1 = [
  "twin_evidence_window_v1",
  "twin_state_transition_v1",
  "twin_assimilation_update_v1",
  "twin_state_estimate_v1",
] as const;

type SourceMemberTypeV1 = (typeof SOURCE_MEMBER_TYPES_V1)[number];

function requiredStringV1(value: unknown, code: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(code);
  return value;
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

function addOneHourV1(value: string): string {
  return new Date(Date.parse(value) + 3_600_000).toISOString();
}

function exactScopeV1(actual: ScopeLikeV1, expected: TwinScopeKeyV1, code: string): void {
  for (const field of ["tenant_id", "project_id", "group_id", "field_id", "season_id", "zone_id"] as const) {
    if (actual[field] !== expected[field]) throw new Error(`${code}:${field}`);
  }
}

function exactExternalScopeV1(scope: TwinScopeKeyV1): void {
  exactScopeV1(scope, { ...MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1 }, "EXTERNAL_CAP04_EXECUTION_SCOPE_MISMATCH");
}

function uniqueSortedV1(values: readonly string[]): string[] {
  return [...new Set(values.filter((value) => typeof value === "string" && value.trim()))]
    .sort((left, right) => left.localeCompare(right));
}

function assertNoReplayCanonicalMarkerV1(value: unknown, code: string): void {
  const text = JSON.stringify(value);
  for (const marker of [
    "CONTROLLED_SYNTHETIC_REPLAY_PROXY",
    "CONTROLLED_REPLAY",
    "runtime_mode\":\"REPLAY",
    "POINT_200MM_TO_ROOT_ZONE_MEAN_H1_WITH_REPRESENTATIVENESS_V1",
  ]) {
    if (text.includes(marker)) throw new Error(`${code}:${marker}`);
  }
}

function assertExactExternalEvidenceProfileV1(
  scope: TwinScopeKeyV1,
  records: readonly CanonicalReplayEvidenceRecordV1[],
): void {
  for (const record of records) {
    const authority = EVIDENCE_AUTHORITY_BY_TYPE_V1[record.record_type];
    if (!authority) continue;
    exactScopeV1(record, scope, `EXTERNAL_CAP04_EVIDENCE_SCOPE_MISMATCH:${record.record_type}`);
    if (record.binding_id !== authority.binding_id) {
      throw new Error(`EXTERNAL_CAP04_EVIDENCE_BINDING_MISMATCH:${record.record_type}`);
    }
    if (record.epistemic_class !== authority.epistemic_class) {
      throw new Error(`EXTERNAL_CAP04_EVIDENCE_EPISTEMIC_CLASS_MISMATCH:${record.record_type}`);
    }
    assertNoReplayCanonicalMarkerV1(
      { origin_source_kind: record.origin_source_kind, limitations: record.limitations },
      `EXTERNAL_CAP04_EVIDENCE_REPLAY_MARKER_FORBIDDEN:${record.record_type}`,
    );
  }
}

function dynamicsConfigV1(config: Cap04RuntimeConfigPayloadV1) {
  return {
    root_zone_depth_mm: config.soil_hydraulic_snapshot.root_zone_depth_mm,
    wilting_point_storage_mm: config.soil_hydraulic_snapshot.wilting_point_storage_mm,
    field_capacity_storage_mm: config.soil_hydraulic_snapshot.field_capacity_storage_mm,
    saturation_storage_mm: config.soil_hydraulic_snapshot.saturation_storage_mm,
    saturation_fraction: config.soil_hydraulic_snapshot.saturation_fraction,
    runoff_fraction: config.dynamics_parameters.runoff_fraction,
    drainage_coefficient_per_hour: config.dynamics_parameters.drainage_coefficient_per_hour,
    structural_process_stddev_mm_per_hour: config.process_uncertainty.structural_process_stddev_mm_per_hour,
    rainfall_relative_stddev: config.process_uncertainty.rainfall_relative_stddev,
    crop_et_relative_stddev: config.process_uncertainty.crop_et_relative_stddev,
    executed_irrigation_relative_stddev: config.process_uncertainty.executed_irrigation_relative_stddev,
  };
}

function executionCandidatesV1(
  records: readonly CanonicalReplayEvidenceRecordV1[],
): ExecutedIrrigationEventV1[] {
  return records
    .filter((record) => record.record_type === "irrigation_execution_evidence_v1")
    .map((record) => ({
      source_record_id: record.source_record_id,
      executed_at: String(record.role_time.executed_at ?? ""),
      ingested_at: String(record.role_time.ingested_at ?? ""),
      executed_depth_mm: Number(record.canonical_payload.executed_depth_mm ?? record.canonical_payload.value),
      quality_status: record.quality.status,
    }));
}

function externalizeLimitationsV1(values: readonly string[], additional: readonly string[] = []): string[] {
  const filtered = values.filter((value) => value !== "CONTROLLED_SYNTHETIC" && value !== "CONTROLLED_REPLAY" && value !== "CONTROLLED_SYNTHETIC_REPLAY_PROXY");
  const result = uniqueSortedV1([
    ...filtered,
    MCFT_CAP09_EXTERNAL_FORMAL_RUNTIME_MODE_V1,
    MCFT_CAP09_EXTERNAL_FORMAL_MODEL_PARAMETER_AUTHORITY_V1,
    "NOT_FIELD_CALIBRATED",
    "EXTERNAL_PUBLIC_RESEARCH_SCOPE",
    "NO_RECOMMENDATION",
    "NO_DECISION",
    "NO_ACTION",
    ...additional,
  ]);
  assertNoReplayCanonicalMarkerV1(result, "EXTERNAL_CAP04_CANONICAL_LIMITATION_REPLAY_LEAKAGE");
  return result;
}

function externalizeForcingWindowV1(
  compatibilityWindow: Cap04ForecastForcingWindowV1,
  cropRef: string,
  cropHash: string,
): Cap04ForecastForcingWindowV1 {
  const points = compatibilityWindow.points.map((point) => ({
    ...structuredClone(point),
    crop_stage_context_ref: cropRef,
    crop_stage_context_hash: cropHash,
    limitations: externalizeLimitationsV1(point.limitations, ["EXTERNAL_FORMAL_FUTURE_FORCING"]),
  }));
  const window: Cap04ForecastForcingWindowV1 = {
    ...structuredClone(compatibilityWindow),
    crop_stage_context_ref: cropRef,
    crop_stage_context_hash: cropHash,
    points,
    forcing_window_hash: computeCap04ForcingWindowHashV1(points),
  };
  validateCap04ForecastForcingWindowV1(window);
  assertNoReplayCanonicalMarkerV1(window, "EXTERNAL_CAP04_FORCING_WINDOW_REPLAY_LEAKAGE");
  return window;
}

function externalizeCompletedForecastV1(input: {
  compatibility_forecast: ReturnType<typeof executeCap04Pure72hForecastMathV1>["forecast_payload"];
  external_forcing_window: Cap04ForecastForcingWindowV1;
  crop_ref: string;
  crop_hash: string;
  point_traces: ReturnType<typeof executeCap04Pure72hForecastMathV1>["point_traces"];
  trajectory_hash: string;
  aggregates: ReturnType<typeof executeCap04Pure72hForecastMathV1>["aggregates"];
  uncertainty_basis: ReturnType<typeof executeCap04Pure72hForecastMathV1>["uncertainty_basis"];
}): Cap04CanonicalForecastRunPayloadV1 {
  const compatibility = input.compatibility_forecast;
  const base: Cap04ForecastRunPayloadV1 = {
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
    forcing_window_hash: input.external_forcing_window.forcing_window_hash,
    forcing_cycle_key: input.external_forcing_window.forcing_cycle_key,
    weather_snapshot_ref: input.external_forcing_window.weather_snapshot_ref,
    weather_snapshot_hash: input.external_forcing_window.weather_snapshot_hash,
    et0_snapshot_ref: input.external_forcing_window.et0_snapshot_ref,
    et0_snapshot_hash: input.external_forcing_window.et0_snapshot_hash,
    crop_stage_context_ref: input.crop_ref,
    crop_stage_context_hash: input.crop_hash,
    future_forcing_pair_policy_id: compatibility.future_forcing_pair_policy_id,
    future_forcing_policy_id: compatibility.future_forcing_policy_id,
    future_forcing_fallback_policy_id: compatibility.future_forcing_fallback_policy_id,
    forecast_method_id: compatibility.forecast_method_id,
    forecast_method_version: compatibility.forecast_method_version,
    uncertainty_propagation_method_id: compatibility.uncertainty_propagation_method_id,
    forecast_interval_method_id: compatibility.forecast_interval_method_id,
    limitations: externalizeLimitationsV1(compatibility.limitations, [
      "FORECAST_MATH_REUSED_FROM_FROZEN_CAP04_KERNEL",
      "EXTERNAL_CROP_AUTHORITY_REBOUND_BEFORE_CANONICALIZATION",
    ]),
  };
  const output = attachCap04CanonicalCompletedForecastAuthorityV1({
    forecast_payload: base,
    forcing_window: input.external_forcing_window,
    point_traces: structuredClone(input.point_traces),
    trajectory_hash: input.trajectory_hash,
    aggregates: structuredClone(input.aggregates),
    uncertainty_basis: structuredClone(input.uncertainty_basis),
  });
  assertNoReplayCanonicalMarkerV1(output, "EXTERNAL_CAP04_FORECAST_REPLAY_LEAKAGE");
  return output;
}

function externalizeBlockedForecastV1(input: {
  compatibility_forecast: Cap04CanonicalForecastRunPayloadV1;
  crop_ref: string;
  crop_hash: string;
}): Cap04CanonicalForecastRunPayloadV1 {
  if (input.compatibility_forecast.status !== "BLOCKED") throw new Error("EXTERNAL_CAP04_BLOCKED_FORECAST_REQUIRED");
  const output = {
    ...structuredClone(input.compatibility_forecast),
    crop_stage_context_ref: input.crop_ref,
    crop_stage_context_hash: input.crop_hash,
    limitations: externalizeLimitationsV1(input.compatibility_forecast.limitations, [
      "EXTERNAL_CROP_AUTHORITY_REBOUND_BEFORE_CANONICALIZATION",
    ]),
  } as Cap04CanonicalForecastRunPayloadV1;
  validateCap04CanonicalForecastRunPayloadV1(output);
  assertNoReplayCanonicalMarkerV1(output, "EXTERNAL_CAP04_BLOCKED_FORECAST_REPLAY_LEAKAGE");
  return output;
}

function recordPayloadV1(member: CanonicalObjectEnvelopeV1, code: string): Record<string, unknown> {
  if (!member.payload || typeof member.payload !== "object" || Array.isArray(member.payload)) throw new Error(code);
  return structuredClone(member.payload);
}

function validateExternalSourceGraphV1(input: {
  source_members: Cap04ARecordSetBuilderSourceMembersV1;
  scope: TwinScopeKeyV1;
  lineage_id: string;
  revision_id: string;
  logical_time: string;
}): void {
  for (const type of SOURCE_MEMBER_TYPES_V1) {
    const member = input.source_members[type];
    if (member.object_type !== type) throw new Error(`EXTERNAL_CAP04_A_SOURCE_MEMBER_TYPE_MISMATCH:${type}`);
    exactScopeV1(member, input.scope, `EXTERNAL_CAP04_A_SOURCE_SCOPE_MISMATCH:${type}`);
    if (member.lineage_id !== input.lineage_id || member.revision_id !== input.revision_id || member.logical_time !== input.logical_time || member.as_of !== input.logical_time) {
      throw new Error(`EXTERNAL_CAP04_A_SOURCE_IDENTITY_MISMATCH:${type}`);
    }
    assertNoReplayCanonicalMarkerV1(member, `EXTERNAL_CAP04_A_SOURCE_REPLAY_LEAKAGE:${type}`);
  }
  const evidence = input.source_members.twin_evidence_window_v1;
  const transition = input.source_members.twin_state_transition_v1;
  const assimilation = input.source_members.twin_assimilation_update_v1;
  const state = input.source_members.twin_state_estimate_v1;
  if (transition.payload.evidence_window_ref !== evidence.object_id
    || transition.payload.assimilation_update_ref !== assimilation.object_id
    || transition.payload.posterior_state_ref !== state.object_id
    || assimilation.payload.state_transition_ref !== transition.object_id
    || assimilation.payload.posterior_state_ref !== state.object_id
    || state.payload.transition_ref !== transition.object_id
    || state.payload.assimilation_update_ref !== assimilation.object_id
    || state.payload.evidence_window_ref !== evidence.object_id) {
    throw new Error("EXTERNAL_CAP04_A_SOURCE_REFERENCE_GRAPH_MISMATCH");
  }
}

function remapSourcePayloadV1(
  type: SourceMemberTypeV1,
  source: CanonicalObjectEnvelopeV1,
  ids: Record<Cap04AMemberObjectTypeV1, string>,
  runtimeConfig: CanonicalObjectEnvelopeV1,
): Record<string, unknown> {
  const payload = recordPayloadV1(source, `EXTERNAL_CAP04_A_SOURCE_PAYLOAD_REQUIRED:${type}`);
  if (type === "twin_state_transition_v1") {
    payload.evidence_window_ref = ids.twin_evidence_window_v1;
    payload.assimilation_update_ref = ids.twin_assimilation_update_v1;
    payload.posterior_state_ref = ids.twin_state_estimate_v1;
    payload.current_runtime_config_ref = runtimeConfig.object_id;
    payload.current_runtime_config_hash = runtimeConfig.determinism_hash;
  } else if (type === "twin_assimilation_update_v1") {
    payload.state_transition_ref = ids.twin_state_transition_v1;
    payload.posterior_state_ref = ids.twin_state_estimate_v1;
    payload.runtime_config_ref = runtimeConfig.object_id;
    payload.runtime_config_hash = runtimeConfig.determinism_hash;
  } else if (type === "twin_state_estimate_v1") {
    payload.transition_ref = ids.twin_state_transition_v1;
    payload.assimilation_update_ref = ids.twin_assimilation_update_v1;
    payload.evidence_window_ref = ids.twin_evidence_window_v1;
  }
  return payload;
}

function buildExternalCap04ARecordSetV1(input: {
  scope: TwinScopeKeyV1;
  lineage_id: string;
  revision_id: string;
  logical_time: string;
  created_at: string;
  active_lineage_ref: string;
  previous_posterior_ref: string;
  previous_posterior_hash: string;
  previous_checkpoint_ref: string;
  previous_checkpoint_hash: string;
  previous_forecast_result_ref: string;
  previous_forecast_result_hash: string;
  previous_successful_forecast_ref: string | null;
  previous_tick_sequence: number;
  runtime_config: CanonicalObjectEnvelopeV1;
  source_members: Cap04ARecordSetBuilderSourceMembersV1;
  forecast_payload: Cap04CanonicalForecastRunPayloadV1;
}): Cap04ARecordSetV1 {
  const logicalTime = canonicalHourV1(input.logical_time, "EXTERNAL_CAP04_A_LOGICAL_TIME_INVALID");
  const createdAt = canonicalIsoV1(input.created_at, "EXTERNAL_CAP04_A_CREATED_AT_INVALID");
  exactExternalScopeV1(input.scope);
  requiredStringV1(input.lineage_id, "EXTERNAL_CAP04_A_LINEAGE_ID_REQUIRED");
  requiredStringV1(input.revision_id, "EXTERNAL_CAP04_A_REVISION_ID_REQUIRED");
  requiredStringV1(input.active_lineage_ref, "EXTERNAL_CAP04_A_ACTIVE_LINEAGE_REF_REQUIRED");
  for (const field of [
    "previous_posterior_ref",
    "previous_posterior_hash",
    "previous_checkpoint_ref",
    "previous_checkpoint_hash",
    "previous_forecast_result_ref",
  ] as const) requiredStringV1(input[field], `EXTERNAL_CAP04_A_${field.toUpperCase()}_REQUIRED`);
  if (input.previous_forecast_result_hash !== undefined) requiredStringV1(input.previous_forecast_result_hash, "EXTERNAL_CAP04_A_PREVIOUS_FORECAST_RESULT_HASH_REQUIRED");
  if (!Number.isInteger(input.previous_tick_sequence) || input.previous_tick_sequence < 0) throw new Error("EXTERNAL_CAP04_A_PREVIOUS_TICK_SEQUENCE_INVALID");

  validateCanonicalObjectV1(input.runtime_config);
  exactScopeV1(input.runtime_config, input.scope, "EXTERNAL_CAP04_A_RUNTIME_CONFIG_SCOPE_MISMATCH");
  validateExternalFormalRuntimeConfigPayloadV1(input.runtime_config.payload);
  const external = input.runtime_config.payload as unknown as ExternalFormalRuntimeConfigPayloadV1;
  if (external.config_role !== "HOURLY_CAP04" || external.effective_logical_time !== logicalTime) throw new Error("EXTERNAL_CAP04_A_RUNTIME_CONFIG_ROLE_TIME_MISMATCH");
  if (input.runtime_config.logical_time !== logicalTime || input.runtime_config.as_of !== logicalTime) throw new Error("EXTERNAL_CAP04_A_RUNTIME_CONFIG_ENVELOPE_TIME_MISMATCH");

  validateExternalSourceGraphV1({
    source_members: input.source_members,
    scope: input.scope,
    lineage_id: input.lineage_id,
    revision_id: input.revision_id,
    logical_time: logicalTime,
  });
  validateCap04CanonicalForecastRunPayloadV1(input.forecast_payload);
  if (input.forecast_payload.issued_at !== logicalTime
    || input.forecast_payload.runtime_config_ref !== input.runtime_config.object_id
    || input.forecast_payload.runtime_config_hash !== input.runtime_config.determinism_hash
    || input.forecast_payload.crop_stage_context_ref !== external.crop_stage_context_authority.context_ref
    || input.forecast_payload.crop_stage_context_hash !== external.crop_stage_context_authority.context_hash) {
    throw new Error("EXTERNAL_CAP04_A_FORECAST_AUTHORITY_MISMATCH");
  }
  assertNoReplayCanonicalMarkerV1(input.forecast_payload, "EXTERNAL_CAP04_A_FORECAST_REPLAY_LEAKAGE");

  const operationVariant: Cap04AOperationVariantV1 = input.forecast_payload.status === "COMPLETED"
    ? CAP04_A1_OPERATION_VARIANT_V1
    : CAP04_A2_OPERATION_VARIANT_V1;
  const operationKey: Cap04AOperationKeyV1 = {
    scope: structuredClone(input.scope),
    lineage_id: input.lineage_id,
    revision_id: input.revision_id,
    logical_time: logicalTime,
    operation_variant: operationVariant,
  };
  const identity = deriveCap04ARecordSetIdentityV1(operationKey);
  const ids = identity.member_object_ids;
  const nextTickLogicalTime = addOneHourV1(logicalTime);
  const baseEvidenceRefs = uniqueSortedV1(input.source_members.twin_evidence_window_v1.evidence_refs);
  const baseSourceRefs = uniqueSortedV1(input.source_members.twin_evidence_window_v1.source_refs);
  const operationLimitations = externalizeLimitationsV1([], operationVariant === CAP04_A1_OPERATION_VARIANT_V1
    ? ["EXTERNAL_CAP04_A1_CANDIDATE", "SCENARIO_SET_NOT_CREATED_BY_EA5B5"]
    : ["EXTERNAL_CAP04_A2_CANDIDATE", "FORECAST_BLOCKED", "SCENARIO_SET_NOT_EXPECTED"]);

  const buildMemberV1 = (
    type: Cap04AMemberObjectTypeV1,
    payload: Record<string, unknown>,
    sourceRefs: string[],
    evidenceRefs: string[],
    limitations: string[],
  ): CanonicalObjectEnvelopeV1 => {
    assertNoReplayCanonicalMarkerV1(payload, `EXTERNAL_CAP04_A_MEMBER_PAYLOAD_REPLAY_LEAKAGE:${type}`);
    const member: CanonicalObjectEnvelopeV1 = {
      object_id: ids[type],
      object_type: type,
      schema_version: "v1",
      ...input.scope,
      logical_time: logicalTime,
      as_of: logicalTime,
      source_refs: uniqueSortedV1(sourceRefs),
      evidence_refs: uniqueSortedV1(evidenceRefs),
      runtime_config_ref: input.runtime_config.object_id,
      runtime_config_hash: input.runtime_config.determinism_hash,
      idempotency_key: deriveSemanticObjectIdV1("external_cap04_a_member_key", {
        operation_key_hash: identity.operation_key_hash,
        object_type: type,
      }),
      determinism_hash: "",
      limitations: externalizeLimitationsV1(limitations),
      created_at: createdAt,
      lineage_id: input.lineage_id,
      revision_id: input.revision_id,
      payload,
    };
    member.determinism_hash = computeCap04AMemberDeterminismHashV1(member);
    return member;
  };

  const firstFour = SOURCE_MEMBER_TYPES_V1.map((type) => {
    const source = input.source_members[type];
    return buildMemberV1(
      type,
      remapSourcePayloadV1(type, source, ids, input.runtime_config),
      source.source_refs,
      source.evidence_refs,
      [...source.limitations, ...operationLimitations],
    );
  });
  const state = firstFour.find((member) => member.object_type === "twin_state_estimate_v1");
  if (!state) throw new Error("EXTERNAL_CAP04_A_POSTERIOR_STATE_MISSING");
  const sourceState = input.source_members.twin_state_estimate_v1;
  const boundToTemplate = input.forecast_payload.source_posterior_ref === sourceState.object_id
    && input.forecast_payload.source_posterior_hash === sourceState.determinism_hash;
  const boundToCanonical = input.forecast_payload.source_posterior_ref === state.object_id
    && input.forecast_payload.source_posterior_hash === state.determinism_hash;
  if (!boundToTemplate && !boundToCanonical) throw new Error("EXTERNAL_CAP04_A_FORECAST_SOURCE_STATE_MISMATCH");

  const forecastPayload = {
    ...structuredClone(input.forecast_payload),
    source_posterior_ref: state.object_id,
    source_posterior_hash: state.determinism_hash,
    runtime_config_ref: input.runtime_config.object_id,
    runtime_config_hash: input.runtime_config.determinism_hash,
  } as Cap04CanonicalForecastRunPayloadV1;
  validateCap04CanonicalForecastRunPayloadV1(forecastPayload);
  const forecastEvidenceRefs = uniqueSortedV1([
    ...baseEvidenceRefs,
    ...(forecastPayload.weather_snapshot_ref ? [forecastPayload.weather_snapshot_ref] : []),
    ...(forecastPayload.et0_snapshot_ref ? [forecastPayload.et0_snapshot_ref] : []),
  ]);
  const forecast = buildMemberV1(
    "twin_forecast_run_v1",
    forecastPayload as unknown as Record<string, unknown>,
    baseSourceRefs,
    forecastEvidenceRefs,
    [...forecastPayload.limitations, ...operationLimitations],
  );

  const contractId = operationVariant === CAP04_A1_OPERATION_VARIANT_V1
    ? CAP04_COMPLETED_FORECAST_CONTRACT_ID_V1
    : CAP04_BLOCKED_FORECAST_CONTRACT_ID_V1;
  const tickStatus = operationVariant === CAP04_A1_OPERATION_VARIANT_V1 ? "COMPLETED" : "COMPLETED_WITH_LIMITATIONS";
  const successfulForecastRef = operationVariant === CAP04_A1_OPERATION_VARIANT_V1
    ? forecast.object_id
    : input.previous_successful_forecast_ref;
  const tick = buildMemberV1(
    "twin_runtime_tick_v1",
    {
      transaction_family: "A_STATE_TICK_COMMIT",
      operation_variant: operationVariant,
      record_set_contract_id: contractId,
      record_set_id: identity.record_set_id,
      status: tickStatus,
      transition_kind: "CONTINUATION",
      runtime_mode: MCFT_CAP09_EXTERNAL_FORMAL_RUNTIME_MODE_V1,
      model_parameter_authority: MCFT_CAP09_EXTERNAL_FORMAL_MODEL_PARAMETER_AUTHORITY_V1,
      limitations: uniqueSortedV1(operationLimitations),
      evidence_window_ref: ids.twin_evidence_window_v1,
      state_transition_ref: ids.twin_state_transition_v1,
      assimilation_update_ref: ids.twin_assimilation_update_v1,
      posterior_state_ref: ids.twin_state_estimate_v1,
      forecast_result_ref: ids.twin_forecast_run_v1,
      checkpoint_ref: ids.twin_runtime_checkpoint_v1,
      next_tick_logical_time: nextTickLogicalTime,
      terminal_tick_uniqueness_key_hash: identity.terminal_tick_uniqueness_key_hash,
      operation_key_hash: identity.operation_key_hash,
      ...(operationVariant === CAP04_A2_OPERATION_VARIANT_V1 ? { stop_after_blocked_forecast: true } : {}),
    },
    baseSourceRefs,
    baseEvidenceRefs,
    operationLimitations,
  );
  const checkpoint = buildMemberV1(
    "twin_runtime_checkpoint_v1",
    {
      checkpoint_kind: "CONTINUATION",
      runtime_mode: MCFT_CAP09_EXTERNAL_FORMAL_RUNTIME_MODE_V1,
      previous_checkpoint_ref: input.previous_checkpoint_ref,
      last_completed_tick_ref: ids.twin_runtime_tick_v1,
      last_posterior_state_ref: ids.twin_state_estimate_v1,
      forecast_result_ref: ids.twin_forecast_run_v1,
      successful_forecast_ref: successfulForecastRef,
      next_tick_logical_time: nextTickLogicalTime,
      tick_sequence: input.previous_tick_sequence + 1,
    },
    baseSourceRefs,
    baseEvidenceRefs,
    operationLimitations,
  );
  const health = buildMemberV1(
    "twin_runtime_health_v1",
    {
      operation_status: operationVariant === CAP04_A1_OPERATION_VARIANT_V1
        ? "EXTERNAL_CONTINUATION_STATE_ASSIMILATED_WITH_SUCCESSFUL_FORECAST"
        : "EXTERNAL_CONTINUATION_STATE_ASSIMILATED_WITH_BLOCKED_FORECAST",
      runtime_mode: MCFT_CAP09_EXTERNAL_FORMAL_RUNTIME_MODE_V1,
      model_parameter_authority: MCFT_CAP09_EXTERNAL_FORMAL_MODEL_PARAMETER_AUTHORITY_V1,
      field_calibration_status: "NOT_FIELD_CALIBRATED",
      active_lineage_ref: input.active_lineage_ref,
      lineage_id: input.lineage_id,
      revision_id: input.revision_id,
      tick_ref: ids.twin_runtime_tick_v1,
      checkpoint_ref: ids.twin_runtime_checkpoint_v1,
      state_ref: ids.twin_state_estimate_v1,
      forecast_result_ref: ids.twin_forecast_run_v1,
      successful_forecast_ref: successfulForecastRef,
      limitation_reason_codes: uniqueSortedV1([
        ...operationLimitations,
        ...forecastPayload.limitations,
        ...forecastPayload.reason_codes,
      ]),
    },
    baseSourceRefs,
    baseEvidenceRefs,
    operationLimitations,
  );

  const members: CanonicalObjectEnvelopeV1[] = [
    ...firstFour,
    forecast,
    tick,
    checkpoint,
    health,
  ];
  const memberHashes = Object.fromEntries(
    members.map((member) => [member.object_type, member.determinism_hash]),
  ) as Record<Cap04AMemberObjectTypeV1, string>;
  const recordSetIdentity = buildCap04ARecordSetIdentityV1({
    record_set_contract_id: contractId,
    operation_key: operationKey,
    previous_posterior_ref: input.previous_posterior_ref,
    previous_posterior_hash: input.previous_posterior_hash,
    previous_checkpoint_ref: input.previous_checkpoint_ref,
    previous_checkpoint_hash: input.previous_checkpoint_hash,
    previous_forecast_result_ref: input.previous_forecast_result_ref,
    previous_forecast_result_hash: input.previous_forecast_result_hash,
    runtime_config_ref: input.runtime_config.object_id,
    runtime_config_hash: input.runtime_config.determinism_hash,
    evidence_window_hash: members[0].determinism_hash,
    assimilation_update_hash: members[2].determinism_hash,
    posterior_state_hash: state.determinism_hash,
    forcing_window_hash: forecastPayload.forcing_window_hash,
    forecast_point_hashes: forecastPayload.points.map((point) => point.determinism_hash),
    member_determinism_hashes: memberHashes,
  });
  tick.payload.aggregate_determinism_hash = recordSetIdentity.aggregate_determinism_hash;
  if (computeCap04AMemberDeterminismHashV1(tick) !== tick.determinism_hash) {
    throw new Error("EXTERNAL_CAP04_A_TICK_NONRECURSIVE_HASH_MISMATCH");
  }
  const recordSet: Cap04ARecordSetV1 = {
    ...recordSetIdentity,
    members,
  };
  if (recordSet.members.length !== CAP04_A_MEMBER_OBJECT_TYPES_V1.length) throw new Error("EXTERNAL_CAP04_A_MEMBER_COUNT_MISMATCH");
  validateCap04ARecordSetV1(recordSet);
  assertNoReplayCanonicalMarkerV1(recordSet, "EXTERNAL_CAP04_A_RECORD_SET_REPLAY_LEAKAGE");
  return recordSet;
}

export function executeExternalFormalCap04CandidateV1(
  input: ExecuteExternalFormalCap04CandidateInputV1,
): ExternalFormalCap04CandidateExecutionResultV1 {
  const logicalTime = canonicalHourV1(input.logical_time, "EXTERNAL_CAP04_EXECUTION_LOGICAL_TIME_INVALID");
  canonicalIsoV1(input.created_at, "EXTERNAL_CAP04_EXECUTION_CREATED_AT_INVALID");
  exactExternalScopeV1(input.scope);
  exactScopeV1(input.handoff, input.scope, "EXTERNAL_CAP04_EXECUTION_HANDOFF_SCOPE_MISMATCH");
  if (input.handoff.next_logical_tick_time !== logicalTime) throw new Error("EXTERNAL_CAP04_EXECUTION_HANDOFF_TIME_MISMATCH");
  assertExactExternalEvidenceProfileV1(input.scope, input.candidate_records);

  validateCanonicalObjectV1(input.runtime_config);
  if (input.runtime_config.object_type !== "twin_runtime_config_v1") throw new Error("EXTERNAL_CAP04_EXECUTION_RUNTIME_CONFIG_OBJECT_TYPE_REQUIRED");
  exactScopeV1(input.runtime_config, input.scope, "EXTERNAL_CAP04_EXECUTION_RUNTIME_CONFIG_SCOPE_MISMATCH");
  validateExternalFormalRuntimeConfigPayloadV1(input.runtime_config.payload);
  const external = input.runtime_config.payload as unknown as ExternalFormalRuntimeConfigPayloadV1;
  if (external.config_role !== "HOURLY_CAP04" || external.effective_logical_time !== logicalTime) {
    throw new Error("EXTERNAL_CAP04_EXECUTION_RUNTIME_CONFIG_ROLE_TIME_MISMATCH");
  }
  if (external.reality_binding_ref !== input.handoff.reality_binding_ref
    || external.reality_binding_hash !== input.handoff.reality_binding_hash) {
    throw new Error("EXTERNAL_CAP04_EXECUTION_REALITY_BINDING_MISMATCH");
  }
  if (input.crop_stage_context.determinism_hash !== external.crop_stage_context_authority.context_hash
    || input.crop_stage_context.configuration_matrix_ref !== external.crop_stage_context_authority.configuration_matrix_ref
    || input.crop_stage_context.configuration_matrix_hash !== external.crop_stage_context_authority.configuration_matrix_hash) {
    throw new Error("EXTERNAL_CAP04_EXECUTION_CROP_CONTEXT_AUTHORITY_MISMATCH");
  }
  assertNoReplayCanonicalMarkerV1(input.crop_stage_context, "EXTERNAL_CAP04_EXECUTION_CROP_CONTEXT_REPLAY_LEAKAGE");

  const resolver = new ExternalFormalCap04ExecutionConfigResolverV1();
  const resolved = resolver.resolveExecutionConfig(input.runtime_config);
  const compatibility = resolved.payload;
  const preliminaryEvidence = buildAssimilatedContinuationEvidenceWindowV2({
    scope: input.scope,
    logical_time: logicalTime,
    candidate_records: input.candidate_records,
    saturation_fraction: compatibility.soil_hydraulic_snapshot.saturation_fraction,
    crop_stage_context_ref: external.crop_stage_context_authority.context_ref,
    crop_stage_context_hash: external.crop_stage_context_authority.context_hash,
    crop_stage_context: input.crop_stage_context,
    authorized_soil_observation_binding_id: MCFT_CAP09_EXTERNAL_FORMAL_SOIL_BINDING_ID_V1,
  });
  const cropStage = preliminaryEvidence.base_continuation_window.crop_stage_context;
  if (cropStage.context_ref !== external.crop_stage_context_authority.context_ref
    || cropStage.context_hash !== external.crop_stage_context_authority.context_hash) {
    throw new Error("EXTERNAL_CAP04_EXECUTION_RESOLVED_CROP_AUTHORITY_MISMATCH");
  }

  const dynamics = computeHourlyWaterBalanceV1({
    previous_storage_mm: input.handoff.previous_storage_mm_decimal,
    previous_variance_basis: input.handoff.previous_variance_basis,
    gross_rainfall_mm: preliminaryEvidence.base_continuation_window.dynamics_inputs.gross_rainfall_mm,
    reference_et0_mm: preliminaryEvidence.base_continuation_window.dynamics_inputs.reference_et0_mm,
    crop_stage_kc: cropStage.kc,
    execution_evidence: executionCandidatesV1(input.candidate_records),
    config: dynamicsConfigV1(compatibility),
  });
  const compatibilityAssimilation = composeAssimilatedContinuationPosteriorV1({
    prior_mean: Number(dynamics.computation_basis.storage_mean_mm_decimal.value) / compatibility.soil_hydraulic_snapshot.root_zone_depth_mm,
    prior_variance: Number(dynamics.computation_basis.storage_variance_mm2_decimal.value) / (compatibility.soil_hydraulic_snapshot.root_zone_depth_mm ** 2),
    selected_observation: preliminaryEvidence.observation_selection.selected_observation,
    saturation_fraction: compatibility.soil_hydraulic_snapshot.saturation_fraction,
    root_zone_depth_mm: compatibility.soil_hydraulic_snapshot.root_zone_depth_mm,
    sensor_measurement_stddev_fraction: compatibility.observation_assimilation.sensor_measurement_stddev_fraction,
    point_to_zone_representativeness_stddev_fraction: compatibility.observation_assimilation.point_to_zone_representativeness_stddev_fraction,
    quality_weights: compatibility.observation_assimilation.quality_weights,
  });
  const evidence = finalizeAssimilatedContinuationEvidenceWindowV2({
    window: preliminaryEvidence,
    assimilation: compatibilityAssimilation,
  });
  const sourceMembers = buildExternalFormalCap04StateSourceMembersV1({
    scope: input.scope,
    logical_time: logicalTime,
    created_at: input.created_at,
    handoff: input.handoff,
    runtime_config: input.runtime_config,
    compatibility_execution_config_payload: compatibility,
    evidence_window: evidence,
    dynamics,
    compatibility_assimilation: compatibilityAssimilation,
  });
  const sourceState = sourceMembers.twin_state_estimate_v1;
  const computationBasis = sourceState.payload.computation_basis as Record<string, unknown>;
  const storageMean = computationBasis.storage_mean_mm_decimal as { value: string; scale: number };
  const storageVariance = computationBasis.storage_variance_mm2_decimal as { value: string; scale: number };

  const forcingOutcome = selectCap04FutureForcingOutcomeV1({
    scope: input.scope,
    logical_time: logicalTime,
    candidate_records: input.candidate_records,
    authorized_binding_ids: MCFT_CAP09_EXTERNAL_FORMAL_FUTURE_FORCING_BINDING_IDS_V1,
    crop_stage_context: {
      ref: compatibility.crop_stage_context.context_ref,
      hash: compatibility.crop_stage_context.context_hash,
      crop_stage_code: cropStage.crop_stage_code,
      kc: cropStage.kc,
    },
    runtime_config: {
      ref: input.runtime_config.object_id,
      hash: input.runtime_config.determinism_hash,
    },
  });
  if (forcingOutcome.status === "FAILED") {
    throw new Error(`EXTERNAL_CAP04_FUTURE_FORCING_FAILED:${forcingOutcome.reason_codes.join("|")}`);
  }

  let forecastPayload: Cap04CanonicalForecastRunPayloadV1;
  if (forcingOutcome.status === "BLOCKED") {
    const compatibilityBlocked = buildCap04BlockedForecastPayloadV1({
      issued_at: logicalTime,
      source_posterior_ref: sourceState.object_id,
      source_posterior_hash: sourceState.determinism_hash,
      runtime_config_ref: input.runtime_config.object_id,
      runtime_config_hash: input.runtime_config.determinism_hash,
      runtime_config_payload: compatibility,
      reason_codes: forcingOutcome.reason_codes,
      limitations: ["EA5B5_EXTERNAL_FORMAL_CANDIDATE"],
    });
    forecastPayload = externalizeBlockedForecastV1({
      compatibility_forecast: compatibilityBlocked,
      crop_ref: external.crop_stage_context_authority.context_ref,
      crop_hash: external.crop_stage_context_authority.context_hash,
    });
  } else {
    const compatibilityMath = executeCap04Pure72hForecastMathV1({
      source_posterior: {
        ref: sourceState.object_id,
        hash: sourceState.determinism_hash,
        logical_time: logicalTime,
        computation_basis: {
          storage_mean_mm_decimal: requiredStringV1(storageMean?.value, "EXTERNAL_CAP04_SOURCE_STORAGE_DECIMAL_REQUIRED"),
          storage_variance_mm2_decimal: requiredStringV1(storageVariance?.value, "EXTERNAL_CAP04_SOURCE_VARIANCE_DECIMAL_REQUIRED"),
        },
      },
      runtime_config: {
        ref: input.runtime_config.object_id,
        hash: input.runtime_config.determinism_hash,
        payload: compatibility,
      },
      forcing_window: forcingOutcome.window,
    });
    const externalForcingWindow = externalizeForcingWindowV1(
      forcingOutcome.window,
      external.crop_stage_context_authority.context_ref,
      external.crop_stage_context_authority.context_hash,
    );
    forecastPayload = externalizeCompletedForecastV1({
      compatibility_forecast: compatibilityMath.forecast_payload,
      external_forcing_window: externalForcingWindow,
      crop_ref: external.crop_stage_context_authority.context_ref,
      crop_hash: external.crop_stage_context_authority.context_hash,
      point_traces: compatibilityMath.point_traces,
      trajectory_hash: compatibilityMath.trajectory_hash,
      aggregates: compatibilityMath.aggregates,
      uncertainty_basis: compatibilityMath.uncertainty_basis,
    });
  }
  validateCap04ForecastRunPayloadV1(forecastPayload);

  const recordSet = buildExternalCap04ARecordSetV1({
    scope: input.scope,
    lineage_id: input.handoff.lineage_id,
    revision_id: input.handoff.revision_id,
    logical_time: logicalTime,
    created_at: input.created_at,
    active_lineage_ref: input.handoff.active_lineage_ref,
    previous_posterior_ref: input.handoff.previous_posterior_ref,
    previous_posterior_hash: input.handoff.previous_posterior_hash,
    previous_checkpoint_ref: input.handoff.previous_checkpoint_ref,
    previous_checkpoint_hash: input.handoff.previous_checkpoint_hash,
    previous_forecast_result_ref: input.handoff.previous_forecast_result_ref,
    previous_forecast_result_hash: input.handoff.previous_forecast_result_hash ?? `sha256:${input.handoff.previous_forecast_result_ref}`,
    previous_successful_forecast_ref: input.handoff.latest_successful_forecast_ref,
    previous_tick_sequence: input.handoff.previous_tick_sequence,
    runtime_config: input.runtime_config,
    source_members: sourceMembers,
    forecast_payload: forecastPayload,
  });
  assertNoReplayCanonicalMarkerV1(recordSet, "EXTERNAL_CAP04_EXECUTION_RECORD_SET_REPLAY_LEAKAGE");

  return {
    profile_id: EXTERNAL_FORMAL_CAP04_CANDIDATE_EXECUTION_PROFILE_ID_V1,
    status: forecastPayload.status,
    record_set: recordSet,
    source_members: sourceMembers,
    compatibility_assimilation_numeric_digest: semanticHashV1({
      ...compatibilityAssimilation,
      observation_operator: undefined,
    }),
    canonical_persistence_authorized: false,
    runtime_mode: MCFT_CAP09_EXTERNAL_FORMAL_RUNTIME_MODE_V1,
    model_parameter_authority: MCFT_CAP09_EXTERNAL_FORMAL_MODEL_PARAMETER_AUTHORITY_V1,
    external_crop_authority_preserved: true,
    exact_five_binding_profile_enforced: true,
  };
}
