// apps/server/src/domain/twin_runtime/continuation_record_set_identity_v1.ts
// Purpose: compute the MCFT-CAP-02 eight-member aggregate determinism hash separately from the continuation operation idempotency key.
// Boundary: pure identity logic only; no persistence, filesystem, environment, clock, random values, network, or Runtime orchestration.

import { canonicalJsonV1, semanticHashV1 } from "./canonical_json_v1.js";
import type { CanonicalObjectEnvelopeV1 } from "./canonical_object_contracts_v1.js";
import {
  CONTINUATION_MEMBER_OBJECT_TYPES_V1,
  deriveContinuationOperationIdentityV1,
  type ContinuationMemberObjectTypeV1,
  type ContinuationOperationIdentityV1,
  type ContinuationOperationKeyV1,
} from "./continuation_operation_identity_v1.js";

export type ContinuationAggregateIdentityInputV1 = {
  continuation_operation_key: ContinuationOperationKeyV1;
  previous_posterior_ref: string;
  previous_posterior_hash: string;
  previous_checkpoint_ref: string;
  previous_checkpoint_hash: string;
  runtime_config_ref: string;
  runtime_config_hash: string;
  reality_binding_ref: string;
  reality_binding_hash: string;
  evidence_window_semantic_digest: string;
  crop_stage_context_ref: string;
  crop_stage_context_hash: string;
  dynamics_model_version: string;
  uncertainty_policy_version: string;
  no_observation_update_policy_version: string;
  forecast_block_policy_version: string;
  member_determinism_hashes: Record<ContinuationMemberObjectTypeV1, string>;
};

export type ContinuationRecordSetV1 = ContinuationOperationIdentityV1 & {
  aggregate_identity_input: ContinuationAggregateIdentityInputV1;
  continuation_record_set_determinism_hash: string;
  members: CanonicalObjectEnvelopeV1[];
};

function requireStringV1(value: unknown, code: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(code);
  return value;
}

function sortedMemberHashTuplesV1(memberHashes: Record<ContinuationMemberObjectTypeV1, string>): readonly (readonly [ContinuationMemberObjectTypeV1, string])[] {
  const keys = Object.keys(memberHashes).sort();
  const expected = [...CONTINUATION_MEMBER_OBJECT_TYPES_V1].sort();
  if (JSON.stringify(keys) !== JSON.stringify(expected)) throw new Error("CONTINUATION_MEMBER_HASH_TYPE_SET_MISMATCH");
  return CONTINUATION_MEMBER_OBJECT_TYPES_V1
    .map((objectType) => [objectType, requireStringV1(memberHashes[objectType], `CONTINUATION_MEMBER_HASH_REQUIRED:${objectType}`)] as const)
    .sort((a, b) => canonicalJsonV1(a).localeCompare(canonicalJsonV1(b)));
}

export function computeContinuationRecordSetDeterminismHashV1(input: ContinuationAggregateIdentityInputV1): string {
  const operationIdentity = deriveContinuationOperationIdentityV1(input.continuation_operation_key);
  const semanticInput = {
    continuation_operation_key: input.continuation_operation_key,
    continuation_operation_key_hash: operationIdentity.continuation_operation_key_hash,
    continuation_record_set_id: operationIdentity.continuation_record_set_id,
    previous_posterior_ref: requireStringV1(input.previous_posterior_ref, "PREVIOUS_POSTERIOR_REF_REQUIRED"),
    previous_posterior_hash: requireStringV1(input.previous_posterior_hash, "PREVIOUS_POSTERIOR_HASH_REQUIRED"),
    previous_checkpoint_ref: requireStringV1(input.previous_checkpoint_ref, "PREVIOUS_CHECKPOINT_REF_REQUIRED"),
    previous_checkpoint_hash: requireStringV1(input.previous_checkpoint_hash, "PREVIOUS_CHECKPOINT_HASH_REQUIRED"),
    runtime_config_ref: requireStringV1(input.runtime_config_ref, "CONTINUATION_RUNTIME_CONFIG_REF_REQUIRED"),
    runtime_config_hash: requireStringV1(input.runtime_config_hash, "CONTINUATION_RUNTIME_CONFIG_HASH_REQUIRED"),
    reality_binding_ref: requireStringV1(input.reality_binding_ref, "CONTINUATION_REALITY_BINDING_REF_REQUIRED"),
    reality_binding_hash: requireStringV1(input.reality_binding_hash, "CONTINUATION_REALITY_BINDING_HASH_REQUIRED"),
    evidence_window_semantic_digest: requireStringV1(input.evidence_window_semantic_digest, "CONTINUATION_EVIDENCE_WINDOW_DIGEST_REQUIRED"),
    crop_stage_context_ref: requireStringV1(input.crop_stage_context_ref, "CONTINUATION_CROP_STAGE_CONTEXT_REF_REQUIRED"),
    crop_stage_context_hash: requireStringV1(input.crop_stage_context_hash, "CONTINUATION_CROP_STAGE_CONTEXT_HASH_REQUIRED"),
    dynamics_model_version: requireStringV1(input.dynamics_model_version, "CONTINUATION_DYNAMICS_MODEL_VERSION_REQUIRED"),
    uncertainty_policy_version: requireStringV1(input.uncertainty_policy_version, "CONTINUATION_UNCERTAINTY_POLICY_VERSION_REQUIRED"),
    no_observation_update_policy_version: requireStringV1(input.no_observation_update_policy_version, "CONTINUATION_NO_OBSERVATION_POLICY_VERSION_REQUIRED"),
    forecast_block_policy_version: requireStringV1(input.forecast_block_policy_version, "CONTINUATION_FORECAST_BLOCK_POLICY_VERSION_REQUIRED"),
    member_determinism_hashes: sortedMemberHashTuplesV1(input.member_determinism_hashes),
  };
  return semanticHashV1(semanticInput);
}

export function buildContinuationRecordSetIdentityV1(input: {
  continuation_operation_key: ContinuationOperationKeyV1;
  aggregate_identity_input: Omit<ContinuationAggregateIdentityInputV1, "continuation_operation_key">;
}): Omit<ContinuationRecordSetV1, "members"> {
  const operationIdentity = deriveContinuationOperationIdentityV1(input.continuation_operation_key);
  const aggregateIdentityInput: ContinuationAggregateIdentityInputV1 = {
    continuation_operation_key: structuredClone(input.continuation_operation_key),
    ...structuredClone(input.aggregate_identity_input),
  };
  return {
    ...operationIdentity,
    aggregate_identity_input: aggregateIdentityInput,
    continuation_record_set_determinism_hash: computeContinuationRecordSetDeterminismHashV1(aggregateIdentityInput),
  };
}
