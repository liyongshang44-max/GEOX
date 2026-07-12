// apps/server/src/domain/twin_runtime/assimilated_continuation_cross_ref_validator_v2.ts
// Purpose: validate the complete MCFT-CAP-03 eight-object graph, Evidence classifications, posterior State basis, Tick/Checkpoint/Health payloads, and versioned aggregate identity.
// Boundary: pure validation only; no database, persistence, equations, Evidence selection, filesystem, environment, wall clock, random values, network, or Runtime orchestration.

import type { CanonicalObjectEnvelopeV1 } from "./canonical_object_contracts_v1.js";
import {
  ASSIMILATED_CONTINUATION_EVIDENCE_WINDOW_CONTRACT_ID_V2,
  ASSIMILATED_CONTINUATION_RECORD_SET_CONTRACT_ID_V2,
  type AssimilatedContinuationUpdatePayloadV2,
} from "./assimilated_continuation_contracts_v2.js";
import type { AssimilatedContinuationRecordSetV2 } from "./assimilated_continuation_record_set_identity_v2.js";
import { validateAssimilatedContinuationRecordSetV2 } from "./assimilated_continuation_record_set_validator_v2.js";
import {
  CONTINUATION_MEMBER_OBJECT_TYPES_V1,
  type ContinuationMemberObjectTypeV1,
} from "./continuation_operation_identity_v1.js";

function requiredStringV1(value: unknown, code: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(code);
  return value;
}

function requiredRecordV1(value: unknown, code: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(code);
  return value as Record<string, unknown>;
}

function requiredStringArrayV1(value: unknown, code: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || !item)) {
    throw new Error(code);
  }
  return value as string[];
}

function requiredFiniteNumberV1(value: unknown, code: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(code);
  return value;
}

function memberByTypeV1(
  recordSet: AssimilatedContinuationRecordSetV2,
  objectType: ContinuationMemberObjectTypeV1,
): CanonicalObjectEnvelopeV1 {
  const matches = recordSet.members.filter((member) => member.object_type === objectType);
  if (matches.length !== 1) {
    throw new Error(`ASSIMILATED_CROSS_REF_MEMBER_CARDINALITY:${objectType}`);
  }
  return matches[0];
}

function exactRefV1(
  member: CanonicalObjectEnvelopeV1,
  field: string,
  expected: string,
  code: string,
): void {
  if (member.payload[field] !== expected) throw new Error(code);
}

function exactJsonV1(actual: unknown, expected: unknown, code: string): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(code);
}

function uniqueSortedV1(values: readonly string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function validateEvidenceClassificationsV1(input: {
  evidence: CanonicalObjectEnvelopeV1;
  assimilation: AssimilatedContinuationUpdatePayloadV2;
  aggregate_digest: string;
}): void {
  const payload = input.evidence.payload;
  if (
    payload.evidence_window_contract_id
      !== ASSIMILATED_CONTINUATION_EVIDENCE_WINDOW_CONTRACT_ID_V2
  ) {
    throw new Error("ASSIMILATED_EVIDENCE_WINDOW_CONTRACT_MISMATCH");
  }
  if (payload.semantic_digest !== input.aggregate_digest) {
    throw new Error("ASSIMILATED_EVIDENCE_DIGEST_MISMATCH");
  }
  if (payload.frozen !== true) throw new Error("ASSIMILATED_EVIDENCE_WINDOW_NOT_FROZEN");

  const selection = requiredRecordV1(
    payload.observation_selection,
    "ASSIMILATED_EVIDENCE_OBSERVATION_SELECTION_REQUIRED",
  );
  exactJsonV1(
    selection.candidates,
    input.assimilation.candidate_observations,
    "ASSIMILATED_EVIDENCE_CANDIDATE_TRACE_MISMATCH",
  );
  if (selection.selected_observation_ref !== input.assimilation.selected_observation_ref) {
    throw new Error("ASSIMILATED_EVIDENCE_SELECTED_REF_MISMATCH");
  }

  const dynamics = requiredStringArrayV1(
    payload.dynamics_consumed_evidence_refs,
    "ASSIMILATED_EVIDENCE_DYNAMICS_REFS_REQUIRED",
  );
  const evaluated = requiredStringArrayV1(
    payload.assimilation_evaluated_evidence_refs,
    "ASSIMILATED_EVIDENCE_EVALUATED_REFS_REQUIRED",
  );
  const applied = requiredStringArrayV1(
    payload.assimilation_applied_evidence_refs,
    "ASSIMILATED_EVIDENCE_APPLIED_REFS_REQUIRED",
  );
  const consumed = requiredStringArrayV1(
    payload.consumed_evidence_refs,
    "ASSIMILATED_EVIDENCE_CONSUMED_REFS_REQUIRED",
  );
  const rejected = requiredStringArrayV1(
    payload.rejected_evidence_refs,
    "ASSIMILATED_EVIDENCE_REJECTED_REFS_REQUIRED",
  );

  exactJsonV1(
    evaluated,
    input.assimilation.evaluated_observation_refs,
    "ASSIMILATED_EVIDENCE_EVALUATED_TRACE_MISMATCH",
  );
  exactJsonV1(
    applied,
    input.assimilation.applied_observation_refs,
    "ASSIMILATED_EVIDENCE_APPLIED_TRACE_MISMATCH",
  );
  exactJsonV1(
    consumed,
    uniqueSortedV1([...dynamics, ...applied]),
    "ASSIMILATED_EVIDENCE_CONSUMED_UNION_MISMATCH",
  );
  if (applied.some((ref) => rejected.includes(ref))) {
    throw new Error("ASSIMILATED_EVIDENCE_APPLIED_REF_REJECTED");
  }
  if (
    input.assimilation.disposition === "REJECTED_OUTLIER"
    && input.assimilation.selected_observation_ref !== null
    && consumed.includes(input.assimilation.selected_observation_ref)
  ) {
    throw new Error("ASSIMILATED_OUTLIER_EVIDENCE_CONSUMED");
  }
}

function validatePosteriorStateV1(input: {
  state: CanonicalObjectEnvelopeV1;
  transition: CanonicalObjectEnvelopeV1;
  assimilation_member: CanonicalObjectEnvelopeV1;
  evidence: CanonicalObjectEnvelopeV1;
  aggregate: AssimilatedContinuationRecordSetV2["aggregate_identity_input"];
}): void {
  const assimilation = input.assimilation_member.payload as unknown as AssimilatedContinuationUpdatePayloadV2;
  exactRefV1(
    input.state,
    "previous_posterior_ref",
    input.aggregate.previous_posterior_ref,
    "ASSIMILATED_STATE_PREVIOUS_POSTERIOR_REF_MISMATCH",
  );
  exactRefV1(
    input.state,
    "transition_ref",
    input.transition.object_id,
    "ASSIMILATED_STATE_TRANSITION_REF_MISMATCH",
  );
  exactRefV1(
    input.state,
    "assimilation_update_ref",
    input.assimilation_member.object_id,
    "ASSIMILATED_STATE_ASSIMILATION_REF_MISMATCH",
  );
  exactRefV1(
    input.state,
    "evidence_window_ref",
    input.evidence.object_id,
    "ASSIMILATED_STATE_EVIDENCE_REF_MISMATCH",
  );

  if (
    input.state.payload.reality_binding_ref !== input.aggregate.reality_binding_ref
    || input.state.payload.reality_binding_hash !== input.aggregate.reality_binding_hash
  ) {
    throw new Error("ASSIMILATED_STATE_REALITY_BINDING_MISMATCH");
  }
  if (input.state.payload.mass_balance_trace_hash !== input.transition.payload.mass_balance_trace_hash) {
    throw new Error("ASSIMILATED_STATE_TRANSITION_TRACE_HASH_MISMATCH");
  }

  const vwc = requiredRecordV1(
    input.state.payload.root_zone_vwc_fraction,
    "ASSIMILATED_STATE_VWC_REQUIRED",
  );
  const storage = requiredRecordV1(
    input.state.payload.root_zone_storage_mm,
    "ASSIMILATED_STATE_STORAGE_REQUIRED",
  );
  if (
    requiredFiniteNumberV1(vwc.mean, "ASSIMILATED_STATE_VWC_MEAN_INVALID")
      !== assimilation.published_posterior_mean
  ) {
    throw new Error("ASSIMILATED_STATE_POSTERIOR_MEAN_MISMATCH");
  }
  if (
    requiredFiniteNumberV1(vwc.variance, "ASSIMILATED_STATE_VWC_VARIANCE_INVALID")
      !== assimilation.published_posterior_variance
  ) {
    throw new Error("ASSIMILATED_STATE_POSTERIOR_VARIANCE_MISMATCH");
  }

  const basis = requiredRecordV1(
    input.state.payload.computation_basis,
    "ASSIMILATED_STATE_COMPUTATION_BASIS_REQUIRED",
  );
  if (basis.basis_origin !== "CARRIED_FROM_PREVIOUS_CONTINUATION_STATE") {
    throw new Error("ASSIMILATED_STATE_BASIS_ORIGIN_MISMATCH");
  }
  if (basis.previous_state_ref !== input.aggregate.previous_posterior_ref) {
    throw new Error("ASSIMILATED_STATE_BASIS_PREVIOUS_REF_MISMATCH");
  }
  const posteriorVwc = requiredRecordV1(
    basis.posterior_vwc_decimal,
    "ASSIMILATED_STATE_POSTERIOR_VWC_DECIMAL_REQUIRED",
  );
  const posteriorVariance = requiredRecordV1(
    basis.posterior_vwc_variance_decimal,
    "ASSIMILATED_STATE_POSTERIOR_VARIANCE_DECIMAL_REQUIRED",
  );
  const storageMean = requiredRecordV1(
    basis.storage_mean_mm_decimal,
    "ASSIMILATED_STATE_STORAGE_MEAN_DECIMAL_REQUIRED",
  );
  const storageVariance = requiredRecordV1(
    basis.storage_variance_mm2_decimal,
    "ASSIMILATED_STATE_STORAGE_VARIANCE_DECIMAL_REQUIRED",
  );
  if (Number(posteriorVwc.value) !== assimilation.published_posterior_mean) {
    throw new Error("ASSIMILATED_STATE_BASIS_POSTERIOR_MEAN_MISMATCH");
  }
  if (Number(posteriorVariance.value) !== assimilation.published_posterior_variance) {
    throw new Error("ASSIMILATED_STATE_BASIS_POSTERIOR_VARIANCE_MISMATCH");
  }
  if (
    Number(storageMean.value)
      !== requiredFiniteNumberV1(storage.mean, "ASSIMILATED_STATE_STORAGE_MEAN_INVALID")
  ) {
    throw new Error("ASSIMILATED_STATE_BASIS_STORAGE_MEAN_MISMATCH");
  }
  if (
    Number(storageVariance.value)
      !== requiredFiniteNumberV1(storage.variance, "ASSIMILATED_STATE_STORAGE_VARIANCE_INVALID")
  ) {
    throw new Error("ASSIMILATED_STATE_BASIS_STORAGE_VARIANCE_MISMATCH");
  }
}

function expectedHealthStatusV1(payload: AssimilatedContinuationUpdatePayloadV2): string {
  if (payload.status === "APPLIED") {
    return "CONTINUATION_STATE_ASSIMILATED_WITH_BLOCKED_FORECAST";
  }
  if (payload.disposition === "REJECTED_OUTLIER") {
    return "CONTINUATION_STATE_PROPAGATED_WITH_REJECTED_OUTLIER";
  }
  return "CONTINUATION_STATE_PROPAGATED_WITHOUT_USABLE_OBSERVATION";
}

export function validateAssimilatedContinuationCrossReferencesV2(
  recordSet: AssimilatedContinuationRecordSetV2,
): void {
  validateAssimilatedContinuationRecordSetV2(recordSet);
  if (recordSet.record_set_contract_id !== ASSIMILATED_CONTINUATION_RECORD_SET_CONTRACT_ID_V2) {
    throw new Error("UNKNOWN_RECORD_SET_CONTRACT");
  }
  if (recordSet.members.length !== CONTINUATION_MEMBER_OBJECT_TYPES_V1.length) {
    throw new Error("ASSIMILATED_CROSS_REF_MEMBER_COUNT_MISMATCH");
  }

  const evidence = memberByTypeV1(recordSet, "twin_evidence_window_v1");
  const transition = memberByTypeV1(recordSet, "twin_state_transition_v1");
  const assimilationMember = memberByTypeV1(recordSet, "twin_assimilation_update_v1");
  const state = memberByTypeV1(recordSet, "twin_state_estimate_v1");
  const forecast = memberByTypeV1(recordSet, "twin_forecast_run_v1");
  const tick = memberByTypeV1(recordSet, "twin_runtime_tick_v1");
  const checkpoint = memberByTypeV1(recordSet, "twin_runtime_checkpoint_v1");
  const health = memberByTypeV1(recordSet, "twin_runtime_health_v1");
  const aggregate = recordSet.aggregate_identity_input;
  const assimilation = assimilationMember.payload as unknown as AssimilatedContinuationUpdatePayloadV2;

  validateEvidenceClassificationsV1({
    evidence,
    assimilation,
    aggregate_digest: aggregate.evidence_window_semantic_digest,
  });

  exactRefV1(
    transition,
    "previous_posterior_ref",
    aggregate.previous_posterior_ref,
    "ASSIMILATED_TRANSITION_PREVIOUS_POSTERIOR_REF_MISMATCH",
  );
  if (transition.payload.previous_posterior_hash !== aggregate.previous_posterior_hash) {
    throw new Error("ASSIMILATED_TRANSITION_PREVIOUS_POSTERIOR_HASH_MISMATCH");
  }
  exactRefV1(
    transition,
    "evidence_window_ref",
    evidence.object_id,
    "ASSIMILATED_TRANSITION_EVIDENCE_REF_MISMATCH",
  );
  exactRefV1(
    transition,
    "assimilation_update_ref",
    assimilationMember.object_id,
    "ASSIMILATED_TRANSITION_ASSIMILATION_REF_MISMATCH",
  );
  exactRefV1(
    transition,
    "posterior_state_ref",
    state.object_id,
    "ASSIMILATED_TRANSITION_STATE_REF_MISMATCH",
  );
  if (transition.payload.current_runtime_config_ref !== aggregate.runtime_config_ref) {
    throw new Error("ASSIMILATED_TRANSITION_CURRENT_CONFIG_REF_MISMATCH");
  }

  exactRefV1(
    assimilationMember,
    "state_transition_ref",
    transition.object_id,
    "ASSIMILATED_UPDATE_TRANSITION_REF_MISMATCH",
  );
  exactRefV1(
    assimilationMember,
    "posterior_state_ref",
    state.object_id,
    "ASSIMILATED_UPDATE_STATE_REF_MISMATCH",
  );
  validatePosteriorStateV1({
    state,
    transition,
    assimilation_member: assimilationMember,
    evidence,
    aggregate,
  });

  exactRefV1(
    forecast,
    "source_posterior_ref",
    state.object_id,
    "ASSIMILATED_FORECAST_STATE_REF_MISMATCH",
  );
  if (forecast.payload.successful_forecast_ref !== null) {
    throw new Error("ASSIMILATED_FORECAST_SUCCESS_REF_FORBIDDEN");
  }

  if (tick.payload.record_set_contract_id !== ASSIMILATED_CONTINUATION_RECORD_SET_CONTRACT_ID_V2) {
    throw new Error("ASSIMILATED_TICK_CONTRACT_DISCRIMINATOR_MISMATCH");
  }
  exactRefV1(tick, "evidence_window_ref", evidence.object_id, "ASSIMILATED_TICK_EVIDENCE_REF_MISMATCH");
  exactRefV1(tick, "state_transition_ref", transition.object_id, "ASSIMILATED_TICK_TRANSITION_REF_MISMATCH");
  exactRefV1(tick, "assimilation_update_ref", assimilationMember.object_id, "ASSIMILATED_TICK_ASSIMILATION_REF_MISMATCH");
  exactRefV1(tick, "posterior_state_ref", state.object_id, "ASSIMILATED_TICK_STATE_REF_MISMATCH");
  exactRefV1(tick, "forecast_result_ref", forecast.object_id, "ASSIMILATED_TICK_FORECAST_REF_MISMATCH");
  exactRefV1(tick, "checkpoint_ref", checkpoint.object_id, "ASSIMILATED_TICK_CHECKPOINT_REF_MISMATCH");

  exactRefV1(
    checkpoint,
    "previous_checkpoint_ref",
    aggregate.previous_checkpoint_ref,
    "ASSIMILATED_CHECKPOINT_PREVIOUS_REF_MISMATCH",
  );
  exactRefV1(
    checkpoint,
    "last_completed_tick_ref",
    tick.object_id,
    "ASSIMILATED_CHECKPOINT_TICK_REF_MISMATCH",
  );
  exactRefV1(
    checkpoint,
    "last_posterior_state_ref",
    state.object_id,
    "ASSIMILATED_CHECKPOINT_STATE_REF_MISMATCH",
  );
  exactRefV1(
    checkpoint,
    "forecast_result_ref",
    forecast.object_id,
    "ASSIMILATED_CHECKPOINT_FORECAST_REF_MISMATCH",
  );
  if (checkpoint.payload.successful_forecast_ref !== null) {
    throw new Error("ASSIMILATED_CHECKPOINT_SUCCESS_REF_FORBIDDEN");
  }
  if (checkpoint.payload.next_tick_logical_time !== tick.payload.next_tick_logical_time) {
    throw new Error("ASSIMILATED_NEXT_TICK_TIME_MISMATCH");
  }
  const tickSequence = requiredFiniteNumberV1(
    checkpoint.payload.tick_sequence,
    "ASSIMILATED_CHECKPOINT_TICK_SEQUENCE_INVALID",
  );
  if (!Number.isInteger(tickSequence) || tickSequence < 1) {
    throw new Error("ASSIMILATED_CHECKPOINT_TICK_SEQUENCE_INVALID");
  }

  exactRefV1(health, "tick_ref", tick.object_id, "ASSIMILATED_HEALTH_TICK_REF_MISMATCH");
  exactRefV1(health, "checkpoint_ref", checkpoint.object_id, "ASSIMILATED_HEALTH_CHECKPOINT_REF_MISMATCH");
  exactRefV1(health, "state_ref", state.object_id, "ASSIMILATED_HEALTH_STATE_REF_MISMATCH");
  exactRefV1(health, "forecast_result_ref", forecast.object_id, "ASSIMILATED_HEALTH_FORECAST_REF_MISMATCH");
  if (health.payload.successful_forecast_ref !== null) {
    throw new Error("ASSIMILATED_HEALTH_SUCCESS_REF_FORBIDDEN");
  }
  if (health.payload.operation_status !== expectedHealthStatusV1(assimilation)) {
    throw new Error("ASSIMILATED_HEALTH_STATUS_DISPOSITION_MISMATCH");
  }
  if (health.payload.lineage_id !== recordSet.continuation_operation_key.lineage_id) {
    throw new Error("ASSIMILATED_HEALTH_LINEAGE_ID_MISMATCH");
  }
  if (health.payload.revision_id !== recordSet.continuation_operation_key.revision_id) {
    throw new Error("ASSIMILATED_HEALTH_REVISION_ID_MISMATCH");
  }
  requiredStringV1(
    health.payload.active_lineage_ref,
    "ASSIMILATED_HEALTH_ACTIVE_LINEAGE_REF_REQUIRED",
  );

  const baseWindow = requiredRecordV1(
    evidence.payload.base_continuation_window,
    "ASSIMILATED_EVIDENCE_BASE_WINDOW_REQUIRED",
  );
  const cropContext = requiredRecordV1(
    baseWindow.crop_stage_context,
    "ASSIMILATED_EVIDENCE_CROP_CONTEXT_REQUIRED",
  );
  if (
    cropContext.context_ref !== aggregate.crop_stage_context_ref
    || cropContext.context_hash !== aggregate.crop_stage_context_hash
  ) {
    throw new Error("ASSIMILATED_AGGREGATE_CROP_STAGE_CONTEXT_MISMATCH");
  }
}
