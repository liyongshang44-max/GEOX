// apps/server/src/domain/twin_runtime/continuation_contracts_v1.ts
// Purpose: validate the MCFT-CAP-02 eight-object continuation canonical subset, including CONTINUATION, NOT_APPLIED, BLOCKED Forecast, checkpoint sequence, and storage computation-basis contracts.
// Boundary: pure contract validation only; no persistence, equations, Evidence selection, filesystem, environment, clock, random values, network, or Runtime orchestration.

import { computeMemberDeterminismHashV1, semanticHashV1 } from "./canonical_identity_v1.js";
import type { CanonicalObjectEnvelopeV1 } from "./canonical_object_contracts_v1.js";
import {
  CONTINUATION_MEMBER_OBJECT_TYPES_V1,
  CONTINUATION_OPERATION_VARIANT_V1,
  type ContinuationMemberObjectTypeV1,
} from "./continuation_operation_identity_v1.js";
import {
  CONTINUATION_DYNAMICS_MODEL_ID_V1,
  CONTINUATION_FORECAST_BLOCK_POLICY_ID_V1,
  CONTINUATION_NO_OBSERVATION_POLICY_ID_V1,
} from "./continuation_runtime_config_v1.js";

export const CONTINUATION_FORECAST_REASON_CODES_V1 = [
  "FORECAST_MODEL_COMPONENT_NOT_CONFIGURED_IN_PINNED_RUNTIME_CONFIG",
  "SUCCESSFUL_FORECAST_NOT_AUTHORIZED_FOR_MCFT_CAP_02",
] as const;

export const CONTINUATION_TICK_LIMITATIONS_V1 = [
  "STATE_PROPAGATION_SUCCEEDED",
  "OBSERVATION_UPDATE_NOT_APPLIED",
  "FORECAST_BLOCKED_BY_PINNED_CONFIG_AND_CAPABILITY_BOUNDARY",
] as const;

export const CONTINUATION_ASSIMILATION_REASON_CODES_V1 = [
  "OBSERVATION_UPDATE_OUT_OF_SCOPE_MCFT_CAP_02",
] as const;

export const CONTINUATION_HEALTH_LIMITATION_REASON_CODES_V1 = [
  "OBSERVATION_UPDATE_OUT_OF_SCOPE_MCFT_CAP_02",
  "FORECAST_MODEL_COMPONENT_NOT_CONFIGURED_IN_PINNED_RUNTIME_CONFIG",
  "NO_CALIBRATED_CONFIDENCE_MODEL",
] as const;

function requiredStringV1(value: unknown, code: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(code);
  return value;
}

function requiredFiniteNumberV1(value: unknown, code: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(code);
  return value;
}

function requiredRecordV1(value: unknown, code: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(code);
  return value as Record<string, unknown>;
}

function requiredArrayV1(value: unknown, code: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(code);
  return value;
}

function exactV1(actual: unknown, expected: unknown, code: string): void {
  if (actual !== expected) throw new Error(code);
}

function exactArrayV1(actual: unknown, expected: readonly unknown[], code: string): void {
  if (!Array.isArray(actual) || JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(code);
}

function requireNullV1(value: unknown, code: string): void {
  if (value !== null) throw new Error(code);
}

function requireCanonicalIsoV1(value: unknown, code: string): string {
  const text = requiredStringV1(value, code);
  const parsed = Date.parse(text);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== text) throw new Error(code);
  return text;
}

function validateBaseEnvelopeV1(object: CanonicalObjectEnvelopeV1): void {
  requiredStringV1(object.object_id, "CONTINUATION_OBJECT_ID_REQUIRED");
  if (!CONTINUATION_MEMBER_OBJECT_TYPES_V1.includes(object.object_type as ContinuationMemberObjectTypeV1)) throw new Error("CONTINUATION_OBJECT_TYPE_NOT_ALLOWED");
  exactV1(object.schema_version, "v1", "CONTINUATION_SCHEMA_VERSION_MISMATCH");
  requiredStringV1(object.tenant_id, "CONTINUATION_TENANT_ID_REQUIRED");
  requiredStringV1(object.project_id, "CONTINUATION_PROJECT_ID_REQUIRED");
  requiredStringV1(object.group_id, "CONTINUATION_GROUP_ID_REQUIRED");
  requiredStringV1(object.field_id, "CONTINUATION_FIELD_ID_REQUIRED");
  requiredStringV1(object.season_id, "CONTINUATION_SEASON_ID_REQUIRED");
  requiredStringV1(object.zone_id, "CONTINUATION_ZONE_ID_REQUIRED");
  requireCanonicalIsoV1(object.logical_time, "CONTINUATION_LOGICAL_TIME_INVALID");
  exactV1(object.as_of, object.logical_time, "CONTINUATION_AS_OF_MISMATCH");
  requiredArrayV1(object.source_refs, "CONTINUATION_SOURCE_REFS_REQUIRED");
  requiredArrayV1(object.evidence_refs, "CONTINUATION_EVIDENCE_REFS_REQUIRED");
  requiredStringV1(object.runtime_config_ref, "CONTINUATION_RUNTIME_CONFIG_REF_REQUIRED");
  requiredStringV1(object.runtime_config_hash, "CONTINUATION_RUNTIME_CONFIG_HASH_REQUIRED");
  requiredStringV1(object.idempotency_key, "CONTINUATION_MEMBER_IDEMPOTENCY_KEY_REQUIRED");
  requiredStringV1(object.determinism_hash, "CONTINUATION_MEMBER_HASH_REQUIRED");
  requiredStringV1(object.lineage_id, "CONTINUATION_MEMBER_LINEAGE_ID_REQUIRED");
  requiredStringV1(object.revision_id, "CONTINUATION_MEMBER_REVISION_ID_REQUIRED");
  requiredArrayV1(object.limitations, "CONTINUATION_LIMITATIONS_REQUIRED");
  requiredStringV1(object.created_at, "CONTINUATION_CREATED_AT_REQUIRED");
  requiredRecordV1(object.payload, "CONTINUATION_PAYLOAD_REQUIRED");
  if ("fact_id" in object) throw new Error("CONTINUATION_FACT_ID_SEMANTIC_ENVELOPE_FORBIDDEN");
  const computed = computeMemberDeterminismHashV1(object as unknown as Record<string, unknown>);
  if (computed !== object.determinism_hash) throw new Error("CONTINUATION_MEMBER_SEMANTIC_HASH_MISMATCH");
}

function validateEvidenceWindowV1(object: CanonicalObjectEnvelopeV1): void {
  const payload = object.payload;
  exactV1(payload.frozen, true, "CONTINUATION_EVIDENCE_WINDOW_NOT_FROZEN");
  requiredStringV1(payload.window_rule_id, "CONTINUATION_EVIDENCE_WINDOW_RULE_REQUIRED");
  requireCanonicalIsoV1(payload.window_start_exclusive, "CONTINUATION_EVIDENCE_WINDOW_START_INVALID");
  exactV1(payload.window_end_inclusive, object.logical_time, "CONTINUATION_EVIDENCE_WINDOW_END_MISMATCH");
  requiredArrayV1(payload.entries, "CONTINUATION_EVIDENCE_ENTRIES_REQUIRED");
  requiredStringV1(payload.semantic_digest, "CONTINUATION_EVIDENCE_DIGEST_REQUIRED");
}

function validateTransitionV1(object: CanonicalObjectEnvelopeV1): void {
  const payload = object.payload;
  exactV1(payload.transition_kind, "CONTINUATION", "CONTINUATION_TRANSITION_KIND_MISMATCH");
  requiredStringV1(payload.previous_posterior_ref, "CONTINUATION_PREVIOUS_POSTERIOR_REF_REQUIRED");
  requiredStringV1(payload.previous_posterior_hash, "CONTINUATION_PREVIOUS_POSTERIOR_HASH_REQUIRED");
  exactV1(payload.process_model_status, "APPLIED", "CONTINUATION_PROCESS_MODEL_STATUS_MISMATCH");
  exactV1(payload.process_model_id, CONTINUATION_DYNAMICS_MODEL_ID_V1, "CONTINUATION_PROCESS_MODEL_ID_MISMATCH");
  exactV1(payload.process_model_version, 1, "CONTINUATION_PROCESS_MODEL_VERSION_MISMATCH");
  requireCanonicalIsoV1(payload.propagation_start, "CONTINUATION_PROPAGATION_START_INVALID");
  exactV1(payload.propagation_end, object.logical_time, "CONTINUATION_PROPAGATION_END_MISMATCH");
  if (Date.parse(object.logical_time) - Date.parse(payload.propagation_start as string) !== 60 * 60 * 1000) throw new Error("CONTINUATION_PROPAGATION_INTERVAL_MISMATCH");
  requiredStringV1(payload.previous_state_runtime_config_ref, "CONTINUATION_PREVIOUS_STATE_CONFIG_REF_REQUIRED");
  exactV1(payload.current_runtime_config_ref, object.runtime_config_ref, "CONTINUATION_CURRENT_CONFIG_REF_MISMATCH");
  const trace = requiredRecordV1(payload.mass_balance_trace, "CONTINUATION_MASS_BALANCE_TRACE_REQUIRED");
  for (const forbidden of ["trace_determinism_hash", "mass_balance_trace_hash", "self_hash"]) {
    if (forbidden in trace) throw new Error(`CONTINUATION_MASS_BALANCE_TRACE_SELF_HASH_FORBIDDEN:${forbidden}`);
  }
  const traceHash = requiredStringV1(payload.mass_balance_trace_hash, "CONTINUATION_MASS_BALANCE_TRACE_HASH_REQUIRED");
  if (semanticHashV1(trace) !== traceHash) throw new Error("CONTINUATION_MASS_BALANCE_TRACE_HASH_MISMATCH");
  requiredStringV1(payload.evidence_window_ref, "CONTINUATION_TRANSITION_EVIDENCE_REF_REQUIRED");
  requiredStringV1(payload.assimilation_update_ref, "CONTINUATION_TRANSITION_ASSIMILATION_REF_REQUIRED");
  requiredStringV1(payload.posterior_state_ref, "CONTINUATION_TRANSITION_POSTERIOR_REF_REQUIRED");
  if ("bootstrap_prior" in payload || "bootstrap_prior_ref" in payload) throw new Error("CONTINUATION_BOOTSTRAP_PRIOR_FORBIDDEN");
}

function validateAssimilationV1(object: CanonicalObjectEnvelopeV1): void {
  const payload = object.payload;
  exactV1(payload.status, "NOT_APPLIED", "CONTINUATION_ASSIMILATION_STATUS_MISMATCH");
  exactV1(payload.disposition, "DEFERRED_TO_MCFT_CAP_03", "CONTINUATION_ASSIMILATION_DISPOSITION_MISMATCH");
  requiredArrayV1(payload.candidate_observation_refs, "CONTINUATION_CANDIDATE_OBSERVATION_REFS_REQUIRED");
  exactArrayV1(payload.consumed_observation_refs, [], "CONTINUATION_CONSUMED_OBSERVATION_REFS_MUST_BE_EMPTY");
  for (const field of ["predicted_observation", "innovation", "residual", "assimilation_gain"]) requireNullV1(payload[field], `CONTINUATION_ASSIMILATION_${field.toUpperCase()}_MUST_BE_NULL`);
  const priorMean = requiredFiniteNumberV1(payload.prior_mean, "CONTINUATION_ASSIMILATION_PRIOR_MEAN_REQUIRED");
  const posteriorMean = requiredFiniteNumberV1(payload.posterior_mean, "CONTINUATION_ASSIMILATION_POSTERIOR_MEAN_REQUIRED");
  const priorVariance = requiredFiniteNumberV1(payload.prior_variance, "CONTINUATION_ASSIMILATION_PRIOR_VARIANCE_REQUIRED");
  const posteriorVariance = requiredFiniteNumberV1(payload.posterior_variance, "CONTINUATION_ASSIMILATION_POSTERIOR_VARIANCE_REQUIRED");
  if (priorMean !== posteriorMean || priorVariance !== posteriorVariance) throw new Error("CONTINUATION_NOT_APPLIED_ASSIMILATION_CHANGED_STATE");
  if (priorVariance < 0) throw new Error("CONTINUATION_ASSIMILATION_NEGATIVE_VARIANCE");
  exactArrayV1(payload.reason_codes, CONTINUATION_ASSIMILATION_REASON_CODES_V1, "CONTINUATION_ASSIMILATION_REASON_CODES_MISMATCH");
  exactV1(payload.policy_id, CONTINUATION_NO_OBSERVATION_POLICY_ID_V1, "CONTINUATION_ASSIMILATION_POLICY_MISMATCH");
  requiredStringV1(payload.state_transition_ref, "CONTINUATION_ASSIMILATION_TRANSITION_REF_REQUIRED");
  requiredStringV1(payload.posterior_state_ref, "CONTINUATION_ASSIMILATION_STATE_REF_REQUIRED");
}

function validateDecimalBasisV1(value: unknown, code: string): Record<string, unknown> {
  const decimal = requiredRecordV1(value, code);
  requiredStringV1(decimal.value, `${code}_VALUE_REQUIRED`);
  const scale = requiredFiniteNumberV1(decimal.scale, `${code}_SCALE_REQUIRED`);
  if (!Number.isInteger(scale) || scale < 0) throw new Error(`${code}_SCALE_INVALID`);
  return decimal;
}

function validateStateV1(object: CanonicalObjectEnvelopeV1): void {
  const payload = object.payload;
  exactV1(payload.state_kind, "POSTERIOR", "CONTINUATION_STATE_KIND_MISMATCH");
  requiredStringV1(payload.previous_posterior_ref, "CONTINUATION_STATE_PREVIOUS_POSTERIOR_REF_REQUIRED");
  requiredStringV1(payload.transition_ref, "CONTINUATION_STATE_TRANSITION_REF_REQUIRED");
  requiredStringV1(payload.assimilation_update_ref, "CONTINUATION_STATE_ASSIMILATION_REF_REQUIRED");
  requiredStringV1(payload.evidence_window_ref, "CONTINUATION_STATE_EVIDENCE_REF_REQUIRED");
  exactV1(payload.reality_binding_ref, requiredStringV1(payload.reality_binding_ref, "CONTINUATION_STATE_REALITY_REF_REQUIRED"), "CONTINUATION_STATE_REALITY_REF_INVALID");
  requiredStringV1(payload.reality_binding_hash, "CONTINUATION_STATE_REALITY_HASH_REQUIRED");
  const basis = requiredRecordV1(payload.computation_basis, "CONTINUATION_COMPUTATION_BASIS_REQUIRED");
  if (basis.basis_origin !== "DERIVED_FROM_MCFT_CAP_01_POSTERIOR_V1" && basis.basis_origin !== "CARRIED_FROM_PREVIOUS_CONTINUATION_STATE") throw new Error("CONTINUATION_COMPUTATION_BASIS_ORIGIN_MISMATCH");
  validateDecimalBasisV1(basis.storage_mean_mm_decimal, "CONTINUATION_STORAGE_MEAN_DECIMAL");
  validateDecimalBasisV1(basis.storage_variance_mm2_decimal, "CONTINUATION_STORAGE_VARIANCE_DECIMAL");
  if (basis.basis_origin === "DERIVED_FROM_MCFT_CAP_01_POSTERIOR_V1") {
    requiredStringV1(basis.source_posterior_ref, "CONTINUATION_FIRST_BRIDGE_SOURCE_POSTERIOR_REQUIRED");
    requiredStringV1(basis.source_vwc_variance, "CONTINUATION_FIRST_BRIDGE_SOURCE_VARIANCE_REQUIRED");
    requiredStringV1(basis.root_zone_depth_mm, "CONTINUATION_FIRST_BRIDGE_DEPTH_REQUIRED");
  } else {
    requiredStringV1(basis.previous_state_ref, "CONTINUATION_CARRIED_BASIS_PREVIOUS_STATE_REQUIRED");
    validateDecimalBasisV1(basis.previous_storage_mean_mm_decimal, "CONTINUATION_PREVIOUS_STORAGE_MEAN_DECIMAL");
    validateDecimalBasisV1(basis.previous_storage_variance_mm2_decimal, "CONTINUATION_PREVIOUS_STORAGE_VARIANCE_DECIMAL");
  }
  requiredRecordV1(payload.root_zone_storage_mm, "CONTINUATION_STATE_STORAGE_REQUIRED");
  requiredRecordV1(payload.root_zone_vwc_fraction, "CONTINUATION_STATE_VWC_REQUIRED");
  requiredRecordV1(payload.uncertainty, "CONTINUATION_STATE_UNCERTAINTY_REQUIRED");
  requiredFiniteNumberV1(payload.available_water_fraction, "CONTINUATION_STATE_AWF_REQUIRED");
  requiredFiniteNumberV1(payload.depletion_from_field_capacity_mm, "CONTINUATION_STATE_DEPLETION_REQUIRED");
  requiredStringV1(payload.mass_balance_trace_hash, "CONTINUATION_STATE_TRACE_HASH_REQUIRED");
  const confidence = requiredRecordV1(payload.confidence, "CONTINUATION_STATE_CONFIDENCE_REQUIRED");
  exactV1(confidence.status, "NOT_ESTABLISHED", "CONTINUATION_STATE_CONFIDENCE_STATUS_MISMATCH");
  exactV1(confidence.reason_code, "NO_CALIBRATED_CONFIDENCE_MODEL", "CONTINUATION_STATE_CONFIDENCE_REASON_MISMATCH");
  if ("numeric_score" in confidence || "score" in confidence) throw new Error("CONTINUATION_NUMERIC_CONFIDENCE_FORBIDDEN");
  const eligibility = requiredRecordV1(payload.use_eligibility, "CONTINUATION_STATE_ELIGIBILITY_REQUIRED");
  exactV1(eligibility.state_valid, true, "CONTINUATION_STATE_VALIDITY_MISMATCH");
  exactV1(eligibility.posterior_chain_eligible, true, "CONTINUATION_POSTERIOR_CHAIN_ELIGIBILITY_MISMATCH");
  exactV1(eligibility.forecast_source_eligible, true, "CONTINUATION_FORECAST_SOURCE_ELIGIBILITY_MISMATCH");
  exactV1(eligibility.recommendation_input_eligible, false, "CONTINUATION_RECOMMENDATION_ELIGIBILITY_FORBIDDEN");
  exactV1(eligibility.action_input_eligible, false, "CONTINUATION_ACTION_ELIGIBILITY_FORBIDDEN");
  if ("scenario_input_eligible" in eligibility) throw new Error("CONTINUATION_STATE_SCENARIO_INPUT_ELIGIBILITY_FORBIDDEN");
}

function validateForecastV1(object: CanonicalObjectEnvelopeV1): void {
  const payload = object.payload;
  exactV1(payload.status, "BLOCKED", "CONTINUATION_FORECAST_STATUS_MISMATCH");
  exactArrayV1(payload.points, [], "CONTINUATION_FORECAST_POINTS_MUST_BE_EMPTY");
  exactV1(payload.scenario_eligible, false, "CONTINUATION_FORECAST_SCENARIO_ELIGIBILITY_MISMATCH");
  requiredStringV1(payload.source_posterior_ref, "CONTINUATION_FORECAST_SOURCE_STATE_REQUIRED");
  requireNullV1(payload.successful_forecast_ref, "CONTINUATION_SUCCESSFUL_FORECAST_REF_MUST_BE_NULL");
  exactArrayV1(payload.reason_codes, CONTINUATION_FORECAST_REASON_CODES_V1, "CONTINUATION_FORECAST_REASON_CODES_MISMATCH");
  exactV1(payload.policy_id, CONTINUATION_FORECAST_BLOCK_POLICY_ID_V1, "CONTINUATION_FORECAST_POLICY_MISMATCH");
}

function validateTickV1(object: CanonicalObjectEnvelopeV1): void {
  const payload = object.payload;
  exactV1(payload.transaction_family, "A_STATE_TICK_COMMIT", "CONTINUATION_TICK_TRANSACTION_FAMILY_MISMATCH");
  exactV1(payload.operation_variant, CONTINUATION_OPERATION_VARIANT_V1, "CONTINUATION_TICK_OPERATION_VARIANT_MISMATCH");
  exactV1(payload.status, "COMPLETED_WITH_LIMITATIONS", "CONTINUATION_TICK_STATUS_MISMATCH");
  exactV1(payload.transition_kind, "CONTINUATION", "CONTINUATION_TICK_TRANSITION_KIND_MISMATCH");
  exactArrayV1(payload.limitations, CONTINUATION_TICK_LIMITATIONS_V1, "CONTINUATION_TICK_LIMITATIONS_MISMATCH");
  for (const field of ["evidence_window_ref", "state_transition_ref", "assimilation_update_ref", "posterior_state_ref", "forecast_result_ref", "checkpoint_ref", "next_tick_logical_time"]) requiredStringV1(payload[field], `CONTINUATION_TICK_${field.toUpperCase()}_REQUIRED`);
}

export function resolvePreviousCheckpointTickSequenceV1(previousCheckpoint: CanonicalObjectEnvelopeV1): number {
  if (previousCheckpoint.object_type !== "twin_runtime_checkpoint_v1") throw new Error("PREVIOUS_CHECKPOINT_OBJECT_TYPE_MISMATCH");
  const explicit = previousCheckpoint.payload.tick_sequence;
  if (typeof explicit === "number" && Number.isInteger(explicit) && explicit >= 0) return explicit;
  if (previousCheckpoint.payload.checkpoint_kind === "INITIAL") return 0;
  throw new Error("PREVIOUS_CHECKPOINT_TICK_SEQUENCE_REQUIRED");
}

function validateCheckpointV1(object: CanonicalObjectEnvelopeV1): void {
  const payload = object.payload;
  exactV1(payload.checkpoint_kind, "CONTINUATION", "CONTINUATION_CHECKPOINT_KIND_MISMATCH");
  requiredStringV1(payload.previous_checkpoint_ref, "CONTINUATION_PREVIOUS_CHECKPOINT_REF_REQUIRED");
  requiredStringV1(payload.last_completed_tick_ref, "CONTINUATION_CHECKPOINT_TICK_REF_REQUIRED");
  requiredStringV1(payload.last_posterior_state_ref, "CONTINUATION_CHECKPOINT_STATE_REF_REQUIRED");
  requiredStringV1(payload.forecast_result_ref, "CONTINUATION_CHECKPOINT_FORECAST_REF_REQUIRED");
  requireNullV1(payload.successful_forecast_ref, "CONTINUATION_CHECKPOINT_SUCCESSFUL_FORECAST_REF_MUST_BE_NULL");
  const nextTick = requireCanonicalIsoV1(payload.next_tick_logical_time, "CONTINUATION_CHECKPOINT_NEXT_TICK_INVALID");
  if (Date.parse(nextTick) - Date.parse(object.logical_time) !== 60 * 60 * 1000) throw new Error("CONTINUATION_CHECKPOINT_NEXT_TICK_INTERVAL_MISMATCH");
  const sequence = requiredFiniteNumberV1(payload.tick_sequence, "CONTINUATION_CHECKPOINT_TICK_SEQUENCE_REQUIRED");
  if (!Number.isInteger(sequence) || sequence < 1) throw new Error("CONTINUATION_CHECKPOINT_TICK_SEQUENCE_INVALID");
}

function validateHealthV1(object: CanonicalObjectEnvelopeV1): void {
  const payload = object.payload;
  exactV1(payload.operation_status, "CONTINUATION_STATE_COMMITTED_WITH_BLOCKED_FORECAST", "CONTINUATION_HEALTH_OPERATION_STATUS_MISMATCH");
  exactV1(payload.runtime_mode, "REPLAY", "CONTINUATION_HEALTH_RUNTIME_MODE_MISMATCH");
  for (const field of ["active_lineage_ref", "lineage_id", "revision_id", "tick_ref", "checkpoint_ref", "state_ref", "forecast_result_ref"]) requiredStringV1(payload[field], `CONTINUATION_HEALTH_${field.toUpperCase()}_REQUIRED`);
  requireNullV1(payload.successful_forecast_ref, "CONTINUATION_HEALTH_SUCCESSFUL_FORECAST_REF_MUST_BE_NULL");
  exactArrayV1(payload.limitation_reason_codes, CONTINUATION_HEALTH_LIMITATION_REASON_CODES_V1, "CONTINUATION_HEALTH_LIMITATION_CODES_MISMATCH");
  for (const forbidden of ["recommendation_ref", "action_ref", "water_stress_state"]) {
    if (forbidden in payload) throw new Error(`CONTINUATION_HEALTH_FORBIDDEN_FIELD:${forbidden}`);
  }
}

export function validateContinuationMemberV1(object: CanonicalObjectEnvelopeV1): void {
  validateBaseEnvelopeV1(object);
  switch (object.object_type as ContinuationMemberObjectTypeV1) {
    case "twin_evidence_window_v1": validateEvidenceWindowV1(object); break;
    case "twin_state_transition_v1": validateTransitionV1(object); break;
    case "twin_assimilation_update_v1": validateAssimilationV1(object); break;
    case "twin_state_estimate_v1": validateStateV1(object); break;
    case "twin_forecast_run_v1": validateForecastV1(object); break;
    case "twin_runtime_tick_v1": validateTickV1(object); break;
    case "twin_runtime_checkpoint_v1": validateCheckpointV1(object); break;
    case "twin_runtime_health_v1": validateHealthV1(object); break;
    default: throw new Error("CONTINUATION_OBJECT_TYPE_NOT_ALLOWED");
  }
}
