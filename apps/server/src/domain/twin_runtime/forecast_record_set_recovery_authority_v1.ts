// apps/server/src/domain/twin_runtime/forecast_record_set_recovery_authority_v1.ts
// Purpose: materialize and validate the nonrecursive canonical Tick-root recovery authority required to reconstruct a CAP-04 A1/A2 eight-member aggregate after guard or projection loss.
// Boundary: pure canonical record-set transformation and validation only; no database, persistence, projection, forcing selection, Forecast math, Scenario math, clock, filesystem, or network.

import type { CanonicalObjectEnvelopeV1 } from "./canonical_object_contracts_v1.js";
import {
  computeCap04AAggregateDeterminismHashV1,
  type Cap04ARecordSetV1,
} from "./forecast_scenario_record_set_identity_v1.js";
import { computeCap04AMemberDeterminismHashV1 } from "./forecast_scenario_member_hash_v1.js";
import { validateCap04ARecordSetV1 } from "./forecast_scenario_record_set_validator_v1.js";

export const CAP04_TICK_RECOVERY_AUTHORITY_CONTRACT_ID_V1 =
  "MCFT_CAP_04_TICK_ROOT_RECOVERY_AUTHORITY_V1" as const;

export type Cap04TickRecoveryAuthorityV1 = {
  contract_id: typeof CAP04_TICK_RECOVERY_AUTHORITY_CONTRACT_ID_V1;
  record_set_id: string;
  record_set_idempotency_key: string;
  previous_posterior_ref: string;
  previous_posterior_hash: string;
  previous_checkpoint_ref: string;
  previous_checkpoint_hash: string;
  previous_forecast_result_ref: string;
  previous_forecast_result_hash: string;
  runtime_config_ref: string;
  runtime_config_hash: string;
};

function memberV1(recordSet: Cap04ARecordSetV1, objectType: string): CanonicalObjectEnvelopeV1 {
  const matches = recordSet.members.filter((member) => member.object_type === objectType);
  if (matches.length !== 1) throw new Error(`CAP04_RECOVERY_MEMBER_CARDINALITY:${objectType}`);
  return matches[0];
}

function requiredStringV1(value: unknown, code: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(code);
  return value;
}

export function readCap04TickRecoveryAuthorityV1(
  tick: CanonicalObjectEnvelopeV1,
): Cap04TickRecoveryAuthorityV1 {
  if (tick.object_type !== "twin_runtime_tick_v1") throw new Error("CAP04_RECOVERY_TICK_OBJECT_TYPE_REQUIRED");
  const raw = tick.payload.recovery_authority;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("CAP04_RECOVERY_TICK_AUTHORITY_REQUIRED");
  const authority = raw as Record<string, unknown>;
  if (authority.contract_id !== CAP04_TICK_RECOVERY_AUTHORITY_CONTRACT_ID_V1) throw new Error("CAP04_RECOVERY_TICK_AUTHORITY_CONTRACT_MISMATCH");
  const result: Cap04TickRecoveryAuthorityV1 = {
    contract_id: CAP04_TICK_RECOVERY_AUTHORITY_CONTRACT_ID_V1,
    record_set_id: requiredStringV1(authority.record_set_id, "CAP04_RECOVERY_RECORD_SET_ID_REQUIRED"),
    record_set_idempotency_key: requiredStringV1(authority.record_set_idempotency_key, "CAP04_RECOVERY_RECORD_SET_IDEMPOTENCY_KEY_REQUIRED"),
    previous_posterior_ref: requiredStringV1(authority.previous_posterior_ref, "CAP04_RECOVERY_PREVIOUS_POSTERIOR_REF_REQUIRED"),
    previous_posterior_hash: requiredStringV1(authority.previous_posterior_hash, "CAP04_RECOVERY_PREVIOUS_POSTERIOR_HASH_REQUIRED"),
    previous_checkpoint_ref: requiredStringV1(authority.previous_checkpoint_ref, "CAP04_RECOVERY_PREVIOUS_CHECKPOINT_REF_REQUIRED"),
    previous_checkpoint_hash: requiredStringV1(authority.previous_checkpoint_hash, "CAP04_RECOVERY_PREVIOUS_CHECKPOINT_HASH_REQUIRED"),
    previous_forecast_result_ref: requiredStringV1(authority.previous_forecast_result_ref, "CAP04_RECOVERY_PREVIOUS_FORECAST_REF_REQUIRED"),
    previous_forecast_result_hash: requiredStringV1(authority.previous_forecast_result_hash, "CAP04_RECOVERY_PREVIOUS_FORECAST_HASH_REQUIRED"),
    runtime_config_ref: requiredStringV1(authority.runtime_config_ref, "CAP04_RECOVERY_RUNTIME_CONFIG_REF_REQUIRED"),
    runtime_config_hash: requiredStringV1(authority.runtime_config_hash, "CAP04_RECOVERY_RUNTIME_CONFIG_HASH_REQUIRED"),
  };
  return result;
}

export function materializeCap04TickRecoveryAuthorityV1(
  input: Cap04ARecordSetV1,
): Cap04ARecordSetV1 {
  validateCap04ARecordSetV1(input);
  const recordSet = structuredClone(input);
  const tick = memberV1(recordSet, "twin_runtime_tick_v1");
  const aggregate = recordSet.aggregate_identity_input;
  const authority: Cap04TickRecoveryAuthorityV1 = {
    contract_id: CAP04_TICK_RECOVERY_AUTHORITY_CONTRACT_ID_V1,
    record_set_id: recordSet.record_set_id,
    record_set_idempotency_key: recordSet.idempotency_key,
    previous_posterior_ref: aggregate.previous_posterior_ref,
    previous_posterior_hash: aggregate.previous_posterior_hash,
    previous_checkpoint_ref: aggregate.previous_checkpoint_ref,
    previous_checkpoint_hash: aggregate.previous_checkpoint_hash,
    previous_forecast_result_ref: aggregate.previous_forecast_result_ref,
    previous_forecast_result_hash: aggregate.previous_forecast_result_hash,
    runtime_config_ref: aggregate.runtime_config_ref,
    runtime_config_hash: aggregate.runtime_config_hash,
  };
  tick.payload.recovery_authority = authority;
  tick.determinism_hash = computeCap04AMemberDeterminismHashV1(tick);
  recordSet.member_object_ids.twin_runtime_tick_v1 = tick.object_id;
  recordSet.aggregate_identity_input.member_determinism_hashes.twin_runtime_tick_v1 = tick.determinism_hash;
  recordSet.aggregate_determinism_hash = computeCap04AAggregateDeterminismHashV1(recordSet.aggregate_identity_input);
  tick.payload.aggregate_determinism_hash = recordSet.aggregate_determinism_hash;
  if (computeCap04AMemberDeterminismHashV1(tick) !== tick.determinism_hash) throw new Error("CAP04_RECOVERY_TICK_NONRECURSIVE_HASH_MISMATCH");
  readCap04TickRecoveryAuthorityV1(tick);
  validateCap04ARecordSetV1(recordSet);
  return recordSet;
}
