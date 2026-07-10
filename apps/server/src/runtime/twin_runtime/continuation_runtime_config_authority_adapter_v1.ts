// apps/server/src/runtime/twin_runtime/continuation_runtime_config_authority_adapter_v1.ts
// Purpose: adapt the frozen predecessor lock, canonical parent Runtime Config, and MCFT-00 authority artifacts into the pure MCFT-CAP-02 continuation Runtime Config compiler input.
// Boundary: pure parsed-object validation and adaptation only; callers own filesystem I/O and persistence.

import {
  validateCanonicalObjectV1,
  type CanonicalObjectEnvelopeV1,
} from "../../domain/twin_runtime/canonical_object_contracts_v1.js";
import {
  compileContinuationRuntimeConfigV1,
  CONTINUATION_CROP_STAGE_CONTEXT_HASH_V1,
  CONTINUATION_CROP_STAGE_CONTEXT_REF_V1,
  CONTINUATION_DRAINAGE_COEFFICIENT_PER_HOUR_V1,
  CONTINUATION_FIELD_CAPACITY_FRACTION_V1,
  CONTINUATION_FIELD_CAPACITY_STORAGE_MM_V1,
  CONTINUATION_ROOT_ZONE_DEPTH_MM_V1,
  CONTINUATION_RUNOFF_FRACTION_V1,
  CONTINUATION_SATURATION_FRACTION_V1,
  CONTINUATION_SATURATION_STORAGE_MM_V1,
  CONTINUATION_SOIL_HYDRAULIC_BINDING_HASH_V1,
  CONTINUATION_SOIL_HYDRAULIC_BINDING_REF_V1,
  CONTINUATION_WILTING_POINT_FRACTION_V1,
  CONTINUATION_WILTING_POINT_STORAGE_MM_V1,
} from "../../domain/twin_runtime/continuation_runtime_config_v1.js";
import type { ContinuationScopeV1 } from "../../domain/twin_runtime/continuation_operation_identity_v1.js";

export type McftCap02PredecessorLockV1 = {
  status: "COMPLETE";
  scope: ContinuationScopeV1;
  reality_binding_ref: string;
  reality_binding_hash: string;
  source_matrix_hash: string;
  configuration_matrix_hash: string;
  geometry_semantic_hash: string;
  bootstrap_runtime_config_ref: string;
  bootstrap_runtime_config_hash: string;
  next_logical_tick_time: string;
  crop_stage_context_ref: string;
  crop_stage_context_hash: string;
};

export type Mcft00RealityArtifactForContinuationV1 = {
  binding_id: string;
  determinism_hash: string;
  semantic_payload: {
    scope: ContinuationScopeV1;
    geometry_binding: { geometry_semantic_hash: string };
  };
};

export type Mcft00SourceMatrixForContinuationV1 = {
  determinism_hash: string;
};

export type Mcft00ConfigurationMatrixForContinuationV1 = {
  determinism_hash: string;
  configuration_source_definitions: Array<{
    configuration_source_id: string;
    configuration_semantic_hash: string;
    parameters: Record<string, { value: unknown }>;
  }>;
  bindings: Array<{
    binding_id: string;
    source_role: string;
    configuration_source_id: string;
    determinism_hash: string;
  }>;
};

function requireStringV1(value: unknown, code: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(code);
  return value;
}

function exactV1(actual: unknown, expected: unknown, code: string): void {
  if (actual !== expected) throw new Error(code);
}

function exactScopeV1(actual: ContinuationScopeV1, expected: ContinuationScopeV1): void {
  for (const key of ["tenant_id", "project_id", "group_id", "field_id", "season_id", "zone_id"] as const) {
    exactV1(actual?.[key], expected?.[key], `CONTINUATION_SCOPE_MISMATCH:${key}`);
  }
}

function parameterNumberV1(
  definition: Mcft00ConfigurationMatrixForContinuationV1["configuration_source_definitions"][number],
  name: string,
): number {
  const value = definition.parameters?.[name]?.value;
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`CONTINUATION_HYDRAULIC_PARAMETER_INVALID:${name}`);
  return value;
}

function validateParentRuntimeConfigV1(input: {
  lock: McftCap02PredecessorLockV1;
  parent: CanonicalObjectEnvelopeV1;
}): void {
  validateCanonicalObjectV1(input.parent);
  if (input.parent.object_type !== "twin_runtime_config_v1") throw new Error("CONTINUATION_PARENT_CONFIG_OBJECT_TYPE_MISMATCH");
  exactV1(input.parent.object_id, input.lock.bootstrap_runtime_config_ref, "CONTINUATION_PARENT_CONFIG_REF_MISMATCH");
  exactV1(input.parent.determinism_hash, input.lock.bootstrap_runtime_config_hash, "CONTINUATION_PARENT_CONFIG_HASH_MISMATCH");
  exactScopeV1(input.parent as ContinuationScopeV1, input.lock.scope);
  exactV1(input.parent.payload.reality_binding_ref, input.lock.reality_binding_ref, "CONTINUATION_PARENT_CONFIG_REALITY_REF_MISMATCH");
  exactV1(input.parent.payload.reality_binding_hash, input.lock.reality_binding_hash, "CONTINUATION_PARENT_CONFIG_REALITY_HASH_MISMATCH");
  exactV1(input.parent.payload.source_matrix_hash, input.lock.source_matrix_hash, "CONTINUATION_PARENT_CONFIG_SOURCE_MATRIX_HASH_MISMATCH");
  exactV1(input.parent.payload.configuration_matrix_hash, input.lock.configuration_matrix_hash, "CONTINUATION_PARENT_CONFIG_CONFIGURATION_MATRIX_HASH_MISMATCH");
  exactV1(input.parent.payload.geometry_semantic_hash, input.lock.geometry_semantic_hash, "CONTINUATION_PARENT_CONFIG_GEOMETRY_HASH_MISMATCH");
}

export function compileContinuationRuntimeConfigFromAuthorityV1(input: {
  predecessor_lock: McftCap02PredecessorLockV1;
  parent_runtime_config: CanonicalObjectEnvelopeV1;
  reality_artifact: Mcft00RealityArtifactForContinuationV1;
  source_matrix_artifact: Mcft00SourceMatrixForContinuationV1;
  configuration_matrix_artifact: Mcft00ConfigurationMatrixForContinuationV1;
  logical_time: string;
  created_at: string;
}): CanonicalObjectEnvelopeV1 {
  const lock = input.predecessor_lock;
  exactV1(lock.status, "COMPLETE", "CONTINUATION_PREDECESSOR_LOCK_INCOMPLETE");
  exactScopeV1(lock.scope, input.reality_artifact.semantic_payload.scope);
  validateParentRuntimeConfigV1({ lock, parent: input.parent_runtime_config });
  exactV1(lock.reality_binding_ref, input.reality_artifact.binding_id, "CONTINUATION_REALITY_BINDING_REF_MISMATCH");
  exactV1(lock.reality_binding_hash, input.reality_artifact.determinism_hash, "CONTINUATION_REALITY_BINDING_HASH_MISMATCH");
  exactV1(lock.source_matrix_hash, input.source_matrix_artifact.determinism_hash, "CONTINUATION_SOURCE_MATRIX_HASH_MISMATCH");
  exactV1(lock.configuration_matrix_hash, input.configuration_matrix_artifact.determinism_hash, "CONTINUATION_CONFIGURATION_MATRIX_HASH_MISMATCH");
  exactV1(lock.geometry_semantic_hash, input.reality_artifact.semantic_payload.geometry_binding.geometry_semantic_hash, "CONTINUATION_GEOMETRY_HASH_MISMATCH");
  exactV1(lock.crop_stage_context_ref, CONTINUATION_CROP_STAGE_CONTEXT_REF_V1, "CONTINUATION_CROP_STAGE_CONTEXT_REF_MISMATCH");
  exactV1(lock.crop_stage_context_hash, CONTINUATION_CROP_STAGE_CONTEXT_HASH_V1, "CONTINUATION_CROP_STAGE_CONTEXT_HASH_MISMATCH");
  exactV1(input.logical_time, lock.next_logical_tick_time, "CONTINUATION_CONFIG_LOGICAL_TIME_NOT_FIRST_TICK");

  requireStringV1(lock.bootstrap_runtime_config_ref, "CONTINUATION_PARENT_CONFIG_REF_REQUIRED");
  requireStringV1(lock.bootstrap_runtime_config_hash, "CONTINUATION_PARENT_CONFIG_HASH_REQUIRED");

  const hydraulicBindings = input.configuration_matrix_artifact.bindings.filter(
    (binding) => binding.source_role === "SOIL_HYDRAULIC_CONFIGURATION",
  );
  if (hydraulicBindings.length !== 1) throw new Error("CONTINUATION_SOIL_HYDRAULIC_BINDING_CARDINALITY");
  const hydraulicBinding = hydraulicBindings[0];
  exactV1(hydraulicBinding.binding_id, CONTINUATION_SOIL_HYDRAULIC_BINDING_REF_V1, "CONTINUATION_SOIL_HYDRAULIC_BINDING_REF_MISMATCH");
  exactV1(hydraulicBinding.determinism_hash, CONTINUATION_SOIL_HYDRAULIC_BINDING_HASH_V1, "CONTINUATION_SOIL_HYDRAULIC_BINDING_HASH_MISMATCH");

  const definitions = input.configuration_matrix_artifact.configuration_source_definitions.filter(
    (definition) => definition.configuration_source_id === hydraulicBinding.configuration_source_id,
  );
  if (definitions.length !== 1) throw new Error("CONTINUATION_SOIL_HYDRAULIC_DEFINITION_CARDINALITY");
  const definition = definitions[0];
  exactV1(parameterNumberV1(definition, "root_zone_depth_mm"), CONTINUATION_ROOT_ZONE_DEPTH_MM_V1, "CONTINUATION_ROOT_ZONE_DEPTH_AUTHORITY_MISMATCH");
  exactV1(parameterNumberV1(definition, "wilting_point_fraction"), CONTINUATION_WILTING_POINT_FRACTION_V1, "CONTINUATION_WILTING_FRACTION_AUTHORITY_MISMATCH");
  exactV1(parameterNumberV1(definition, "wilting_point_storage_mm"), CONTINUATION_WILTING_POINT_STORAGE_MM_V1, "CONTINUATION_WILTING_STORAGE_AUTHORITY_MISMATCH");
  exactV1(parameterNumberV1(definition, "field_capacity_fraction"), CONTINUATION_FIELD_CAPACITY_FRACTION_V1, "CONTINUATION_FIELD_CAPACITY_FRACTION_AUTHORITY_MISMATCH");
  exactV1(parameterNumberV1(definition, "field_capacity_storage_mm"), CONTINUATION_FIELD_CAPACITY_STORAGE_MM_V1, "CONTINUATION_FIELD_CAPACITY_STORAGE_AUTHORITY_MISMATCH");
  exactV1(parameterNumberV1(definition, "saturation_fraction"), CONTINUATION_SATURATION_FRACTION_V1, "CONTINUATION_SATURATION_FRACTION_AUTHORITY_MISMATCH");
  exactV1(parameterNumberV1(definition, "saturation_storage_mm"), CONTINUATION_SATURATION_STORAGE_MM_V1, "CONTINUATION_SATURATION_STORAGE_AUTHORITY_MISMATCH");
  exactV1(parameterNumberV1(definition, "runoff_fraction"), CONTINUATION_RUNOFF_FRACTION_V1, "CONTINUATION_RUNOFF_AUTHORITY_MISMATCH");
  exactV1(parameterNumberV1(definition, "drainage_coefficient_per_hour"), CONTINUATION_DRAINAGE_COEFFICIENT_PER_HOUR_V1, "CONTINUATION_DRAINAGE_AUTHORITY_MISMATCH");

  return compileContinuationRuntimeConfigV1({
    scope: structuredClone(lock.scope),
    logical_time: input.logical_time,
    created_at: input.created_at,
    parent_runtime_config_ref: lock.bootstrap_runtime_config_ref,
    parent_runtime_config_hash: lock.bootstrap_runtime_config_hash,
    reality_binding_ref: lock.reality_binding_ref,
    reality_binding_hash: lock.reality_binding_hash,
    source_matrix_hash: lock.source_matrix_hash,
    configuration_matrix_hash: lock.configuration_matrix_hash,
    geometry_semantic_hash: lock.geometry_semantic_hash,
  });
}
