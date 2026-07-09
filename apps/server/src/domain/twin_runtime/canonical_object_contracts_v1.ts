// apps/server/src/domain/twin_runtime/canonical_object_contracts_v1.ts
// Purpose: define and validate the MCFT-CAP-01 Runtime Config and nine-member A0 canonical object subset, including the complete internal cross-reference graph.
// Boundary: contract validation only; no database, routes, wall clock, random values, filesystem, or network.

import { A0_MEMBER_OBJECT_TYPES_V1, computeA0RecordSetDeterminismHashV1, computeMemberDeterminismHashV1, deriveA0IdentityV1, type A0MemberObjectTypeV1, type A0SemanticSeedInputV1 } from "./canonical_identity_v1.js";

export type TwinCanonicalObjectTypeV1 = "twin_runtime_config_v1" | A0MemberObjectTypeV1;
export type CanonicalObjectEnvelopeV1 = {
  object_id: string; object_type: TwinCanonicalObjectTypeV1; schema_version: string;
  tenant_id: string; project_id: string; group_id: string | null; field_id: string; season_id: string | null; zone_id: string | null;
  logical_time: string; as_of: string; source_refs: string[]; evidence_refs: string[];
  runtime_config_ref: string | null; runtime_config_hash: string | null;
  idempotency_key: string; determinism_hash: string; limitations: string[]; created_at: string;
  lineage_id?: string; revision_id?: string; payload: Record<string, unknown>;
};

export type A0RecordSetV1 = {
  a0_identity_input: A0SemanticSeedInputV1;
  a0_semantic_seed: string;
  a0_record_set_id: string;
  a0_idempotency_key: string;
  a0_record_set_determinism_hash: string;
  members: CanonicalObjectEnvelopeV1[];
};

function requiredString(value: unknown, code: string): asserts value is string { if (typeof value !== "string" || !value.trim()) throw new Error(code); }
function requiredArray(value: unknown, code: string): asserts value is unknown[] { if (!Array.isArray(value)) throw new Error(code); }
function requiredObject(value: unknown, code: string): asserts value is Record<string, unknown> { if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(code); }

export function validateCanonicalObjectV1(object: CanonicalObjectEnvelopeV1): void {
  requiredString(object.object_id, "OBJECT_ID_REQUIRED");
  if (object.object_id.includes("random") || object.object_id.includes("uuid")) throw new Error("RANDOM_OBJECT_ID_FORBIDDEN");
  requiredString(object.object_type, "OBJECT_TYPE_REQUIRED"); requiredString(object.schema_version, "SCHEMA_VERSION_REQUIRED");
  requiredString(object.tenant_id, "TENANT_ID_REQUIRED"); requiredString(object.project_id, "PROJECT_ID_REQUIRED"); requiredString(object.field_id, "FIELD_ID_REQUIRED");
  requiredString(object.logical_time, "LOGICAL_TIME_REQUIRED"); requiredString(object.as_of, "AS_OF_REQUIRED"); requiredString(object.idempotency_key, "IDEMPOTENCY_KEY_REQUIRED");
  requiredString(object.determinism_hash, "DETERMINISM_HASH_REQUIRED"); requiredString(object.created_at, "CREATED_AT_REQUIRED");
  requiredArray(object.source_refs, "SOURCE_REFS_REQUIRED"); requiredArray(object.evidence_refs, "EVIDENCE_REFS_REQUIRED"); requiredArray(object.limitations, "LIMITATIONS_REQUIRED");
  if ("fact_id" in object) throw new Error("FACT_ID_SEMANTIC_ENVELOPE_FORBIDDEN");
  const computed = computeMemberDeterminismHashV1(object as unknown as Record<string, unknown>);
  if (computed !== object.determinism_hash) throw new Error("SEMANTIC_HASH_MISMATCH");
  const lineageMember = object.object_type !== "twin_runtime_config_v1" && object.object_type !== "twin_runtime_lineage_v1" && object.object_type !== "twin_runtime_health_v1";
  if (lineageMember && (!object.lineage_id || !object.revision_id)) throw new Error("LINEAGE_IDENTITY_REQUIRED");
  if (object.object_type === "twin_runtime_lineage_v1") {
    if (object.payload.lineage_kind !== "INITIAL") throw new Error("INITIAL_LINEAGE_REQUIRED");
    if (object.payload.parent_lineage_ref !== null || object.payload.revision_run_ref !== null) throw new Error("INITIAL_LINEAGE_NULL_REFS_REQUIRED");
    if (object.payload.promotion_ref != null) throw new Error("INITIAL_LINEAGE_PROMOTION_FORBIDDEN");
  }
  if (object.object_type === "twin_state_transition_v1") {
    if (object.payload.transition_kind !== "BOOTSTRAP") throw new Error("BOOTSTRAP_TRANSITION_REQUIRED");
    if (object.payload.previous_posterior_ref !== null) throw new Error("BOOTSTRAP_PREVIOUS_POSTERIOR_FORBIDDEN");
    if (object.payload.bootstrap_prior_ref != null) throw new Error("BOOTSTRAP_PRIOR_REF_FORBIDDEN");
    if (!object.payload.bootstrap_prior || object.payload.process_model_status !== "NOT_APPLIED_BOOTSTRAP") throw new Error("EMBEDDED_BOOTSTRAP_PRIOR_REQUIRED");
  }
  if (object.object_type === "twin_runtime_checkpoint_v1") {
    if (object.payload.checkpoint_kind !== "INITIAL" || object.payload.previous_checkpoint_ref !== null) throw new Error("INITIAL_CHECKPOINT_CONTRACT_VIOLATION");
  }
  if (object.object_type === "twin_forecast_run_v1") {
    if (object.payload.status !== "BLOCKED" || !Array.isArray(object.payload.points) || object.payload.points.length !== 0) throw new Error("BLOCKED_FORECAST_ZERO_POINTS_REQUIRED");
    if (!Array.isArray(object.payload.reason_codes) || object.payload.reason_codes.length === 0) throw new Error("BLOCKED_FORECAST_REASONS_REQUIRED");
    if (object.payload.scenario_eligible !== false) throw new Error("BLOCKED_FORECAST_SCENARIO_INELIGIBLE");
  }
  if (object.object_type === "twin_state_estimate_v1") {
    const confidence = object.payload.confidence as Record<string, unknown> | undefined;
    if (!confidence || confidence.status !== "NOT_ESTABLISHED" || confidence.reason_code !== "NO_CALIBRATED_CONFIDENCE_MODEL" || "score" in confidence) throw new Error("STATE_CONFIDENCE_CONTRACT_VIOLATION");
    const eligibility = object.payload.use_eligibility as Record<string, unknown> | undefined;
    if (!eligibility || eligibility.recommendation_input_eligible !== false || eligibility.action_input_eligible !== false) throw new Error("STATE_ELIGIBILITY_CONTRACT_VIOLATION");
  }
}

function memberByTypeV1(recordSet: A0RecordSetV1, type: A0MemberObjectTypeV1): CanonicalObjectEnvelopeV1 {
  const matches = recordSet.members.filter((member) => member.object_type === type);
  if (matches.length !== 1) throw new Error(`A0_MEMBER_TYPE_CARDINALITY:${type}`);
  return matches[0];
}

function exactPayloadRefV1(member: CanonicalObjectEnvelopeV1, field: string, expected: string, code: string): void {
  if (member.payload[field] !== expected) throw new Error(code);
}

function validateA0CrossReferenceGraphV1(recordSet: A0RecordSetV1): void {
  const lineage = memberByTypeV1(recordSet, "twin_runtime_lineage_v1");
  const evidence = memberByTypeV1(recordSet, "twin_evidence_window_v1");
  const transition = memberByTypeV1(recordSet, "twin_state_transition_v1");
  const assimilation = memberByTypeV1(recordSet, "twin_assimilation_update_v1");
  const state = memberByTypeV1(recordSet, "twin_state_estimate_v1");
  const forecast = memberByTypeV1(recordSet, "twin_forecast_run_v1");
  const tick = memberByTypeV1(recordSet, "twin_runtime_tick_v1");
  const checkpoint = memberByTypeV1(recordSet, "twin_runtime_checkpoint_v1");
  const health = memberByTypeV1(recordSet, "twin_runtime_health_v1");

  exactPayloadRefV1(lineage, "activation_authority_ref", lineage.object_id, "A0_REF_LINEAGE_ACTIVATION_AUTHORITY_MISMATCH");
  if (lineage.payload.initial_revision_id !== lineage.revision_id) throw new Error("A0_REF_LINEAGE_INITIAL_REVISION_MISMATCH");

  exactPayloadRefV1(transition, "evidence_window_ref", evidence.object_id, "A0_REF_TRANSITION_EVIDENCE_WINDOW_MISMATCH");
  exactPayloadRefV1(transition, "assimilation_update_ref", assimilation.object_id, "A0_REF_TRANSITION_ASSIMILATION_MISMATCH");
  exactPayloadRefV1(transition, "posterior_state_ref", state.object_id, "A0_REF_TRANSITION_POSTERIOR_MISMATCH");

  exactPayloadRefV1(assimilation, "state_transition_ref", transition.object_id, "A0_REF_ASSIMILATION_TRANSITION_MISMATCH");
  exactPayloadRefV1(assimilation, "posterior_state_ref", state.object_id, "A0_REF_ASSIMILATION_POSTERIOR_MISMATCH");
  requiredString(evidence.payload.assimilation_observation_ref, "A0_EVIDENCE_ASSIMILATION_OBSERVATION_REF_REQUIRED");
  if (assimilation.payload.observation_ref !== evidence.payload.assimilation_observation_ref) throw new Error("A0_REF_ASSIMILATION_OBSERVATION_MISMATCH");
  requiredArray(evidence.payload.selected_evidence_refs, "A0_EVIDENCE_SELECTED_REFS_REQUIRED");
  if (!evidence.payload.selected_evidence_refs.includes(evidence.payload.assimilation_observation_ref)) throw new Error("A0_REF_ASSIMILATION_OBSERVATION_NOT_IN_WINDOW");
  if (!assimilation.evidence_refs.includes(evidence.payload.assimilation_observation_ref as string)) throw new Error("A0_REF_ASSIMILATION_ENVELOPE_EVIDENCE_MISMATCH");

  exactPayloadRefV1(state, "transition_ref", transition.object_id, "A0_REF_STATE_TRANSITION_MISMATCH");
  exactPayloadRefV1(state, "assimilation_update_ref", assimilation.object_id, "A0_REF_STATE_ASSIMILATION_MISMATCH");
  exactPayloadRefV1(state, "evidence_window_ref", evidence.object_id, "A0_REF_STATE_EVIDENCE_WINDOW_MISMATCH");

  exactPayloadRefV1(forecast, "source_posterior_ref", state.object_id, "A0_REF_FORECAST_POSTERIOR_MISMATCH");

  exactPayloadRefV1(tick, "evidence_window_ref", evidence.object_id, "A0_REF_TICK_EVIDENCE_WINDOW_MISMATCH");
  exactPayloadRefV1(tick, "state_transition_ref", transition.object_id, "A0_REF_TICK_TRANSITION_MISMATCH");
  exactPayloadRefV1(tick, "assimilation_update_ref", assimilation.object_id, "A0_REF_TICK_ASSIMILATION_MISMATCH");
  exactPayloadRefV1(tick, "posterior_state_ref", state.object_id, "A0_REF_TICK_POSTERIOR_MISMATCH");
  exactPayloadRefV1(tick, "forecast_result_ref", forecast.object_id, "A0_REF_TICK_FORECAST_MISMATCH");
  exactPayloadRefV1(tick, "checkpoint_ref", checkpoint.object_id, "A0_REF_TICK_CHECKPOINT_MISMATCH");

  exactPayloadRefV1(checkpoint, "last_completed_tick_ref", tick.object_id, "A0_REF_CHECKPOINT_TICK_MISMATCH");
  exactPayloadRefV1(checkpoint, "last_posterior_state_ref", state.object_id, "A0_REF_CHECKPOINT_POSTERIOR_MISMATCH");
  exactPayloadRefV1(checkpoint, "forecast_result_ref", forecast.object_id, "A0_REF_CHECKPOINT_FORECAST_MISMATCH");
  if (checkpoint.payload.next_tick_logical_time !== tick.payload.next_tick_logical_time) throw new Error("A0_REF_NEXT_TICK_TIME_MISMATCH");

  exactPayloadRefV1(health, "tick_ref", tick.object_id, "A0_REF_HEALTH_TICK_MISMATCH");
  exactPayloadRefV1(health, "checkpoint_ref", checkpoint.object_id, "A0_REF_HEALTH_CHECKPOINT_MISMATCH");
  exactPayloadRefV1(health, "active_lineage_ref", lineage.object_id, "A0_REF_HEALTH_LINEAGE_MISMATCH");
  exactPayloadRefV1(health, "state_ref", state.object_id, "A0_REF_HEALTH_STATE_MISMATCH");
  exactPayloadRefV1(health, "forecast_result_ref", forecast.object_id, "A0_REF_HEALTH_FORECAST_MISMATCH");

  const runtimeConfigRefs = new Set(recordSet.members.map((member) => member.runtime_config_ref));
  const runtimeConfigHashes = new Set(recordSet.members.map((member) => member.runtime_config_hash));
  if (runtimeConfigRefs.size !== 1 || runtimeConfigRefs.has(null)) throw new Error("A0_RUNTIME_CONFIG_REFERENCE_MISMATCH");
  if (runtimeConfigHashes.size !== 1 || runtimeConfigHashes.has(null)) throw new Error("A0_RUNTIME_CONFIG_HASH_MISMATCH");
  if ([...runtimeConfigHashes][0] !== recordSet.a0_identity_input.runtime_config_hash) throw new Error("A0_RUNTIME_CONFIG_IDENTITY_HASH_MISMATCH");
}

export function validateA0RecordSetV1(recordSet: A0RecordSetV1): void {
  const derived = deriveA0IdentityV1(recordSet.a0_identity_input);
  if (derived.a0_semantic_seed !== recordSet.a0_semantic_seed) throw new Error("A0_SEMANTIC_SEED_MISMATCH");
  if (derived.a0_record_set_id !== recordSet.a0_record_set_id) throw new Error("A0_RECORD_SET_ID_MISMATCH");
  if (derived.a0_idempotency_key !== recordSet.a0_idempotency_key) throw new Error("A0_IDEMPOTENCY_KEY_MISMATCH");
  if (recordSet.members.length !== 9) throw new Error("A0_MEMBER_COUNT_MISMATCH");
  const types = recordSet.members.map((member) => member.object_type).sort();
  if (JSON.stringify(types) !== JSON.stringify([...A0_MEMBER_OBJECT_TYPES_V1].sort())) throw new Error("A0_MEMBER_TYPE_SET_MISMATCH");
  for (const member of recordSet.members) {
    validateCanonicalObjectV1(member);
    const expectedId = derived.member_object_ids[member.object_type as A0MemberObjectTypeV1];
    if (member.object_id !== expectedId) throw new Error("A0_MEMBER_OBJECT_ID_MISMATCH");
  }
  const lineageIds = new Set(recordSet.members.filter((member) => member.lineage_id).map((member) => member.lineage_id));
  const revisionIds = new Set(recordSet.members.filter((member) => member.revision_id).map((member) => member.revision_id));
  if (lineageIds.size !== 1 || revisionIds.size !== 1) throw new Error("A0_LINEAGE_REVISION_MISMATCH");
  validateA0CrossReferenceGraphV1(recordSet);
  const computed = computeA0RecordSetDeterminismHashV1({ a0_record_set_id: recordSet.a0_record_set_id, members: recordSet.members as unknown as Record<string, unknown>[] });
  if (computed !== recordSet.a0_record_set_determinism_hash) throw new Error("A0_AGGREGATE_HASH_MISMATCH");
}
