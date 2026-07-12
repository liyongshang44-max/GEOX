// apps/server/src/runtime/twin_runtime/assimilated_continuation_runtime_config_authority_adapter_v2.ts
// Purpose: bind the CAP-03 predecessor lock, latest persisted posterior State, its pinned CAP-02 Runtime Config, and MCFT-00 authority artifacts into the pure CAP-03 Runtime Config compiler.
// Boundary: pure parsed-object validation and adaptation only; callers own filesystem I/O and D-transaction persistence.

import {
  validateCanonicalObjectV1,
  type CanonicalObjectEnvelopeV1,
} from "../../domain/twin_runtime/canonical_object_contracts_v1.js";
import type { ContinuationScopeV1 } from "../../domain/twin_runtime/continuation_operation_identity_v1.js";
import {
  validateContinuationRuntimeConfigPayloadV1,
} from "../../domain/twin_runtime/continuation_runtime_config_v1.js";
import {
  compileAssimilatedContinuationRuntimeConfigV2,
} from "../../domain/twin_runtime/assimilated_continuation_runtime_config_v2.js";
import type {
  Mcft00ConfigurationMatrixForContinuationV1,
  Mcft00RealityArtifactForContinuationV1,
  Mcft00SourceMatrixForContinuationV1,
} from "./continuation_runtime_config_authority_adapter_v1.js";

export type McftCap03PredecessorLockV2 = {
  status: "COMPLETE";
  expected_scope: ContinuationScopeV1;
  expected_checkpoint: {
    tick_sequence: 24;
    last_continuation_logical_time: string;
    next_tick_logical_time: string;
  };
  canonical_identity: {
    active_lineage_ref: string;
    lineage_id: string;
    revision_id: string;
    latest_state_ref: string;
    latest_state_hash: string;
    latest_checkpoint_ref: string;
    latest_checkpoint_hash: string;
    latest_forecast_result_ref: string;
    latest_forecast_result_hash: string;
    latest_successful_forecast_ref: null;
    runtime_config_ref: string;
    runtime_config_hash: string;
  };
};

function requiredStringV1(value: unknown, code: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(code);
  return value;
}

function exactV1(actual: unknown, expected: unknown, code: string): void {
  if (actual !== expected) throw new Error(code);
}

function exactScopeV1(actual: ContinuationScopeV1, expected: ContinuationScopeV1): void {
  for (const key of ["tenant_id", "project_id", "group_id", "field_id", "season_id", "zone_id"] as const) {
    exactV1(actual?.[key], expected?.[key], `ASSIMILATED_AUTHORITY_SCOPE_MISMATCH:${key}`);
  }
}

function scopeFromCanonicalObjectV1(object: CanonicalObjectEnvelopeV1): ContinuationScopeV1 {
  return {
    tenant_id: object.tenant_id,
    project_id: object.project_id,
    group_id: requiredStringV1(object.group_id, "ASSIMILATED_AUTHORITY_GROUP_ID_REQUIRED"),
    field_id: object.field_id,
    season_id: requiredStringV1(object.season_id, "ASSIMILATED_AUTHORITY_SEASON_ID_REQUIRED"),
    zone_id: requiredStringV1(object.zone_id, "ASSIMILATED_AUTHORITY_ZONE_ID_REQUIRED"),
  };
}

export function compileAssimilatedContinuationRuntimeConfigFromAuthorityV2(input: {
  predecessor_lock: McftCap03PredecessorLockV2;
  predecessor_latest_state: CanonicalObjectEnvelopeV1;
  parent_runtime_config: CanonicalObjectEnvelopeV1;
  reality_artifact: Mcft00RealityArtifactForContinuationV1;
  source_matrix_artifact: Mcft00SourceMatrixForContinuationV1;
  configuration_matrix_artifact: Mcft00ConfigurationMatrixForContinuationV1;
  logical_time: string;
  created_at: string;
}): CanonicalObjectEnvelopeV1 {
  const lock = input.predecessor_lock;
  exactV1(lock.status, "COMPLETE", "ASSIMILATED_PREDECESSOR_LOCK_INCOMPLETE");
  exactV1(lock.expected_checkpoint.tick_sequence, 24, "ASSIMILATED_PREDECESSOR_SEQUENCE_MISMATCH");
  exactV1(input.logical_time, lock.expected_checkpoint.next_tick_logical_time, "ASSIMILATED_CONFIG_LOGICAL_TIME_NOT_CANONICAL_HANDOFF");
  exactV1(lock.canonical_identity.latest_successful_forecast_ref, null, "ASSIMILATED_PREDECESSOR_SUCCESSFUL_FORECAST_MUST_BE_NULL");

  validateCanonicalObjectV1(input.predecessor_latest_state);
  if (input.predecessor_latest_state.object_type !== "twin_state_estimate_v1") throw new Error("ASSIMILATED_PREDECESSOR_STATE_TYPE_MISMATCH");
  exactV1(input.predecessor_latest_state.object_id, lock.canonical_identity.latest_state_ref, "ASSIMILATED_PREDECESSOR_STATE_REF_MISMATCH");
  exactV1(input.predecessor_latest_state.determinism_hash, lock.canonical_identity.latest_state_hash, "ASSIMILATED_PREDECESSOR_STATE_HASH_MISMATCH");
  exactV1(input.predecessor_latest_state.lineage_id, lock.canonical_identity.lineage_id, "ASSIMILATED_PREDECESSOR_STATE_LINEAGE_MISMATCH");
  exactV1(input.predecessor_latest_state.revision_id, lock.canonical_identity.revision_id, "ASSIMILATED_PREDECESSOR_STATE_REVISION_MISMATCH");
  exactScopeV1(scopeFromCanonicalObjectV1(input.predecessor_latest_state), lock.expected_scope);

  validateCanonicalObjectV1(input.parent_runtime_config);
  if (input.parent_runtime_config.object_type !== "twin_runtime_config_v1") throw new Error("ASSIMILATED_PARENT_CONFIG_TYPE_MISMATCH");
  validateContinuationRuntimeConfigPayloadV1(input.parent_runtime_config.payload);
  exactV1(input.parent_runtime_config.object_id, lock.canonical_identity.runtime_config_ref, "ASSIMILATED_PARENT_CONFIG_REF_MISMATCH");
  exactV1(input.parent_runtime_config.determinism_hash, lock.canonical_identity.runtime_config_hash, "ASSIMILATED_PARENT_CONFIG_HASH_MISMATCH");
  exactV1(input.predecessor_latest_state.runtime_config_ref, input.parent_runtime_config.object_id, "ASSIMILATED_STATE_PARENT_CONFIG_REF_MISMATCH");
  exactV1(input.predecessor_latest_state.runtime_config_hash, input.parent_runtime_config.determinism_hash, "ASSIMILATED_STATE_PARENT_CONFIG_HASH_MISMATCH");
  exactScopeV1(scopeFromCanonicalObjectV1(input.parent_runtime_config), lock.expected_scope);

  exactScopeV1(lock.expected_scope, input.reality_artifact.semantic_payload.scope);
  exactV1(input.reality_artifact.binding_id, input.parent_runtime_config.payload.reality_binding_ref, "ASSIMILATED_REALITY_REF_MISMATCH");
  exactV1(input.reality_artifact.determinism_hash, input.parent_runtime_config.payload.reality_binding_hash, "ASSIMILATED_REALITY_HASH_MISMATCH");
  exactV1(input.source_matrix_artifact.determinism_hash, input.parent_runtime_config.payload.source_matrix_hash, "ASSIMILATED_SOURCE_MATRIX_HASH_MISMATCH");
  exactV1(input.configuration_matrix_artifact.determinism_hash, input.parent_runtime_config.payload.configuration_matrix_hash, "ASSIMILATED_CONFIGURATION_MATRIX_HASH_MISMATCH");
  exactV1(input.reality_artifact.semantic_payload.geometry_binding.geometry_semantic_hash, input.parent_runtime_config.payload.geometry_semantic_hash, "ASSIMILATED_GEOMETRY_HASH_MISMATCH");

  return compileAssimilatedContinuationRuntimeConfigV2({
    scope: structuredClone(lock.expected_scope),
    logical_time: input.logical_time,
    created_at: input.created_at,
    parent_runtime_config_ref: input.parent_runtime_config.object_id,
    parent_runtime_config_hash: input.parent_runtime_config.determinism_hash,
    reality_binding_ref: input.reality_artifact.binding_id,
    reality_binding_hash: input.reality_artifact.determinism_hash,
    source_matrix_hash: input.source_matrix_artifact.determinism_hash,
    configuration_matrix_hash: input.configuration_matrix_artifact.determinism_hash,
    geometry_semantic_hash: input.reality_artifact.semantic_payload.geometry_binding.geometry_semantic_hash,
  });
}
