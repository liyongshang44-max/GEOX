// apps/server/src/domain/twin_runtime/continuation_cross_ref_validator_v1.ts
// Purpose: validate the complete MCFT-CAP-02 eight-object continuation graph, operation identity, aggregate hash, lineage/revision, Runtime Config, and predecessor references.
// Boundary: pure validation only; no persistence, equations, Evidence selection, filesystem, environment, clock, random values, network, or Runtime orchestration.

import type { CanonicalObjectEnvelopeV1 } from "./canonical_object_contracts_v1.js";
import { validateContinuationMemberV1 } from "./continuation_contracts_v1.js";
import {
  CONTINUATION_MEMBER_OBJECT_TYPES_V1,
  deriveContinuationOperationIdentityV1,
  type ContinuationMemberObjectTypeV1,
  type ContinuationScopeV1,
} from "./continuation_operation_identity_v1.js";
import {
  computeContinuationRecordSetDeterminismHashV1,
  type ContinuationRecordSetV1,
} from "./continuation_record_set_identity_v1.js";

function requiredStringV1(value: unknown, code: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(code);
  return value;
}

function memberByTypeV1(recordSet: ContinuationRecordSetV1, objectType: ContinuationMemberObjectTypeV1): CanonicalObjectEnvelopeV1 {
  const matches = recordSet.members.filter((member) => member.object_type === objectType);
  if (matches.length !== 1) throw new Error(`CONTINUATION_MEMBER_TYPE_CARDINALITY:${objectType}`);
  return matches[0];
}

function exactRefV1(member: CanonicalObjectEnvelopeV1, field: string, expected: string, code: string): void {
  if (member.payload[field] !== expected) throw new Error(code);
}

function exactScopeV1(member: CanonicalObjectEnvelopeV1, scope: ContinuationScopeV1): void {
  for (const key of ["tenant_id", "project_id", "group_id", "field_id", "season_id", "zone_id"] as const) {
    if (member[key] !== scope[key]) throw new Error(`CONTINUATION_MEMBER_SCOPE_MISMATCH:${member.object_type}:${key}`);
  }
}

export function validateContinuationRecordSetV1(recordSet: ContinuationRecordSetV1): void {
  const operationIdentity = deriveContinuationOperationIdentityV1(recordSet.continuation_operation_key);
  if (recordSet.continuation_operation_key_hash !== operationIdentity.continuation_operation_key_hash) throw new Error("CONTINUATION_OPERATION_KEY_HASH_MISMATCH");
  if (recordSet.continuation_record_set_id !== operationIdentity.continuation_record_set_id) throw new Error("CONTINUATION_RECORD_SET_ID_MISMATCH");
  if (recordSet.continuation_idempotency_key !== operationIdentity.continuation_idempotency_key) throw new Error("CONTINUATION_IDEMPOTENCY_KEY_MISMATCH");
  if (recordSet.members.length !== CONTINUATION_MEMBER_OBJECT_TYPES_V1.length) throw new Error("CONTINUATION_MEMBER_COUNT_MISMATCH");

  const actualTypes = recordSet.members.map((member) => member.object_type).sort();
  const expectedTypes = [...CONTINUATION_MEMBER_OBJECT_TYPES_V1].sort();
  if (JSON.stringify(actualTypes) !== JSON.stringify(expectedTypes)) throw new Error("CONTINUATION_MEMBER_TYPE_SET_MISMATCH");

  const aggregate = recordSet.aggregate_identity_input;
  if (JSON.stringify(aggregate.continuation_operation_key) !== JSON.stringify(recordSet.continuation_operation_key)) throw new Error("CONTINUATION_AGGREGATE_OPERATION_KEY_MISMATCH");

  for (const member of recordSet.members) {
    validateContinuationMemberV1(member);
    const objectType = member.object_type as ContinuationMemberObjectTypeV1;
    if (member.object_id !== operationIdentity.member_object_ids[objectType]) throw new Error(`CONTINUATION_MEMBER_OBJECT_ID_MISMATCH:${objectType}`);
    if (aggregate.member_determinism_hashes[objectType] !== member.determinism_hash) throw new Error(`CONTINUATION_AGGREGATE_MEMBER_HASH_MISMATCH:${objectType}`);
    exactScopeV1(member, recordSet.continuation_operation_key.scope);
    if (member.logical_time !== recordSet.continuation_operation_key.logical_time) throw new Error(`CONTINUATION_MEMBER_LOGICAL_TIME_MISMATCH:${objectType}`);
    if (member.lineage_id !== recordSet.continuation_operation_key.lineage_id) throw new Error(`CONTINUATION_MEMBER_LINEAGE_ID_MISMATCH:${objectType}`);
    if (member.revision_id !== recordSet.continuation_operation_key.revision_id) throw new Error(`CONTINUATION_MEMBER_REVISION_ID_MISMATCH:${objectType}`);
    if (member.runtime_config_ref !== aggregate.runtime_config_ref) throw new Error(`CONTINUATION_MEMBER_RUNTIME_CONFIG_REF_MISMATCH:${objectType}`);
    if (member.runtime_config_hash !== aggregate.runtime_config_hash) throw new Error(`CONTINUATION_MEMBER_RUNTIME_CONFIG_HASH_MISMATCH:${objectType}`);
  }

  const evidence = memberByTypeV1(recordSet, "twin_evidence_window_v1");
  const transition = memberByTypeV1(recordSet, "twin_state_transition_v1");
  const assimilation = memberByTypeV1(recordSet, "twin_assimilation_update_v1");
  const state = memberByTypeV1(recordSet, "twin_state_estimate_v1");
  const forecast = memberByTypeV1(recordSet, "twin_forecast_run_v1");
  const tick = memberByTypeV1(recordSet, "twin_runtime_tick_v1");
  const checkpoint = memberByTypeV1(recordSet, "twin_runtime_checkpoint_v1");
  const health = memberByTypeV1(recordSet, "twin_runtime_health_v1");

  if (evidence.payload.semantic_digest !== aggregate.evidence_window_semantic_digest) throw new Error("CONTINUATION_EVIDENCE_DIGEST_MISMATCH");

  exactRefV1(transition, "previous_posterior_ref", aggregate.previous_posterior_ref, "CONTINUATION_TRANSITION_PREVIOUS_POSTERIOR_REF_MISMATCH");
  if (transition.payload.previous_posterior_hash !== aggregate.previous_posterior_hash) throw new Error("CONTINUATION_TRANSITION_PREVIOUS_POSTERIOR_HASH_MISMATCH");
  exactRefV1(transition, "evidence_window_ref", evidence.object_id, "CONTINUATION_TRANSITION_EVIDENCE_REF_MISMATCH");
  exactRefV1(transition, "assimilation_update_ref", assimilation.object_id, "CONTINUATION_TRANSITION_ASSIMILATION_REF_MISMATCH");
  exactRefV1(transition, "posterior_state_ref", state.object_id, "CONTINUATION_TRANSITION_STATE_REF_MISMATCH");
  if (transition.payload.current_runtime_config_ref !== aggregate.runtime_config_ref) throw new Error("CONTINUATION_TRANSITION_CURRENT_CONFIG_REF_MISMATCH");

  exactRefV1(assimilation, "state_transition_ref", transition.object_id, "CONTINUATION_ASSIMILATION_TRANSITION_REF_MISMATCH");
  exactRefV1(assimilation, "posterior_state_ref", state.object_id, "CONTINUATION_ASSIMILATION_STATE_REF_MISMATCH");

  exactRefV1(state, "previous_posterior_ref", aggregate.previous_posterior_ref, "CONTINUATION_STATE_PREVIOUS_POSTERIOR_REF_MISMATCH");
  exactRefV1(state, "transition_ref", transition.object_id, "CONTINUATION_STATE_TRANSITION_REF_MISMATCH");
  exactRefV1(state, "assimilation_update_ref", assimilation.object_id, "CONTINUATION_STATE_ASSIMILATION_REF_MISMATCH");
  exactRefV1(state, "evidence_window_ref", evidence.object_id, "CONTINUATION_STATE_EVIDENCE_REF_MISMATCH");
  if (state.payload.reality_binding_ref !== aggregate.reality_binding_ref || state.payload.reality_binding_hash !== aggregate.reality_binding_hash) throw new Error("CONTINUATION_STATE_REALITY_BINDING_MISMATCH");
  if (state.payload.mass_balance_trace_hash !== transition.payload.mass_balance_trace_hash) throw new Error("CONTINUATION_STATE_TRANSITION_TRACE_HASH_MISMATCH");

  exactRefV1(forecast, "source_posterior_ref", state.object_id, "CONTINUATION_FORECAST_STATE_REF_MISMATCH");

  exactRefV1(tick, "evidence_window_ref", evidence.object_id, "CONTINUATION_TICK_EVIDENCE_REF_MISMATCH");
  exactRefV1(tick, "state_transition_ref", transition.object_id, "CONTINUATION_TICK_TRANSITION_REF_MISMATCH");
  exactRefV1(tick, "assimilation_update_ref", assimilation.object_id, "CONTINUATION_TICK_ASSIMILATION_REF_MISMATCH");
  exactRefV1(tick, "posterior_state_ref", state.object_id, "CONTINUATION_TICK_STATE_REF_MISMATCH");
  exactRefV1(tick, "forecast_result_ref", forecast.object_id, "CONTINUATION_TICK_FORECAST_REF_MISMATCH");
  exactRefV1(tick, "checkpoint_ref", checkpoint.object_id, "CONTINUATION_TICK_CHECKPOINT_REF_MISMATCH");

  exactRefV1(checkpoint, "previous_checkpoint_ref", aggregate.previous_checkpoint_ref, "CONTINUATION_CHECKPOINT_PREVIOUS_REF_MISMATCH");
  exactRefV1(checkpoint, "last_completed_tick_ref", tick.object_id, "CONTINUATION_CHECKPOINT_TICK_REF_MISMATCH");
  exactRefV1(checkpoint, "last_posterior_state_ref", state.object_id, "CONTINUATION_CHECKPOINT_STATE_REF_MISMATCH");
  exactRefV1(checkpoint, "forecast_result_ref", forecast.object_id, "CONTINUATION_CHECKPOINT_FORECAST_REF_MISMATCH");
  if (checkpoint.payload.next_tick_logical_time !== tick.payload.next_tick_logical_time) throw new Error("CONTINUATION_NEXT_TICK_TIME_MISMATCH");

  exactRefV1(health, "tick_ref", tick.object_id, "CONTINUATION_HEALTH_TICK_REF_MISMATCH");
  exactRefV1(health, "checkpoint_ref", checkpoint.object_id, "CONTINUATION_HEALTH_CHECKPOINT_REF_MISMATCH");
  exactRefV1(health, "state_ref", state.object_id, "CONTINUATION_HEALTH_STATE_REF_MISMATCH");
  exactRefV1(health, "forecast_result_ref", forecast.object_id, "CONTINUATION_HEALTH_FORECAST_REF_MISMATCH");
  if (health.payload.lineage_id !== recordSet.continuation_operation_key.lineage_id) throw new Error("CONTINUATION_HEALTH_LINEAGE_ID_MISMATCH");
  if (health.payload.revision_id !== recordSet.continuation_operation_key.revision_id) throw new Error("CONTINUATION_HEALTH_REVISION_ID_MISMATCH");
  requiredStringV1(health.payload.active_lineage_ref, "CONTINUATION_HEALTH_ACTIVE_LINEAGE_REF_REQUIRED");

  if (aggregate.crop_stage_context_ref !== "fixtures/mcft/water_state/replay_v1/configuration_context.json") throw new Error("CONTINUATION_AGGREGATE_CROP_STAGE_CONTEXT_REF_MISMATCH");
  requiredStringV1(aggregate.crop_stage_context_hash, "CONTINUATION_AGGREGATE_CROP_STAGE_CONTEXT_HASH_REQUIRED");

  const computedAggregateHash = computeContinuationRecordSetDeterminismHashV1(aggregate);
  if (computedAggregateHash !== recordSet.continuation_record_set_determinism_hash) throw new Error("CONTINUATION_AGGREGATE_HASH_MISMATCH");
}
