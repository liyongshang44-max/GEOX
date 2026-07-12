// apps/server/src/domain/twin_runtime/forecast_scenario_record_set_identity_v1.ts
// Purpose: derive deterministic A1/A2 terminal-tick and B Scenario Set identities without persistence or projection authority.
// Boundary: pure identity logic; no database, forcing selection, Forecast math, Scenario math, wall clock, filesystem or network.

import { canonicalJsonV1, semanticHashV1 } from "./canonical_json_v1.js";
import { deriveSemanticObjectIdV1 } from "./canonical_identity_v1.js";
import type { CanonicalObjectEnvelopeV1 } from "./canonical_object_contracts_v1.js";
import type { ContinuationScopeV1 } from "./continuation_operation_identity_v1.js";
import {
  CAP04_A1_OPERATION_VARIANT_V1,
  CAP04_A2_OPERATION_VARIANT_V1,
  CAP04_A_MEMBER_OBJECT_TYPES_V1,
  CAP04_B_TRANSACTION_VARIANT_V1,
  CAP04_BLOCKED_FORECAST_CONTRACT_ID_V1,
  CAP04_COMPLETED_FORECAST_CONTRACT_ID_V1,
  CAP04_THREE_SCENARIO_SET_CONTRACT_ID_V1,
  type Cap04AContractIdV1,
  type Cap04AMemberObjectTypeV1,
  type Cap04AOperationVariantV1,
  type Cap04ScenarioSetEnvelopeV1,
} from "./forecast_scenario_contracts_v1.js";

export type Cap04TerminalTickUniquenessKeyV1 = {
  scope: ContinuationScopeV1;
  lineage_id: string;
  revision_id: string;
  logical_time: string;
};

export type Cap04AOperationKeyV1 = Cap04TerminalTickUniquenessKeyV1 & {
  operation_variant: Cap04AOperationVariantV1;
};

export type Cap04ARecordSetIdentityV1 = {
  record_set_contract_id: Cap04AContractIdV1;
  terminal_tick_uniqueness_key: Cap04TerminalTickUniquenessKeyV1;
  terminal_tick_uniqueness_key_hash: string;
  operation_key: Cap04AOperationKeyV1;
  operation_key_hash: string;
  record_set_id: string;
  idempotency_key: string;
  member_object_ids: Record<Cap04AMemberObjectTypeV1, string>;
};

export type Cap04AAggregateIdentityInputV1 = {
  record_set_contract_id: Cap04AContractIdV1;
  operation_key: Cap04AOperationKeyV1;
  previous_posterior_ref: string;
  previous_posterior_hash: string;
  previous_checkpoint_ref: string;
  previous_checkpoint_hash: string;
  previous_forecast_result_ref: string;
  previous_forecast_result_hash: string;
  runtime_config_ref: string;
  runtime_config_hash: string;
  evidence_window_hash: string;
  assimilation_update_hash: string;
  posterior_state_hash: string;
  forcing_window_hash: string | null;
  forecast_point_hashes: string[];
  member_determinism_hashes: Record<Cap04AMemberObjectTypeV1, string>;
};

export type Cap04ARecordSetV1 = Cap04ARecordSetIdentityV1 & {
  aggregate_identity_input: Cap04AAggregateIdentityInputV1;
  aggregate_determinism_hash: string;
  members: CanonicalObjectEnvelopeV1[];
};

export type Cap04ScenarioSetUniquenessKeyV1 = {
  source_forecast_ref: string;
  source_forecast_hash: string;
  lineage_id: string;
  revision_id: string;
};

export type Cap04ScenarioOperationKeyV1 = Cap04ScenarioSetUniquenessKeyV1 & {
  scenario_policy_id: string;
  runtime_config_ref: string;
  runtime_config_hash: string;
};

export type Cap04ScenarioSetRecordV1 = {
  record_set_contract_id: typeof CAP04_THREE_SCENARIO_SET_CONTRACT_ID_V1;
  transaction_variant: typeof CAP04_B_TRANSACTION_VARIANT_V1;
  scenario_set_uniqueness_key: Cap04ScenarioSetUniquenessKeyV1;
  scenario_set_uniqueness_key_hash: string;
  operation_key: Cap04ScenarioOperationKeyV1;
  operation_key_hash: string;
  scenario_set_id: string;
  idempotency_key: string;
  aggregate_determinism_hash: string;
  scenario_set: Cap04ScenarioSetEnvelopeV1;
};

function requiredStringV1(value: unknown, code: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(code);
  return value;
}

function validateScopeV1(scope: ContinuationScopeV1): void {
  for (const field of ["tenant_id", "project_id", "group_id", "field_id", "season_id", "zone_id"] as const) {
    requiredStringV1(scope?.[field], `CAP04_SCOPE_${field.toUpperCase()}_REQUIRED`);
  }
}

function canonicalHourV1(value: string): void {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== value || !value.endsWith(":00:00.000Z")) throw new Error("CAP04_LOGICAL_TIME_INVALID");
}

export function deriveCap04ARecordSetIdentityV1(key: Cap04AOperationKeyV1): Cap04ARecordSetIdentityV1 {
  validateScopeV1(key.scope);
  requiredStringV1(key.lineage_id, "CAP04_LINEAGE_ID_REQUIRED");
  requiredStringV1(key.revision_id, "CAP04_REVISION_ID_REQUIRED");
  canonicalHourV1(requiredStringV1(key.logical_time, "CAP04_LOGICAL_TIME_REQUIRED"));
  if (![CAP04_A1_OPERATION_VARIANT_V1, CAP04_A2_OPERATION_VARIANT_V1].includes(key.operation_variant)) throw new Error("CAP04_OPERATION_VARIANT_UNKNOWN");
  const recordSetContractId = key.operation_variant === CAP04_A1_OPERATION_VARIANT_V1
    ? CAP04_COMPLETED_FORECAST_CONTRACT_ID_V1
    : CAP04_BLOCKED_FORECAST_CONTRACT_ID_V1;
  const terminalTickUniquenessKey: Cap04TerminalTickUniquenessKeyV1 = {
    scope: structuredClone(key.scope), lineage_id: key.lineage_id, revision_id: key.revision_id, logical_time: key.logical_time,
  };
  const terminalHash = semanticHashV1(terminalTickUniquenessKey);
  const operationHash = semanticHashV1(key);
  const recordSetId = deriveSemanticObjectIdV1("cap04_a_record_set", { record_set_contract_id: recordSetContractId, operation_key_hash: operationHash });
  const memberObjectIds = Object.fromEntries(CAP04_A_MEMBER_OBJECT_TYPES_V1.map((objectType) => [
    objectType,
    deriveSemanticObjectIdV1(objectType.replace(/_v1$/, ""), { record_set_id: recordSetId, object_type: objectType, schema_version: "v1" }),
  ])) as Record<Cap04AMemberObjectTypeV1, string>;
  return {
    record_set_contract_id: recordSetContractId,
    terminal_tick_uniqueness_key: terminalTickUniquenessKey,
    terminal_tick_uniqueness_key_hash: terminalHash,
    operation_key: structuredClone(key),
    operation_key_hash: operationHash,
    record_set_id: recordSetId,
    idempotency_key: deriveSemanticObjectIdV1("cap04_a_key", { operation_key_hash: operationHash }),
    member_object_ids: memberObjectIds,
  };
}

export function computeCap04AAggregateDeterminismHashV1(input: Cap04AAggregateIdentityInputV1): string {
  const identity = deriveCap04ARecordSetIdentityV1(input.operation_key);
  if (input.record_set_contract_id !== identity.record_set_contract_id) throw new Error("CAP04_A_CONTRACT_VARIANT_MISMATCH");
  for (const field of [
    "previous_posterior_ref", "previous_posterior_hash", "previous_checkpoint_ref", "previous_checkpoint_hash",
    "previous_forecast_result_ref", "previous_forecast_result_hash", "runtime_config_ref", "runtime_config_hash",
    "evidence_window_hash", "assimilation_update_hash", "posterior_state_hash",
  ] as const) requiredStringV1(input[field], `CAP04_A_${field.toUpperCase()}_REQUIRED`);
  if (input.forcing_window_hash !== null) requiredStringV1(input.forcing_window_hash, "CAP04_A_FORCING_WINDOW_HASH_INVALID");
  const expectedTypes = [...CAP04_A_MEMBER_OBJECT_TYPES_V1].sort();
  const actualTypes = Object.keys(input.member_determinism_hashes).sort();
  if (canonicalJsonV1(actualTypes) !== canonicalJsonV1(expectedTypes)) throw new Error("CAP04_A_MEMBER_HASH_TYPE_SET_MISMATCH");
  const memberHashes = CAP04_A_MEMBER_OBJECT_TYPES_V1.map((type) => [type, requiredStringV1(input.member_determinism_hashes[type], `CAP04_A_MEMBER_HASH_REQUIRED:${type}`)] as const)
    .sort((a, b) => canonicalJsonV1(a).localeCompare(canonicalJsonV1(b)));
  if (!Array.isArray(input.forecast_point_hashes) || input.forecast_point_hashes.some((hash) => typeof hash !== "string" || !hash)) throw new Error("CAP04_A_FORECAST_POINT_HASHES_INVALID");
  return semanticHashV1({ ...input, operation_key_hash: identity.operation_key_hash, terminal_tick_uniqueness_key_hash: identity.terminal_tick_uniqueness_key_hash, member_determinism_hashes: memberHashes });
}

export function buildCap04ARecordSetIdentityV1(input: Cap04AAggregateIdentityInputV1): Omit<Cap04ARecordSetV1, "members"> {
  const identity = deriveCap04ARecordSetIdentityV1(input.operation_key);
  const aggregateInput = structuredClone(input);
  return { ...identity, aggregate_identity_input: aggregateInput, aggregate_determinism_hash: computeCap04AAggregateDeterminismHashV1(aggregateInput) };
}

export function deriveCap04ScenarioSetIdentityV1(input: {
  uniqueness_key: Cap04ScenarioSetUniquenessKeyV1;
  scenario_policy_id: string;
  runtime_config_ref: string;
  runtime_config_hash: string;
  scenario_set_determinism_hash: string;
}): Omit<Cap04ScenarioSetRecordV1, "scenario_set"> {
  for (const field of ["source_forecast_ref", "source_forecast_hash", "lineage_id", "revision_id"] as const) requiredStringV1(input.uniqueness_key[field], `CAP04_SCENARIO_${field.toUpperCase()}_REQUIRED`);
  requiredStringV1(input.scenario_policy_id, "CAP04_SCENARIO_POLICY_REQUIRED");
  requiredStringV1(input.runtime_config_ref, "CAP04_SCENARIO_CONFIG_REF_REQUIRED");
  requiredStringV1(input.runtime_config_hash, "CAP04_SCENARIO_CONFIG_HASH_REQUIRED");
  requiredStringV1(input.scenario_set_determinism_hash, "CAP04_SCENARIO_HASH_REQUIRED");
  const uniquenessHash = semanticHashV1(input.uniqueness_key);
  const operationKey: Cap04ScenarioOperationKeyV1 = { ...structuredClone(input.uniqueness_key), scenario_policy_id: input.scenario_policy_id, runtime_config_ref: input.runtime_config_ref, runtime_config_hash: input.runtime_config_hash };
  const operationHash = semanticHashV1(operationKey);
  return {
    record_set_contract_id: CAP04_THREE_SCENARIO_SET_CONTRACT_ID_V1,
    transaction_variant: CAP04_B_TRANSACTION_VARIANT_V1,
    scenario_set_uniqueness_key: structuredClone(input.uniqueness_key),
    scenario_set_uniqueness_key_hash: uniquenessHash,
    operation_key: operationKey,
    operation_key_hash: operationHash,
    scenario_set_id: deriveSemanticObjectIdV1("twin_scenario_set", { scenario_set_uniqueness_key_hash: uniquenessHash }),
    idempotency_key: deriveSemanticObjectIdV1("cap04_b_key", { operation_key_hash: operationHash }),
    aggregate_determinism_hash: input.scenario_set_determinism_hash,
  };
}
