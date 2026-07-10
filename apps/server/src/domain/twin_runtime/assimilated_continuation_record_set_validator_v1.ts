// apps/server/src/domain/twin_runtime/assimilated_continuation_record_set_validator_v1.ts
// Purpose: validate the MCFT-CAP-03 versioned eight-object record-set identity, discriminator, member hashes, common scope/config identity, and assimilation payload contract.
// Boundary: S1 contract validation only; full eight-object cross-reference graph validation remains owned by S3A.

import { computeMemberDeterminismHashV1 } from "./canonical_identity_v1.js";
import type { CanonicalObjectEnvelopeV1 } from "./canonical_object_contracts_v1.js";
import {
  ASSIMILATED_CONTINUATION_RECORD_SET_CONTRACT_ID_V1,
  validateAssimilatedContinuationTickDiscriminatorV1,
  validateAssimilatedContinuationUpdatePayloadV1,
  type AssimilatedContinuationUpdatePayloadV1,
  type AssimilatedObservationCandidateV1,
} from "./assimilated_continuation_contracts_v1.js";
import {
  computeAssimilatedContinuationRecordSetDeterminismHashV1,
  type AssimilatedContinuationRecordSetV1,
} from "./assimilated_continuation_record_set_identity_v1.js";
import {
  CONTINUATION_MEMBER_OBJECT_TYPES_V1,
  deriveContinuationOperationIdentityV1,
  type ContinuationMemberObjectTypeV1,
} from "./continuation_operation_identity_v1.js";

function memberByTypeV1(
  recordSet: AssimilatedContinuationRecordSetV1,
  objectType: ContinuationMemberObjectTypeV1,
): CanonicalObjectEnvelopeV1 {
  const matches = recordSet.members.filter((member) => member.object_type === objectType);
  if (matches.length !== 1) throw new Error(`ASSIMILATED_MEMBER_TYPE_CARDINALITY:${objectType}`);
  return matches[0];
}

function requiredStringV1(value: unknown, code: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(code);
  return value;
}

function validateDispositionCandidateContractV1(
  payload: AssimilatedContinuationUpdatePayloadV1,
): void {
  const selectedRef = payload.selected_observation_ref;
  if (selectedRef === null) return;

  const selectedCandidates = payload.candidate_observations.filter(
    (candidate) => candidate.observation_ref === selectedRef && candidate.candidate_assessment === "SELECTED",
  );
  if (selectedCandidates.length !== 1) throw new Error("ASSIMILATED_SELECTED_CANDIDATE_CARDINALITY");
  const selected = selectedCandidates[0] as AssimilatedObservationCandidateV1;

  if (payload.disposition === "ACCEPTED" && selected.quality_status !== "PASS") {
    throw new Error("ASSIMILATED_ACCEPTED_QUALITY_MUST_BE_PASS");
  }
  if (payload.disposition === "DOWNWEIGHTED" && selected.quality_status !== "LIMITED") {
    throw new Error("ASSIMILATED_DOWNWEIGHTED_QUALITY_MUST_BE_LIMITED");
  }
  if (payload.disposition === "REJECTED_OUTLIER" && selected.quality_status === "FAIL") {
    throw new Error("ASSIMILATED_OUTLIER_SELECTED_QUALITY_FAIL_FORBIDDEN");
  }

  const squared = payload.squared_normalized_innovation;
  if ((payload.disposition === "ACCEPTED" || payload.disposition === "DOWNWEIGHTED")
    && (squared === null || squared > 16)) {
    throw new Error("ASSIMILATED_APPLIED_THRESHOLD_CONTRACT_MISMATCH");
  }
  if (payload.disposition === "REJECTED_OUTLIER" && (squared === null || squared <= 16)) {
    throw new Error("ASSIMILATED_OUTLIER_THRESHOLD_CONTRACT_MISMATCH");
  }
}

export function validateAssimilatedContinuationRecordSetV1(
  recordSet: AssimilatedContinuationRecordSetV1,
): void {
  if (recordSet.record_set_contract_id !== ASSIMILATED_CONTINUATION_RECORD_SET_CONTRACT_ID_V1) {
    throw new Error("UNKNOWN_RECORD_SET_CONTRACT");
  }
  const operationIdentity = deriveContinuationOperationIdentityV1(recordSet.continuation_operation_key);
  if (recordSet.continuation_operation_key_hash !== operationIdentity.continuation_operation_key_hash) throw new Error("ASSIMILATED_OPERATION_KEY_HASH_MISMATCH");
  if (recordSet.continuation_record_set_id !== operationIdentity.continuation_record_set_id) throw new Error("ASSIMILATED_RECORD_SET_ID_MISMATCH");
  if (recordSet.continuation_idempotency_key !== operationIdentity.continuation_idempotency_key) throw new Error("ASSIMILATED_IDEMPOTENCY_KEY_MISMATCH");
  if (recordSet.members.length !== CONTINUATION_MEMBER_OBJECT_TYPES_V1.length) throw new Error("ASSIMILATED_MEMBER_COUNT_MISMATCH");

  const actualTypes = recordSet.members.map((member) => member.object_type).sort();
  const expectedTypes = [...CONTINUATION_MEMBER_OBJECT_TYPES_V1].sort();
  if (JSON.stringify(actualTypes) !== JSON.stringify(expectedTypes)) throw new Error("ASSIMILATED_MEMBER_TYPE_SET_MISMATCH");

  const aggregate = recordSet.aggregate_identity_input;
  if (aggregate.record_set_contract_id !== recordSet.record_set_contract_id) throw new Error("ASSIMILATED_AGGREGATE_CONTRACT_MISMATCH");
  if (JSON.stringify(aggregate.continuation_operation_key) !== JSON.stringify(recordSet.continuation_operation_key)) throw new Error("ASSIMILATED_AGGREGATE_OPERATION_KEY_MISMATCH");

  for (const member of recordSet.members) {
    const objectType = member.object_type as ContinuationMemberObjectTypeV1;
    if (!CONTINUATION_MEMBER_OBJECT_TYPES_V1.includes(objectType)) throw new Error("ASSIMILATED_MEMBER_OBJECT_TYPE_NOT_ALLOWED");
    if (member.object_id !== operationIdentity.member_object_ids[objectType]) throw new Error(`ASSIMILATED_MEMBER_OBJECT_ID_MISMATCH:${objectType}`);
    const computedMemberHash = computeMemberDeterminismHashV1(member as unknown as Record<string, unknown>);
    if (computedMemberHash !== member.determinism_hash) throw new Error(`ASSIMILATED_MEMBER_HASH_MISMATCH:${objectType}`);
    if (aggregate.member_determinism_hashes[objectType] !== member.determinism_hash) throw new Error(`ASSIMILATED_AGGREGATE_MEMBER_HASH_MISMATCH:${objectType}`);
    for (const scopeField of ["tenant_id", "project_id", "group_id", "field_id", "season_id", "zone_id"] as const) {
      if (member[scopeField] !== recordSet.continuation_operation_key.scope[scopeField]) throw new Error(`ASSIMILATED_MEMBER_SCOPE_MISMATCH:${objectType}:${scopeField}`);
    }
    if (member.logical_time !== recordSet.continuation_operation_key.logical_time) throw new Error(`ASSIMILATED_MEMBER_LOGICAL_TIME_MISMATCH:${objectType}`);
    if (member.lineage_id !== recordSet.continuation_operation_key.lineage_id) throw new Error(`ASSIMILATED_MEMBER_LINEAGE_MISMATCH:${objectType}`);
    if (member.revision_id !== recordSet.continuation_operation_key.revision_id) throw new Error(`ASSIMILATED_MEMBER_REVISION_MISMATCH:${objectType}`);
    if (member.runtime_config_ref !== aggregate.runtime_config_ref) throw new Error(`ASSIMILATED_MEMBER_CONFIG_REF_MISMATCH:${objectType}`);
    if (member.runtime_config_hash !== aggregate.runtime_config_hash) throw new Error(`ASSIMILATED_MEMBER_CONFIG_HASH_MISMATCH:${objectType}`);
    requiredStringV1(member.idempotency_key, `ASSIMILATED_MEMBER_IDEMPOTENCY_KEY_REQUIRED:${objectType}`);
  }

  const tick = memberByTypeV1(recordSet, "twin_runtime_tick_v1");
  validateAssimilatedContinuationTickDiscriminatorV1(tick.payload);
  const assimilation = memberByTypeV1(recordSet, "twin_assimilation_update_v1");
  validateAssimilatedContinuationUpdatePayloadV1(assimilation.payload);
  const assimilationPayload = assimilation.payload as unknown as AssimilatedContinuationUpdatePayloadV1;
  validateDispositionCandidateContractV1(assimilationPayload);
  if (assimilationPayload.runtime_config_ref !== aggregate.runtime_config_ref) throw new Error("ASSIMILATED_UPDATE_CONFIG_REF_MISMATCH");
  if (assimilationPayload.runtime_config_hash !== aggregate.runtime_config_hash) throw new Error("ASSIMILATED_UPDATE_CONFIG_HASH_MISMATCH");

  const forecast = memberByTypeV1(recordSet, "twin_forecast_run_v1");
  if (forecast.payload.status !== "BLOCKED") throw new Error("ASSIMILATED_FORECAST_STATUS_MISMATCH");
  if (!Array.isArray(forecast.payload.points) || forecast.payload.points.length !== 0) throw new Error("ASSIMILATED_FORECAST_POINTS_MUST_BE_EMPTY");
  if (forecast.payload.scenario_eligible !== false) throw new Error("ASSIMILATED_FORECAST_SCENARIO_ELIGIBILITY_MISMATCH");

  const computedAggregateHash = computeAssimilatedContinuationRecordSetDeterminismHashV1(aggregate);
  if (computedAggregateHash !== recordSet.continuation_record_set_determinism_hash) throw new Error("ASSIMILATED_AGGREGATE_HASH_MISMATCH");
}
