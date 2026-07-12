// apps/server/src/domain/twin_runtime/forecast_scenario_record_set_validator_v1.ts
// Purpose: validate CAP-04 A1/A2 eight-member graphs, Tick-root recovery fields, and canonical B Scenario Set identity.
// Boundary: pure validation only; no persistence, projection, forcing selection, Forecast math, Scenario math, clock, filesystem or network.

import { canonicalJsonV1 } from "./canonical_json_v1.js";
import { computeMemberDeterminismHashV1 } from "./canonical_identity_v1.js";
import type { CanonicalObjectEnvelopeV1 } from "./canonical_object_contracts_v1.js";
import {
  CAP04_A1_OPERATION_VARIANT_V1,
  CAP04_A2_OPERATION_VARIANT_V1,
  CAP04_A_MEMBER_OBJECT_TYPES_V1,
  CAP04_BLOCKED_FORECAST_CONTRACT_ID_V1,
  CAP04_COMPLETED_FORECAST_CONTRACT_ID_V1,
  CAP04_THREE_SCENARIO_SET_CONTRACT_ID_V1,
  validateCap04ForecastRunPayloadV1,
  validateCap04ScenarioSetPayloadV1,
  type Cap04AMemberObjectTypeV1,
  type Cap04ForecastRunPayloadV1,
} from "./forecast_scenario_contracts_v1.js";
import {
  computeCap04AAggregateDeterminismHashV1,
  deriveCap04ARecordSetIdentityV1,
  deriveCap04ScenarioSetIdentityV1,
  type Cap04ARecordSetV1,
  type Cap04ScenarioSetRecordV1,
} from "./forecast_scenario_record_set_identity_v1.js";

function requiredStringV1(value: unknown, code: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(code);
  return value;
}

function validateBaseEnvelopeV1(member: CanonicalObjectEnvelopeV1): void {
  for (const field of ["object_id", "object_type", "schema_version", "tenant_id", "project_id", "field_id", "logical_time", "as_of", "idempotency_key", "determinism_hash", "created_at"] as const) {
    requiredStringV1(member[field], `CAP04_MEMBER_${field.toUpperCase()}_REQUIRED`);
  }
  if (!Array.isArray(member.source_refs) || !Array.isArray(member.evidence_refs) || !Array.isArray(member.limitations)) throw new Error("CAP04_MEMBER_ARRAYS_REQUIRED");
  if (!member.payload || typeof member.payload !== "object" || Array.isArray(member.payload)) throw new Error("CAP04_MEMBER_PAYLOAD_REQUIRED");
  const computed = computeMemberDeterminismHashV1(member as unknown as Record<string, unknown>);
  if (computed !== member.determinism_hash) throw new Error("CAP04_MEMBER_SEMANTIC_HASH_MISMATCH");
}

function oneMemberV1(recordSet: Cap04ARecordSetV1, type: Cap04AMemberObjectTypeV1): CanonicalObjectEnvelopeV1 {
  const matches = recordSet.members.filter((member) => member.object_type === type);
  if (matches.length !== 1) throw new Error(`CAP04_A_MEMBER_CARDINALITY:${type}`);
  return matches[0];
}

function exactRefV1(member: CanonicalObjectEnvelopeV1, field: string, expected: string, code: string): void {
  if (member.payload[field] !== expected) throw new Error(code);
}

export function validateCap04ARecordSetV1(recordSet: Cap04ARecordSetV1): void {
  const identity = deriveCap04ARecordSetIdentityV1(recordSet.operation_key);
  if (recordSet.record_set_contract_id !== identity.record_set_contract_id) throw new Error("CAP04_A_RECORD_SET_CONTRACT_MISMATCH");
  if (recordSet.record_set_id !== identity.record_set_id || recordSet.idempotency_key !== identity.idempotency_key) throw new Error("CAP04_A_RECORD_SET_IDENTITY_MISMATCH");
  if (recordSet.terminal_tick_uniqueness_key_hash !== identity.terminal_tick_uniqueness_key_hash || canonicalJsonV1(recordSet.terminal_tick_uniqueness_key) !== canonicalJsonV1(identity.terminal_tick_uniqueness_key)) throw new Error("CAP04_TERMINAL_UNIQUENESS_IDENTITY_MISMATCH");
  if (recordSet.operation_key_hash !== identity.operation_key_hash) throw new Error("CAP04_A_OPERATION_KEY_HASH_MISMATCH");
  if (!Array.isArray(recordSet.members) || recordSet.members.length !== 8) throw new Error("CAP04_A_MEMBER_COUNT_MISMATCH");
  const actualTypes = recordSet.members.map((member) => member.object_type).sort();
  if (canonicalJsonV1(actualTypes) !== canonicalJsonV1([...CAP04_A_MEMBER_OBJECT_TYPES_V1].sort())) throw new Error("CAP04_A_MEMBER_TYPE_SET_MISMATCH");
  for (const member of recordSet.members) {
    validateBaseEnvelopeV1(member);
    const expectedId = identity.member_object_ids[member.object_type as Cap04AMemberObjectTypeV1];
    if (member.object_id !== expectedId) throw new Error("CAP04_A_MEMBER_OBJECT_ID_MISMATCH");
    if (member.lineage_id !== recordSet.operation_key.lineage_id || member.revision_id !== recordSet.operation_key.revision_id || member.logical_time !== recordSet.operation_key.logical_time) throw new Error("CAP04_A_MEMBER_LINEAGE_REVISION_TIME_MISMATCH");
    if (member.runtime_config_ref !== recordSet.aggregate_identity_input.runtime_config_ref || member.runtime_config_hash !== recordSet.aggregate_identity_input.runtime_config_hash) throw new Error("CAP04_A_MEMBER_RUNTIME_CONFIG_MISMATCH");
  }

  const evidence = oneMemberV1(recordSet, "twin_evidence_window_v1");
  const transition = oneMemberV1(recordSet, "twin_state_transition_v1");
  const assimilation = oneMemberV1(recordSet, "twin_assimilation_update_v1");
  const state = oneMemberV1(recordSet, "twin_state_estimate_v1");
  const forecast = oneMemberV1(recordSet, "twin_forecast_run_v1");
  const tick = oneMemberV1(recordSet, "twin_runtime_tick_v1");
  const checkpoint = oneMemberV1(recordSet, "twin_runtime_checkpoint_v1");
  const health = oneMemberV1(recordSet, "twin_runtime_health_v1");

  const forecastPayload = forecast.payload as unknown as Cap04ForecastRunPayloadV1;
  validateCap04ForecastRunPayloadV1(forecastPayload);
  if (forecastPayload.source_posterior_ref !== state.object_id || forecastPayload.source_posterior_hash !== state.determinism_hash) throw new Error("CAP04_FORECAST_SOURCE_POSTERIOR_MISMATCH");
  if (recordSet.operation_key.operation_variant === CAP04_A1_OPERATION_VARIANT_V1) {
    if (recordSet.record_set_contract_id !== CAP04_COMPLETED_FORECAST_CONTRACT_ID_V1 || forecastPayload.status !== "COMPLETED") throw new Error("CAP04_A1_COMPLETED_FORECAST_REQUIRED");
    if (tick.payload.status !== "COMPLETED") throw new Error("CAP04_A1_TICK_STATUS_MISMATCH");
  } else if (recordSet.operation_key.operation_variant === CAP04_A2_OPERATION_VARIANT_V1) {
    if (recordSet.record_set_contract_id !== CAP04_BLOCKED_FORECAST_CONTRACT_ID_V1 || forecastPayload.status !== "BLOCKED") throw new Error("CAP04_A2_BLOCKED_FORECAST_REQUIRED");
    if (tick.payload.status !== "COMPLETED_WITH_LIMITATIONS") throw new Error("CAP04_A2_TICK_STATUS_MISMATCH");
  } else {
    throw new Error("CAP04_A_OPERATION_VARIANT_UNKNOWN");
  }

  exactRefV1(transition, "evidence_window_ref", evidence.object_id, "CAP04_REF_TRANSITION_EVIDENCE_MISMATCH");
  exactRefV1(transition, "assimilation_update_ref", assimilation.object_id, "CAP04_REF_TRANSITION_ASSIMILATION_MISMATCH");
  exactRefV1(transition, "posterior_state_ref", state.object_id, "CAP04_REF_TRANSITION_STATE_MISMATCH");
  exactRefV1(assimilation, "state_transition_ref", transition.object_id, "CAP04_REF_ASSIMILATION_TRANSITION_MISMATCH");
  exactRefV1(assimilation, "posterior_state_ref", state.object_id, "CAP04_REF_ASSIMILATION_STATE_MISMATCH");
  exactRefV1(state, "transition_ref", transition.object_id, "CAP04_REF_STATE_TRANSITION_MISMATCH");
  exactRefV1(state, "assimilation_update_ref", assimilation.object_id, "CAP04_REF_STATE_ASSIMILATION_MISMATCH");
  exactRefV1(state, "evidence_window_ref", evidence.object_id, "CAP04_REF_STATE_EVIDENCE_MISMATCH");

  if (tick.payload.record_set_contract_id !== recordSet.record_set_contract_id || tick.payload.record_set_id !== recordSet.record_set_id || tick.payload.aggregate_determinism_hash !== recordSet.aggregate_determinism_hash || tick.payload.operation_variant !== recordSet.operation_key.operation_variant) throw new Error("CAP04_TICK_RECOVERY_ROOT_IDENTITY_MISMATCH");
  exactRefV1(tick, "evidence_window_ref", evidence.object_id, "CAP04_REF_TICK_EVIDENCE_MISMATCH");
  exactRefV1(tick, "state_transition_ref", transition.object_id, "CAP04_REF_TICK_TRANSITION_MISMATCH");
  exactRefV1(tick, "assimilation_update_ref", assimilation.object_id, "CAP04_REF_TICK_ASSIMILATION_MISMATCH");
  exactRefV1(tick, "posterior_state_ref", state.object_id, "CAP04_REF_TICK_STATE_MISMATCH");
  exactRefV1(tick, "forecast_result_ref", forecast.object_id, "CAP04_REF_TICK_FORECAST_MISMATCH");
  exactRefV1(tick, "checkpoint_ref", checkpoint.object_id, "CAP04_REF_TICK_CHECKPOINT_MISMATCH");
  if ("health_ref" in tick.payload) throw new Error("CAP04_TICK_HEALTH_REF_FORBIDDEN");

  exactRefV1(checkpoint, "last_completed_tick_ref", tick.object_id, "CAP04_REF_CHECKPOINT_TICK_MISMATCH");
  exactRefV1(checkpoint, "last_posterior_state_ref", state.object_id, "CAP04_REF_CHECKPOINT_STATE_MISMATCH");
  exactRefV1(checkpoint, "forecast_result_ref", forecast.object_id, "CAP04_REF_CHECKPOINT_FORECAST_MISMATCH");
  exactRefV1(health, "tick_ref", tick.object_id, "CAP04_HEALTH_REVERSE_LOOKUP_TICK_MISMATCH");
  exactRefV1(health, "state_ref", state.object_id, "CAP04_REF_HEALTH_STATE_MISMATCH");
  exactRefV1(health, "forecast_result_ref", forecast.object_id, "CAP04_REF_HEALTH_FORECAST_MISMATCH");
  exactRefV1(health, "checkpoint_ref", checkpoint.object_id, "CAP04_REF_HEALTH_CHECKPOINT_MISMATCH");

  const memberHashes = Object.fromEntries(recordSet.members.map((member) => [member.object_type, member.determinism_hash])) as Record<Cap04AMemberObjectTypeV1, string>;
  if (canonicalJsonV1(memberHashes) !== canonicalJsonV1(recordSet.aggregate_identity_input.member_determinism_hashes)) throw new Error("CAP04_A_MEMBER_HASH_MAP_MISMATCH");
  const computedAggregate = computeCap04AAggregateDeterminismHashV1(recordSet.aggregate_identity_input);
  if (computedAggregate !== recordSet.aggregate_determinism_hash) throw new Error("CAP04_A_AGGREGATE_HASH_MISMATCH");
}

export function validateCap04ScenarioSetRecordV1(
  record: Cap04ScenarioSetRecordV1,
  sourceForecastEnvelope: CanonicalObjectEnvelopeV1,
): void {
  validateBaseEnvelopeV1(sourceForecastEnvelope);
  const sourceForecast = sourceForecastEnvelope.payload as unknown as Cap04ForecastRunPayloadV1;
  validateCap04ForecastRunPayloadV1(sourceForecast);
  if (record.record_set_contract_id !== CAP04_THREE_SCENARIO_SET_CONTRACT_ID_V1) throw new Error("CAP04_B_CONTRACT_ID_MISMATCH");
  validateCap04ScenarioSetPayloadV1(record.scenario_set.payload, sourceForecast);
  validateBaseEnvelopeV1(record.scenario_set as unknown as CanonicalObjectEnvelopeV1);
  if (record.scenario_set.payload.source_forecast_ref !== sourceForecastEnvelope.object_id || record.scenario_set.payload.source_forecast_hash !== sourceForecastEnvelope.determinism_hash) throw new Error("CAP04_B_SOURCE_FORECAST_MISMATCH");
  const identity = deriveCap04ScenarioSetIdentityV1({
    uniqueness_key: record.scenario_set_uniqueness_key,
    scenario_policy_id: record.operation_key.scenario_policy_id,
    runtime_config_ref: record.operation_key.runtime_config_ref,
    runtime_config_hash: record.operation_key.runtime_config_hash,
    scenario_set_determinism_hash: record.scenario_set.determinism_hash,
  });
  if (record.scenario_set_id !== identity.scenario_set_id || record.idempotency_key !== identity.idempotency_key || record.operation_key_hash !== identity.operation_key_hash || record.scenario_set_uniqueness_key_hash !== identity.scenario_set_uniqueness_key_hash) throw new Error("CAP04_B_IDENTITY_MISMATCH");
  if (record.scenario_set.object_id !== record.scenario_set_id || record.aggregate_determinism_hash !== record.scenario_set.determinism_hash) throw new Error("CAP04_B_AGGREGATE_MISMATCH");
  if (record.scenario_set.lineage_id !== record.scenario_set_uniqueness_key.lineage_id || record.scenario_set.revision_id !== record.scenario_set_uniqueness_key.revision_id) throw new Error("CAP04_B_LINEAGE_REVISION_MISMATCH");
}
