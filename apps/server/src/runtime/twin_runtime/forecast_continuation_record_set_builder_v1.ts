// apps/server/src/runtime/twin_runtime/forecast_continuation_record_set_builder_v1.ts
// Purpose: construct deterministic MCFT-CAP-04 A1 completed-Forecast and A2 blocked-Forecast eight-member canonical record-set candidates.
// Boundary: pure construction and validation only; no database, lease, persistence, projection, route, scheduler, Scenario creation, filesystem, environment, network, or wall clock.

import {
  computeMemberDeterminismHashV1,
  deriveSemanticObjectIdV1,
} from "../../domain/twin_runtime/canonical_identity_v1.js";
import type { CanonicalObjectEnvelopeV1 } from "../../domain/twin_runtime/canonical_object_contracts_v1.js";
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
import {
  validateCap04RuntimeConfigPayloadV1,
  type Cap04RuntimeConfigPayloadV1,
} from "../../domain/twin_runtime/forecast_scenario_runtime_config_v1.js";
import type { ContinuationScopeV1 } from "../../domain/twin_runtime/continuation_operation_identity_v1.js";

const SOURCE_MEMBER_TYPES_V1 = [
  "twin_evidence_window_v1",
  "twin_state_transition_v1",
  "twin_assimilation_update_v1",
  "twin_state_estimate_v1",
] as const;

type Cap04SourceMemberTypeV1 = (typeof SOURCE_MEMBER_TYPES_V1)[number];

export type Cap04ARecordSetBuilderSourceMembersV1 = Record<
  Cap04SourceMemberTypeV1,
  CanonicalObjectEnvelopeV1
>;

export type Cap04ARecordSetBuilderCommonInputV1 = {
  scope: ContinuationScopeV1;
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
  forecast_payload: Cap04ForecastRunPayloadV1;
};

export type BuildCap04CompletedForecastRecordSetInputV1 = Cap04ARecordSetBuilderCommonInputV1;
export type BuildCap04BlockedForecastRecordSetInputV1 = Cap04ARecordSetBuilderCommonInputV1;

type ScopeLikeV1 = {
  tenant_id: string;
  project_id: string;
  group_id: string | null;
  field_id: string;
  season_id: string | null;
  zone_id: string | null;
};

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

function exactScopeV1(actual: ScopeLikeV1, expected: ContinuationScopeV1, code: string): void {
  for (const field of ["tenant_id", "project_id", "group_id", "field_id", "season_id", "zone_id"] as const) {
    if (actual[field] !== expected[field]) throw new Error(`${code}:${field}`);
  }
}

function uniqueSortedV1(values: readonly string[]): string[] {
  return [...new Set(values.filter((value) => typeof value === "string" && value.trim()))]
    .sort((left, right) => left.localeCompare(right));
}

function recordPayloadV1(member: CanonicalObjectEnvelopeV1, code: string): Record<string, unknown> {
  if (!member.payload || typeof member.payload !== "object" || Array.isArray(member.payload)) throw new Error(code);
  return structuredClone(member.payload);
}

function validateSourceMemberV1(
  member: CanonicalObjectEnvelopeV1,
  expectedType: Cap04SourceMemberTypeV1,
  input: Cap04ARecordSetBuilderCommonInputV1,
): void {
  if (member.object_type !== expectedType) throw new Error(`CAP04_BUILDER_SOURCE_MEMBER_TYPE_MISMATCH:${expectedType}`);
  if (member.logical_time !== input.logical_time || member.as_of !== input.logical_time) {
    throw new Error(`CAP04_BUILDER_SOURCE_MEMBER_TIME_MISMATCH:${expectedType}`);
  }
  if (member.lineage_id !== input.lineage_id || member.revision_id !== input.revision_id) {
    throw new Error(`CAP04_BUILDER_SOURCE_MEMBER_LINEAGE_MISMATCH:${expectedType}`);
  }
  exactScopeV1(member, input.scope, `CAP04_BUILDER_SOURCE_MEMBER_SCOPE_MISMATCH:${expectedType}`);
  if (!Array.isArray(member.source_refs) || !Array.isArray(member.evidence_refs) || !Array.isArray(member.limitations)) {
    throw new Error(`CAP04_BUILDER_SOURCE_MEMBER_ARRAYS_REQUIRED:${expectedType}`);
  }
  recordPayloadV1(member, `CAP04_BUILDER_SOURCE_MEMBER_PAYLOAD_REQUIRED:${expectedType}`);
  const computed = computeMemberDeterminismHashV1(member as unknown as Record<string, unknown>);
  if (computed !== member.determinism_hash) throw new Error(`CAP04_BUILDER_SOURCE_MEMBER_HASH_MISMATCH:${expectedType}`);
}

function validateSourceGraphV1(input: Cap04ARecordSetBuilderCommonInputV1): void {
  for (const type of SOURCE_MEMBER_TYPES_V1) validateSourceMemberV1(input.source_members[type], type, input);
  const evidence = input.source_members.twin_evidence_window_v1;
  const transition = input.source_members.twin_state_transition_v1;
  const assimilation = input.source_members.twin_assimilation_update_v1;
  const state = input.source_members.twin_state_estimate_v1;
  if (transition.payload.evidence_window_ref !== evidence.object_id) throw new Error("CAP04_BUILDER_SOURCE_TRANSITION_EVIDENCE_MISMATCH");
  if (transition.payload.assimilation_update_ref !== assimilation.object_id) throw new Error("CAP04_BUILDER_SOURCE_TRANSITION_ASSIMILATION_MISMATCH");
  if (transition.payload.posterior_state_ref !== state.object_id) throw new Error("CAP04_BUILDER_SOURCE_TRANSITION_STATE_MISMATCH");
  if (assimilation.payload.state_transition_ref !== transition.object_id) throw new Error("CAP04_BUILDER_SOURCE_ASSIMILATION_TRANSITION_MISMATCH");
  if (assimilation.payload.posterior_state_ref !== state.object_id) throw new Error("CAP04_BUILDER_SOURCE_ASSIMILATION_STATE_MISMATCH");
  if (state.payload.transition_ref !== transition.object_id) throw new Error("CAP04_BUILDER_SOURCE_STATE_TRANSITION_MISMATCH");
  if (state.payload.assimilation_update_ref !== assimilation.object_id) throw new Error("CAP04_BUILDER_SOURCE_STATE_ASSIMILATION_MISMATCH");
  if (state.payload.evidence_window_ref !== evidence.object_id) throw new Error("CAP04_BUILDER_SOURCE_STATE_EVIDENCE_MISMATCH");
}

function validateRuntimeConfigV1(input: Cap04ARecordSetBuilderCommonInputV1): Cap04RuntimeConfigPayloadV1 {
  const config = input.runtime_config;
  if (config.object_type !== "twin_runtime_config_v1") throw new Error("CAP04_BUILDER_RUNTIME_CONFIG_OBJECT_TYPE_REQUIRED");
  exactScopeV1(config, input.scope, "CAP04_BUILDER_RUNTIME_CONFIG_SCOPE_MISMATCH");
  if (config.logical_time !== input.logical_time || config.as_of !== input.logical_time) {
    throw new Error("CAP04_BUILDER_RUNTIME_CONFIG_LOGICAL_TIME_MISMATCH");
  }
  validateCap04RuntimeConfigPayloadV1(config.payload);
  const payload = config.payload as unknown as Cap04RuntimeConfigPayloadV1;
  if (payload.effective_logical_time !== input.logical_time) throw new Error("CAP04_BUILDER_RUNTIME_CONFIG_EFFECTIVE_TIME_MISMATCH");
  return payload;
}

function remapPayloadV1(
  type: Cap04SourceMemberTypeV1,
  source: CanonicalObjectEnvelopeV1,
  ids: Record<Cap04AMemberObjectTypeV1, string>,
  runtimeConfig: CanonicalObjectEnvelopeV1,
): Record<string, unknown> {
  const payload = recordPayloadV1(source, `CAP04_BUILDER_SOURCE_MEMBER_PAYLOAD_REQUIRED:${type}`);
  if (type === "twin_state_transition_v1") {
    payload.evidence_window_ref = ids.twin_evidence_window_v1;
    payload.assimilation_update_ref = ids.twin_assimilation_update_v1;
    payload.posterior_state_ref = ids.twin_state_estimate_v1;
    payload.current_runtime_config_ref = runtimeConfig.object_id;
    if ("current_runtime_config_hash" in payload) payload.current_runtime_config_hash = runtimeConfig.determinism_hash;
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

function buildCap04ARecordSetInternalV1(
  input: Cap04ARecordSetBuilderCommonInputV1,
  operationVariant: Cap04AOperationVariantV1,
): Cap04ARecordSetV1 {
  const logicalTime = canonicalHourV1(input.logical_time, "CAP04_BUILDER_LOGICAL_TIME_INVALID");
  const createdAt = canonicalIsoV1(input.created_at, "CAP04_BUILDER_CREATED_AT_INVALID");
  requiredStringV1(input.lineage_id, "CAP04_BUILDER_LINEAGE_ID_REQUIRED");
  requiredStringV1(input.revision_id, "CAP04_BUILDER_REVISION_ID_REQUIRED");
  requiredStringV1(input.active_lineage_ref, "CAP04_BUILDER_ACTIVE_LINEAGE_REF_REQUIRED");
  for (const field of [
    "previous_posterior_ref",
    "previous_posterior_hash",
    "previous_checkpoint_ref",
    "previous_checkpoint_hash",
    "previous_forecast_result_ref",
    "previous_forecast_result_hash",
  ] as const) requiredStringV1(input[field], `CAP04_BUILDER_${field.toUpperCase()}_REQUIRED`);
  if (!Number.isInteger(input.previous_tick_sequence) || input.previous_tick_sequence < 0) throw new Error("CAP04_BUILDER_PREVIOUS_TICK_SEQUENCE_INVALID");
  exactScopeV1(input.scope, input.scope, "CAP04_BUILDER_SCOPE_INVALID");
  validateSourceGraphV1(input);
  const config = validateRuntimeConfigV1(input);
  validateCap04ForecastRunPayloadV1(input.forecast_payload);
  const expectedStatus = operationVariant === CAP04_A1_OPERATION_VARIANT_V1 ? "COMPLETED" : "BLOCKED";
  if (input.forecast_payload.status !== expectedStatus) throw new Error("CAP04_BUILDER_FORECAST_STATUS_VARIANT_MISMATCH");
  if (input.forecast_payload.issued_at !== logicalTime) throw new Error("CAP04_BUILDER_FORECAST_ISSUED_TIME_MISMATCH");
  if (input.forecast_payload.runtime_config_ref !== input.runtime_config.object_id
    || input.forecast_payload.runtime_config_hash !== input.runtime_config.determinism_hash) {
    throw new Error("CAP04_BUILDER_FORECAST_RUNTIME_CONFIG_MISMATCH");
  }
  if (input.forecast_payload.forecast_method_id !== config.forecast_method_id
    || input.forecast_payload.forecast_method_version !== config.forecast_method_version
    || input.forecast_payload.future_forcing_pair_policy_id !== config.future_forcing_pair_policy_id
    || input.forecast_payload.future_forcing_policy_id !== config.future_forcing_policy_id
    || input.forecast_payload.future_forcing_fallback_policy_id !== config.future_forcing_fallback_policy_id
    || input.forecast_payload.uncertainty_propagation_method_id !== config.uncertainty_propagation_method_id
    || input.forecast_payload.forecast_interval_method_id !== config.forecast_interval_method_id
    || input.forecast_payload.crop_stage_context_ref !== config.crop_stage_context.context_ref
    || input.forecast_payload.crop_stage_context_hash !== config.crop_stage_context.context_hash) {
    throw new Error("CAP04_BUILDER_FORECAST_CONFIG_AUTHORITY_MISMATCH");
  }
  const sourceState = input.source_members.twin_state_estimate_v1;

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
  const operationLimitations = operationVariant === CAP04_A1_OPERATION_VARIANT_V1
    ? ["NO_PERSISTENCE_CHANGE", "SCENARIO_SET_NOT_CREATED_BY_A1_BUILDER"]
    : ["NO_PERSISTENCE_CHANGE", "FORECAST_BLOCKED", "SCENARIO_SET_NOT_EXPECTED"];

  const buildMemberV1 = (
    type: Cap04AMemberObjectTypeV1,
    payload: Record<string, unknown>,
    sourceRefs: string[],
    evidenceRefs: string[],
    limitations: string[],
  ): CanonicalObjectEnvelopeV1 => {
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
      idempotency_key: deriveSemanticObjectIdV1("cap04_a_member_key", {
        operation_key_hash: identity.operation_key_hash,
        object_type: type,
      }),
      determinism_hash: "",
      limitations: uniqueSortedV1(limitations),
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
      remapPayloadV1(type, source, ids, input.runtime_config),
      source.source_refs,
      source.evidence_refs,
      [...source.limitations, ...operationLimitations],
    );
  });
  const state = firstFour.find((member) => member.object_type === "twin_state_estimate_v1");
  if (!state) throw new Error("CAP04_BUILDER_POSTERIOR_STATE_MEMBER_MISSING");
  const boundToSourceTemplate = input.forecast_payload.source_posterior_ref === sourceState.object_id
    && input.forecast_payload.source_posterior_hash === sourceState.determinism_hash;
  const boundToCanonicalState = input.forecast_payload.source_posterior_ref === state.object_id
    && input.forecast_payload.source_posterior_hash === state.determinism_hash;
  if (!boundToSourceTemplate && !boundToCanonicalState) {
    throw new Error("CAP04_BUILDER_FORECAST_SOURCE_STATE_MISMATCH");
  }

  const forecastPayload: Cap04ForecastRunPayloadV1 = {
    ...structuredClone(input.forecast_payload),
    source_posterior_ref: state.object_id,
    source_posterior_hash: state.determinism_hash,
    runtime_config_ref: input.runtime_config.object_id,
    runtime_config_hash: input.runtime_config.determinism_hash,
  };
  validateCap04ForecastRunPayloadV1(forecastPayload);
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
  const tickStatus = operationVariant === CAP04_A1_OPERATION_VARIANT_V1
    ? "COMPLETED"
    : "COMPLETED_WITH_LIMITATIONS";
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
      ...(operationVariant === CAP04_A2_OPERATION_VARIANT_V1
        ? { stop_after_blocked_forecast: true }
        : {}),
    },
    baseSourceRefs,
    baseEvidenceRefs,
    operationLimitations,
  );
  const checkpoint = buildMemberV1(
    "twin_runtime_checkpoint_v1",
    {
      checkpoint_kind: "CONTINUATION",
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
        ? "CONTINUATION_STATE_ASSIMILATED_WITH_SUCCESSFUL_FORECAST"
        : "CONTINUATION_STATE_ASSIMILATED_WITH_BLOCKED_FORECAST",
      runtime_mode: "REPLAY",
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
    throw new Error("CAP04_BUILDER_TICK_NONRECURSIVE_HASH_MISMATCH");
  }
  const recordSet: Cap04ARecordSetV1 = {
    ...recordSetIdentity,
    members,
  };
  if (recordSet.members.length !== CAP04_A_MEMBER_OBJECT_TYPES_V1.length) {
    throw new Error("CAP04_BUILDER_MEMBER_COUNT_MISMATCH");
  }
  validateCap04ARecordSetV1(recordSet);
  return recordSet;
}

export function buildCap04CompletedForecastRecordSetV1(
  input: BuildCap04CompletedForecastRecordSetInputV1,
): Cap04ARecordSetV1 {
  return buildCap04ARecordSetInternalV1(input, CAP04_A1_OPERATION_VARIANT_V1);
}

export function buildCap04BlockedForecastRecordSetV1(
  input: BuildCap04BlockedForecastRecordSetInputV1,
): Cap04ARecordSetV1 {
  return buildCap04ARecordSetInternalV1(input, CAP04_A2_OPERATION_VARIANT_V1);
}
