// Purpose: define the deterministic persisted MCFT-CAP-08.S3 semantic completion tuple and T09 Outcome-absence witness reconstructed from canonical PostgreSQL facts.
// Boundary: pure contracts and identity validation only; no database, persistence, Runtime execution, route, scheduler, clock, filesystem, environment, or production authority.

import {
  deriveSemanticObjectIdV1,
  semanticHashV1,
} from "./canonical_identity_v1.js";
import {
  CAP08_S1_RUN_CONTRACT_ID_V1,
  cap08TickLogicalTimeV1,
  type Cap08ScopeV1,
} from "./cap08_phase_engine_contracts_v1.js";
import {
  CAP08_S3_FORMAL_PROVIDER_CONTRACT_DIGEST_V1,
  CAP08_S3_FORMAL_PROVIDER_PROFILE_ID_V1,
  CAP08_S3_OUTCOME_FVO_ID_V1,
  type Cap08S3ProviderTickTraceV1,
} from "./cap08_s3_formal_provider_contracts_v1.js";

export const CAP08_S3_COMPLETION_TUPLE_RECORD_TYPE_V1 =
  "mcft_cap08_s3_completion_tuple_v1" as const;
export const CAP08_S3_COMPLETION_TUPLE_SCHEMA_VERSION_V1 =
  "geox_mcft_cap08_s3_completion_tuple_v1" as const;
export const CAP08_S3_OUTCOME_ABSENCE_WITNESS_RECORD_TYPE_V1 =
  "mcft_cap08_s3_outcome_absence_witness_v1" as const;
export const CAP08_S3_OUTCOME_ABSENCE_WITNESS_SCHEMA_VERSION_V1 =
  "geox_mcft_cap08_s3_outcome_absence_witness_v1" as const;

export type Cap08S3RefHashTimeV1 = {
  ref: string;
  hash: string;
  logical_time: string;
};

export type Cap08S3RefHashAvailabilityV1 = Cap08S3RefHashTimeV1 & {
  available_to_runtime_at: string;
};

export type Cap08S3PersistedTickBindingV1 = {
  tick_id: string;
  logical_time: string;
  tick_ref: string;
  tick_hash: string;
  evidence_window_ref: string;
  evidence_window_hash: string;
  assimilation_update_ref: string;
  assimilation_update_hash: string;
  provider_trace_digest: string;
};

export type Cap08S3OutcomeAbsenceWitnessV1 = {
  schema_version: typeof CAP08_S3_OUTCOME_ABSENCE_WITNESS_SCHEMA_VERSION_V1;
  record_type: typeof CAP08_S3_OUTCOME_ABSENCE_WITNESS_RECORD_TYPE_V1;
  source_record_id: string;
  source_record_hash: string;
  formal_run_id: string;
  scope: Cap08ScopeV1;
  logical_time: string;
  evidence_cutoff_time: string;
  target_source_record_id: typeof CAP08_S3_OUTCOME_FVO_ID_V1;
  target_record_type: "soil_moisture_observation_v1";
  visible_identity_count: 0;
  selected_observation_ref: null;
  assimilation_applied_evidence_refs: [];
  witness_policy_id: "EXACT_PERSISTED_FVO10_NOT_VISIBLE_AT_T09_V1";
};

export type Cap08S3CompletionTupleV1 = {
  schema_version: typeof CAP08_S3_COMPLETION_TUPLE_SCHEMA_VERSION_V1;
  record_type: typeof CAP08_S3_COMPLETION_TUPLE_RECORD_TYPE_V1;
  tuple_ref: string;
  run_contract_id: typeof CAP08_S1_RUN_CONTRACT_ID_V1;
  formal_run_id: string;
  scope: Cap08ScopeV1;
  provider_profile_id: typeof CAP08_S3_FORMAL_PROVIDER_PROFILE_ID_V1;
  provider_contract_digest: typeof CAP08_S3_FORMAL_PROVIDER_CONTRACT_DIGEST_V1;
  phase_engine_source_digest: string;
  decision: Cap08S3RefHashTimeV1;
  approval_assertion: Cap08S3RefHashAvailabilityV1;
  approved_plan: Cap08S3RefHashAvailabilityV1 & {
    effective_from: string;
  };
  execution_receipt: Cap08S3RefHashAvailabilityV1;
  action_feedback: Cap08S3RefHashAvailabilityV1;
  t08: {
    tick_ref: string;
    tick_hash: string;
    evidence_window_ref: string;
    evidence_window_hash: string;
    action_feedback_ref: string;
    action_feedback_hash: string;
    dynamics_consumed_evidence_refs: string[];
  };
  t09: {
    tick_ref: string;
    tick_hash: string;
    evidence_window_ref: string;
    evidence_window_hash: string;
    assimilation_update_ref: string;
    assimilation_update_hash: string;
    absence_witness_ref: string;
    absence_witness_hash: string;
    selected_observation_ref: null;
    assimilation_applied_evidence_refs: [];
  };
  t10: {
    tick_ref: string;
    tick_hash: string;
    evidence_window_ref: string;
    evidence_window_hash: string;
    assimilation_update_ref: string;
    assimilation_update_hash: string;
    outcome_fvo10_ref: typeof CAP08_S3_OUTCOME_FVO_ID_V1;
    outcome_fvo10_hash: string;
    selected_observation_ref: typeof CAP08_S3_OUTCOME_FVO_ID_V1;
    assimilation_applied_evidence_refs: [typeof CAP08_S3_OUTCOME_FVO_ID_V1];
  };
  tick_bindings: Cap08S3PersistedTickBindingV1[];
  tick_trace_digests: string[];
  determinism_hash: string;
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

function digestV1(value: unknown, code: string): string {
  const text = requiredStringV1(value, code);
  if (!/^sha256:[0-9a-f]{64}$/.test(text)) throw new Error(code);
  return text;
}

function exactScopeV1(scope: Cap08ScopeV1): Cap08ScopeV1 {
  const copy = structuredClone(scope);
  for (const field of ["tenant_id", "project_id", "group_id", "field_id", "season_id", "zone_id"] as const) {
    requiredStringV1(copy[field], `CAP08_S3_COMPLETION_SCOPE_${field.toUpperCase()}_REQUIRED`);
  }
  return copy;
}

function sameScopeV1(left: Cap08ScopeV1, right: Cap08ScopeV1): boolean {
  return JSON.stringify(exactScopeV1(left)) === JSON.stringify(exactScopeV1(right));
}

function exactRefHashTimeV1(value: Cap08S3RefHashTimeV1, code: string): void {
  requiredStringV1(value?.ref, `${code}_REF_REQUIRED`);
  digestV1(value?.hash, `${code}_HASH_REQUIRED`);
  canonicalIsoV1(value?.logical_time, `${code}_LOGICAL_TIME_INVALID`);
}

function exactRefHashAvailabilityV1(value: Cap08S3RefHashAvailabilityV1, code: string): void {
  exactRefHashTimeV1(value, code);
  canonicalIsoV1(value?.available_to_runtime_at, `${code}_AVAILABLE_AT_INVALID`);
}

function tupleSemanticV1(value: Omit<Cap08S3CompletionTupleV1, "determinism_hash">): Omit<Cap08S3CompletionTupleV1, "determinism_hash"> {
  return structuredClone(value);
}

export function cap08S3CompletionTupleRefV1(input: {
  formal_run_id: string;
  scope: Cap08ScopeV1;
  phase_engine_source_digest: string;
}): string {
  return deriveSemanticObjectIdV1("cap08_s3_completion_tuple", {
    run_contract_id: CAP08_S1_RUN_CONTRACT_ID_V1,
    formal_run_id: requiredStringV1(input.formal_run_id, "CAP08_S3_COMPLETION_FORMAL_RUN_REQUIRED"),
    scope: exactScopeV1(input.scope),
    provider_contract_digest: CAP08_S3_FORMAL_PROVIDER_CONTRACT_DIGEST_V1,
    phase_engine_source_digest: digestV1(input.phase_engine_source_digest, "CAP08_S3_COMPLETION_SOURCE_DIGEST_INVALID"),
  });
}

export function buildCap08S3OutcomeAbsenceWitnessV1(input: {
  formal_run_id: string;
  scope: Cap08ScopeV1;
}): Cap08S3OutcomeAbsenceWitnessV1 {
  const formalRunId = requiredStringV1(input.formal_run_id, "CAP08_S3_ABSENCE_FORMAL_RUN_REQUIRED");
  const scope = exactScopeV1(input.scope);
  const logicalTime = cap08TickLogicalTimeV1(9);
  const semantic = {
    schema_version: CAP08_S3_OUTCOME_ABSENCE_WITNESS_SCHEMA_VERSION_V1,
    record_type: CAP08_S3_OUTCOME_ABSENCE_WITNESS_RECORD_TYPE_V1,
    formal_run_id: formalRunId,
    scope,
    logical_time: logicalTime,
    evidence_cutoff_time: logicalTime,
    target_source_record_id: CAP08_S3_OUTCOME_FVO_ID_V1,
    target_record_type: "soil_moisture_observation_v1" as const,
    visible_identity_count: 0 as const,
    selected_observation_ref: null,
    assimilation_applied_evidence_refs: [] as [],
    witness_policy_id: "EXACT_PERSISTED_FVO10_NOT_VISIBLE_AT_T09_V1" as const,
  };
  const sourceRecordId = deriveSemanticObjectIdV1("cap08_s3_outcome_absence_witness", semantic);
  return {
    ...semantic,
    source_record_id: sourceRecordId,
    source_record_hash: semanticHashV1({ ...semantic, source_record_id: sourceRecordId }),
  };
}

export function validateCap08S3OutcomeAbsenceWitnessV1(value: Cap08S3OutcomeAbsenceWitnessV1): void {
  const expected = buildCap08S3OutcomeAbsenceWitnessV1({
    formal_run_id: value.formal_run_id,
    scope: value.scope,
  });
  if (semanticHashV1(value) !== semanticHashV1(expected)) throw new Error("CAP08_S3_ABSENCE_WITNESS_MISMATCH");
}

export function buildCap08S3CompletionTupleV1(input: {
  formal_run_id: string;
  scope: Cap08ScopeV1;
  phase_engine_source_digest: string;
  decision: Cap08S3RefHashTimeV1;
  approval_assertion: Cap08S3RefHashAvailabilityV1;
  approved_plan: Cap08S3RefHashAvailabilityV1 & { effective_from: string };
  execution_receipt: Cap08S3RefHashAvailabilityV1;
  action_feedback: Cap08S3RefHashAvailabilityV1;
  t08: Cap08S3CompletionTupleV1["t08"];
  t09: Cap08S3CompletionTupleV1["t09"];
  t10: Cap08S3CompletionTupleV1["t10"];
  tick_bindings: Cap08S3PersistedTickBindingV1[];
  tick_traces: Cap08S3ProviderTickTraceV1[];
}): Cap08S3CompletionTupleV1 {
  const formalRunId = requiredStringV1(input.formal_run_id, "CAP08_S3_COMPLETION_FORMAL_RUN_REQUIRED");
  const scope = exactScopeV1(input.scope);
  const sourceDigest = digestV1(input.phase_engine_source_digest, "CAP08_S3_COMPLETION_SOURCE_DIGEST_INVALID");
  const tupleRef = cap08S3CompletionTupleRefV1({ formal_run_id: formalRunId, scope, phase_engine_source_digest: sourceDigest });
  const semantic: Omit<Cap08S3CompletionTupleV1, "determinism_hash"> = {
    schema_version: CAP08_S3_COMPLETION_TUPLE_SCHEMA_VERSION_V1,
    record_type: CAP08_S3_COMPLETION_TUPLE_RECORD_TYPE_V1,
    tuple_ref: tupleRef,
    run_contract_id: CAP08_S1_RUN_CONTRACT_ID_V1,
    formal_run_id: formalRunId,
    scope,
    provider_profile_id: CAP08_S3_FORMAL_PROVIDER_PROFILE_ID_V1,
    provider_contract_digest: CAP08_S3_FORMAL_PROVIDER_CONTRACT_DIGEST_V1,
    phase_engine_source_digest: sourceDigest,
    decision: structuredClone(input.decision),
    approval_assertion: structuredClone(input.approval_assertion),
    approved_plan: structuredClone(input.approved_plan),
    execution_receipt: structuredClone(input.execution_receipt),
    action_feedback: structuredClone(input.action_feedback),
    t08: structuredClone(input.t08),
    t09: structuredClone(input.t09),
    t10: structuredClone(input.t10),
    tick_bindings: structuredClone(input.tick_bindings),
    tick_trace_digests: input.tick_traces.map((trace) => trace.trace_digest),
  };
  const tuple = { ...semantic, determinism_hash: semanticHashV1(tupleSemanticV1(semantic)) };
  validateCap08S3CompletionTupleV1(tuple);
  return tuple;
}

export function validateCap08S3CompletionTupleV1(value: Cap08S3CompletionTupleV1): void {
  if (value.schema_version !== CAP08_S3_COMPLETION_TUPLE_SCHEMA_VERSION_V1
    || value.record_type !== CAP08_S3_COMPLETION_TUPLE_RECORD_TYPE_V1
    || value.run_contract_id !== CAP08_S1_RUN_CONTRACT_ID_V1
    || value.provider_profile_id !== CAP08_S3_FORMAL_PROVIDER_PROFILE_ID_V1
    || value.provider_contract_digest !== CAP08_S3_FORMAL_PROVIDER_CONTRACT_DIGEST_V1) {
    throw new Error("CAP08_S3_COMPLETION_CONTRACT_MISMATCH");
  }
  requiredStringV1(value.formal_run_id, "CAP08_S3_COMPLETION_FORMAL_RUN_REQUIRED");
  exactScopeV1(value.scope);
  digestV1(value.phase_engine_source_digest, "CAP08_S3_COMPLETION_SOURCE_DIGEST_INVALID");
  if (value.tuple_ref !== cap08S3CompletionTupleRefV1(value)) throw new Error("CAP08_S3_COMPLETION_TUPLE_REF_MISMATCH");
  exactRefHashTimeV1(value.decision, "CAP08_S3_COMPLETION_DECISION");
  exactRefHashAvailabilityV1(value.approval_assertion, "CAP08_S3_COMPLETION_APPROVAL");
  exactRefHashAvailabilityV1(value.approved_plan, "CAP08_S3_COMPLETION_PLAN");
  canonicalIsoV1(value.approved_plan.effective_from, "CAP08_S3_COMPLETION_PLAN_EFFECTIVE_FROM_INVALID");
  exactRefHashAvailabilityV1(value.execution_receipt, "CAP08_S3_COMPLETION_RECEIPT");
  exactRefHashAvailabilityV1(value.action_feedback, "CAP08_S3_COMPLETION_FEEDBACK");
  if (value.decision.logical_time !== cap08TickLogicalTimeV1(5)
    || value.approval_assertion.available_to_runtime_at !== cap08TickLogicalTimeV1(6)
    || value.approved_plan.available_to_runtime_at !== cap08TickLogicalTimeV1(6)
    || value.execution_receipt.available_to_runtime_at !== cap08TickLogicalTimeV1(8)
    || value.action_feedback.available_to_runtime_at !== cap08TickLogicalTimeV1(8)) {
    throw new Error("CAP08_S3_COMPLETION_EPISODE_TIME_MISMATCH");
  }
  if (value.t08.action_feedback_ref !== value.action_feedback.ref
    || value.t08.action_feedback_hash !== value.action_feedback.hash
    || !value.t08.dynamics_consumed_evidence_refs.includes(value.action_feedback.ref)) {
    throw new Error("CAP08_S3_COMPLETION_T08_H_CONSUMPTION_MISMATCH");
  }
  if (value.t09.selected_observation_ref !== null
    || value.t09.assimilation_applied_evidence_refs.length !== 0) {
    throw new Error("CAP08_S3_COMPLETION_T09_ABSENCE_MISMATCH");
  }
  if (value.t10.outcome_fvo10_ref !== CAP08_S3_OUTCOME_FVO_ID_V1
    || value.t10.selected_observation_ref !== CAP08_S3_OUTCOME_FVO_ID_V1
    || JSON.stringify(value.t10.assimilation_applied_evidence_refs) !== JSON.stringify([CAP08_S3_OUTCOME_FVO_ID_V1])) {
    throw new Error("CAP08_S3_COMPLETION_T10_ASSIMILATION_MISMATCH");
  }
  if (value.tick_bindings.length !== 24 || value.tick_trace_digests.length !== 24) {
    throw new Error("CAP08_S3_COMPLETION_TICK_CARDINALITY_MISMATCH");
  }
  const tickIds = new Set<string>();
  const traceDigests = new Set<string>();
  for (let index = 0; index < 24; index += 1) {
    const binding = value.tick_bindings[index];
    const expectedTickId = `T${String(index).padStart(2, "0")}`;
    if (binding.tick_id !== expectedTickId || binding.logical_time !== cap08TickLogicalTimeV1(index)) {
      throw new Error(`CAP08_S3_COMPLETION_TICK_ORDER_MISMATCH:${expectedTickId}`);
    }
    for (const [field, current] of Object.entries({
      tick_ref: binding.tick_ref,
      evidence_window_ref: binding.evidence_window_ref,
      assimilation_update_ref: binding.assimilation_update_ref,
    })) requiredStringV1(current, `CAP08_S3_COMPLETION_${field.toUpperCase()}_REQUIRED`);
    for (const [field, current] of Object.entries({
      tick_hash: binding.tick_hash,
      evidence_window_hash: binding.evidence_window_hash,
      assimilation_update_hash: binding.assimilation_update_hash,
      provider_trace_digest: binding.provider_trace_digest,
    })) digestV1(current, `CAP08_S3_COMPLETION_${field.toUpperCase()}_INVALID`);
    if (binding.provider_trace_digest !== value.tick_trace_digests[index]) {
      throw new Error(`CAP08_S3_COMPLETION_TRACE_BINDING_MISMATCH:${expectedTickId}`);
    }
    tickIds.add(binding.tick_id);
    traceDigests.add(binding.provider_trace_digest);
  }
  if (tickIds.size !== 24 || traceDigests.size !== 24) throw new Error("CAP08_S3_COMPLETION_TICK_IDENTITY_NOT_UNIQUE");
  if (!sameScopeV1(value.scope, value.scope)) throw new Error("CAP08_S3_COMPLETION_SCOPE_MISMATCH");
  const semantic = structuredClone(value) as Record<string, unknown>;
  delete semantic.determinism_hash;
  if (value.determinism_hash !== semanticHashV1(semantic)) throw new Error("CAP08_S3_COMPLETION_HASH_MISMATCH");
}
