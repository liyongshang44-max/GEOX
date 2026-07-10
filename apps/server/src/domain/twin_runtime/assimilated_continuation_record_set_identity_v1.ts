// apps/server/src/domain/twin_runtime/assimilated_continuation_record_set_identity_v1.ts
// Purpose: define the independent MCFT-CAP-03 eight-member record-set identity and aggregate determinism hash while preserving the MCFT-CAP-02 operation key.
// Boundary: pure identity logic only; no persistence, Evidence selection, assimilation math, filesystem, clock, network, or Runtime orchestration.

import { canonicalJsonV1, semanticHashV1 } from "./canonical_json_v1.js";
import type { CanonicalObjectEnvelopeV1 } from "./canonical_object_contracts_v1.js";
import {
  CONTINUATION_MEMBER_OBJECT_TYPES_V1,
  deriveContinuationOperationIdentityV1,
  type ContinuationMemberObjectTypeV1,
  type ContinuationOperationIdentityV1,
  type ContinuationOperationKeyV1,
} from "./continuation_operation_identity_v1.js";
import {
  ASSIMILATED_CONTINUATION_RECORD_SET_CONTRACT_ID_V1,
} from "./assimilated_continuation_contracts_v1.js";

export type AssimilatedContinuationAggregateIdentityInputV1 = {
  record_set_contract_id: typeof ASSIMILATED_CONTINUATION_RECORD_SET_CONTRACT_ID_V1;
  continuation_operation_key: ContinuationOperationKeyV1;
  previous_posterior_ref: string;
  previous_posterior_hash: string;
  previous_checkpoint_ref: string;
  previous_checkpoint_hash: string;
  previous_forecast_result_ref: string;
  previous_forecast_result_hash: string;
  runtime_config_ref: string;
  runtime_config_hash: string;
  reality_binding_ref: string;
  reality_binding_hash: string;
  evidence_window_semantic_digest: string;
  crop_stage_context_ref: string;
  crop_stage_context_hash: string;
  dynamics_model_version: string;
  uncertainty_policy_version: string;
  observation_policy_version: string;
  assimilation_method_version: string;
  forecast_block_policy_version: string;
  member_determinism_hashes: Record<ContinuationMemberObjectTypeV1, string>;
};

export type AssimilatedContinuationRecordSetV1 = ContinuationOperationIdentityV1 & {
  record_set_contract_id: typeof ASSIMILATED_CONTINUATION_RECORD_SET_CONTRACT_ID_V1;
  aggregate_identity_input: AssimilatedContinuationAggregateIdentityInputV1;
  continuation_record_set_determinism_hash: string;
  members: CanonicalObjectEnvelopeV1[];
};

function requiredStringV1(value: unknown, code: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(code);
  return value;
}

function sortedMemberHashTuplesV1(
  memberHashes: Record<ContinuationMemberObjectTypeV1, string>,
): readonly (readonly [ContinuationMemberObjectTypeV1, string])[] {
  const keys = Object.keys(memberHashes).sort();
  const expected = [...CONTINUATION_MEMBER_OBJECT_TYPES_V1].sort();
  if (JSON.stringify(keys) !== JSON.stringify(expected)) throw new Error("ASSIMILATED_MEMBER_HASH_TYPE_SET_MISMATCH");
  return CONTINUATION_MEMBER_OBJECT_TYPES_V1
    .map((objectType) => [
      objectType,
      requiredStringV1(memberHashes[objectType], `ASSIMILATED_MEMBER_HASH_REQUIRED:${objectType}`),
    ] as const)
    .sort((left, right) => canonicalJsonV1(left).localeCompare(canonicalJsonV1(right)));
}

export function computeAssimilatedContinuationRecordSetDeterminismHashV1(
  input: AssimilatedContinuationAggregateIdentityInputV1,
): string {
  if (input.record_set_contract_id !== ASSIMILATED_CONTINUATION_RECORD_SET_CONTRACT_ID_V1) {
    throw new Error("UNKNOWN_RECORD_SET_CONTRACT");
  }
  const operationIdentity = deriveContinuationOperationIdentityV1(input.continuation_operation_key);
  const semanticInput = {
    record_set_contract_id: input.record_set_contract_id,
    continuation_operation_key: input.continuation_operation_key,
    continuation_operation_key_hash: operationIdentity.continuation_operation_key_hash,
    continuation_record_set_id: operationIdentity.continuation_record_set_id,
    previous_posterior_ref: requiredStringV1(input.previous_posterior_ref, "ASSIMILATED_PREVIOUS_POSTERIOR_REF_REQUIRED"),
    previous_posterior_hash: requiredStringV1(input.previous_posterior_hash, "ASSIMILATED_PREVIOUS_POSTERIOR_HASH_REQUIRED"),
    previous_checkpoint_ref: requiredStringV1(input.previous_checkpoint_ref, "ASSIMILATED_PREVIOUS_CHECKPOINT_REF_REQUIRED"),
    previous_checkpoint_hash: requiredStringV1(input.previous_checkpoint_hash, "ASSIMILATED_PREVIOUS_CHECKPOINT_HASH_REQUIRED"),
    previous_forecast_result_ref: requiredStringV1(input.previous_forecast_result_ref, "ASSIMILATED_PREVIOUS_FORECAST_REF_REQUIRED"),
    previous_forecast_result_hash: requiredStringV1(input.previous_forecast_result_hash, "ASSIMILATED_PREVIOUS_FORECAST_HASH_REQUIRED"),
    runtime_config_ref: requiredStringV1(input.runtime_config_ref, "ASSIMILATED_RUNTIME_CONFIG_REF_REQUIRED"),
    runtime_config_hash: requiredStringV1(input.runtime_config_hash, "ASSIMILATED_RUNTIME_CONFIG_HASH_REQUIRED"),
    reality_binding_ref: requiredStringV1(input.reality_binding_ref, "ASSIMILATED_REALITY_BINDING_REF_REQUIRED"),
    reality_binding_hash: requiredStringV1(input.reality_binding_hash, "ASSIMILATED_REALITY_BINDING_HASH_REQUIRED"),
    evidence_window_semantic_digest: requiredStringV1(input.evidence_window_semantic_digest, "ASSIMILATED_EVIDENCE_DIGEST_REQUIRED"),
    crop_stage_context_ref: requiredStringV1(input.crop_stage_context_ref, "ASSIMILATED_CROP_STAGE_CONTEXT_REF_REQUIRED"),
    crop_stage_context_hash: requiredStringV1(input.crop_stage_context_hash, "ASSIMILATED_CROP_STAGE_CONTEXT_HASH_REQUIRED"),
    dynamics_model_version: requiredStringV1(input.dynamics_model_version, "ASSIMILATED_DYNAMICS_MODEL_VERSION_REQUIRED"),
    uncertainty_policy_version: requiredStringV1(input.uncertainty_policy_version, "ASSIMILATED_UNCERTAINTY_POLICY_VERSION_REQUIRED"),
    observation_policy_version: requiredStringV1(input.observation_policy_version, "ASSIMILATED_OBSERVATION_POLICY_VERSION_REQUIRED"),
    assimilation_method_version: requiredStringV1(input.assimilation_method_version, "ASSIMILATED_METHOD_VERSION_REQUIRED"),
    forecast_block_policy_version: requiredStringV1(input.forecast_block_policy_version, "ASSIMILATED_FORECAST_BLOCK_POLICY_VERSION_REQUIRED"),
    member_determinism_hashes: sortedMemberHashTuplesV1(input.member_determinism_hashes),
  };
  return semanticHashV1(semanticInput);
}

export function buildAssimilatedContinuationRecordSetIdentityV1(input: {
  continuation_operation_key: ContinuationOperationKeyV1;
  aggregate_identity_input: Omit<AssimilatedContinuationAggregateIdentityInputV1, "continuation_operation_key" | "record_set_contract_id">;
}): Omit<AssimilatedContinuationRecordSetV1, "members"> {
  const operationIdentity = deriveContinuationOperationIdentityV1(input.continuation_operation_key);
  const aggregateIdentityInput: AssimilatedContinuationAggregateIdentityInputV1 = {
    record_set_contract_id: ASSIMILATED_CONTINUATION_RECORD_SET_CONTRACT_ID_V1,
    continuation_operation_key: structuredClone(input.continuation_operation_key),
    ...structuredClone(input.aggregate_identity_input),
  };
  return {
    ...operationIdentity,
    record_set_contract_id: ASSIMILATED_CONTINUATION_RECORD_SET_CONTRACT_ID_V1,
    aggregate_identity_input: aggregateIdentityInput,
    continuation_record_set_determinism_hash:
      computeAssimilatedContinuationRecordSetDeterminismHashV1(aggregateIdentityInput),
  };
}
