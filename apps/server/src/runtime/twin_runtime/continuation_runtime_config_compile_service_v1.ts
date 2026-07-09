// apps/server/src/runtime/twin_runtime/continuation_runtime_config_compile_service_v1.ts
// Purpose: compile the frozen MCFT-CAP-02 continuation Runtime Config from the predecessor lock and explicit pinned continuation inputs.
// Boundary: pure application service; callers perform artifact I/O and persistence through separate adapters/ports.

import { computeMemberDeterminismHashV1, deriveSemanticObjectIdV1 } from "../../domain/twin_runtime/canonical_identity_v1.js";
import {
  validateContinuationRuntimeConfigSemanticPayloadV1,
  type CanonicalObjectEnvelopeV1,
} from "../../domain/twin_runtime/continuation_runtime_config_v1.js";
import {
  MCFT_CAP_02_CONTINUATION_CONFIG_PURPOSE_V1,
  MCFT_CAP_02_CONTINUATION_CONFIG_SELECTION_MODE_V1,
  MCFT_CAP_02_CONTINUATION_CROP_ROOT_ZONE_DEPTH_MM_V1,
  MCFT_CAP_02_CONTINUATION_CROP_STAGE_CONTEXT_HASH_V1,
  MCFT_CAP_02_CONTINUATION_CROP_STAGE_CONTEXT_KIND_V1,
  MCFT_CAP_02_CONTINUATION_CROP_STAGE_CONTEXT_REF_V1,
  MCFT_CAP_02_CONTINUATION_CROP_ET_RELATIVE_STDDEV_V1,
  MCFT_CAP_02_CONTINUATION_DRAINAGE_COEFFICIENT_PER_HOUR_V1,
  MCFT_CAP_02_CONTINUATION_DYNAMICS_MODEL_COMPONENT_REF_V1,
  MCFT_CAP_02_CONTINUATION_EXECUTED_IRRIGATION_RELATIVE_STDDEV_V1,
  MCFT_CAP_02_CONTINUATION_FIELD_CAPACITY_FRACTION_V1,
  MCFT_CAP_02_CONTINUATION_FIELD_CAPACITY_STORAGE_MM_V1,
  MCFT_CAP_02_CONTINUATION_FORECAST_BLOCK_POLICY_COMPONENT_REF_V1,
  MCFT_CAP_02_CONTINUATION_FORECAST_BLOCK_POLICY_V1,
  MCFT_CAP_02_CONTINUATION_MODEL_ID_V1,
  MCFT_CAP_02_CONTINUATION_MODEL_COMPONENT_REFS_V1,
  MCFT_CAP_02_CONTINUATION_NO_OBSERVATION_POLICY_COMPONENT_REF_V1,
  MCFT_CAP_02_CONTINUATION_NO_OBSERVATION_POLICY_V1,
  MCFT_CAP_02_CONTINUATION_OUTPUT_DECIMALS_V1,
  MCFT_CAP_02_CONTINUATION_PROCESS_UNCERTAINTY_POLICY_V1,
  MCFT_CAP_02_CONTINUATION_RAINFALL_RELATIVE_STDDEV_V1,
  MCFT_CAP_02_CONTINUATION_ROOT_ZONE_POLICY_ID_V1,
  MCFT_CAP_02_CONTINUATION_ROUNDING_RULE_V1,
  MCFT_CAP_02_CONTINUATION_RUNOFF_FRACTION_V1,
  MCFT_CAP_02_CONTINUATION_SATURATION_FRACTION_V1,
  MCFT_CAP_02_CONTINUATION_SATURATION_STORAGE_MM_V1,
  MCFT_CAP_02_CONTINUATION_SOIL_HYDRAULIC_SOURCE_CONFIG_HASH_V1,
  MCFT_CAP_02_CONTINUATION_SOIL_HYDRAULIC_SOURCE_CONFIG_REF_V1,
  MCFT_CAP_02_CONTINUATION_SOIL_ROOT_ZONE_CONFIG_REF_V1,
  MCFT_CAP_02_CONTINUATION_SPATIAL_OVERLAP_POLICY_V1,
  MCFT_CAP_02_CONTINUATION_STRUCTURAL_PROCESS_STDDEV_MM_PER_HOUR_V1,
  MCFT_CAP_02_CONTINUATION_UNCERTAINTY_POLICY_COMPONENT_REF_V1,
  MCFT_CAP_02_CONTINUATION_WILTING_POINT_FRACTION_V1,
  MCFT_CAP_02_CONTINUATION_WILTING_POINT_STORAGE_MM_V1,
  MCFT_CAP_02_CONTINUATION_COMPUTATION_STORAGE_VARIANCE_SCALE_V1,
  type ContinuationRuntimeConfigSemanticPayloadV1,
  type ContinuationScopeV1,
} from "../../domain/twin_runtime/continuation_runtime_config_v1.js";

export type CompileContinuationRuntimeConfigInputV1 = {
  created_at: string;
  logical_time: string;
  scope: ContinuationScopeV1;
  parent_runtime_config_ref: string;
  parent_runtime_config_hash: string;
  reality_binding_ref: string;
  reality_binding_hash: string;
  source_matrix_hash: string;
  configuration_matrix_hash: string;
  geometry_semantic_hash: string;
  crop_stage_context_ref: string;
  crop_stage_context_hash: string;
  soil_hydraulic_source_config_ref: string;
  soil_hydraulic_source_config_hash: string;
  dynamics_model_component_ref: string;
  soil_root_zone_config_ref: string;
  model_component_refs: readonly string[];
};

function requireStringV1(value: unknown, code: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(code);
  return value;
}

function requireArrayV1(value: unknown, code: string): string[] {
  if (!Array.isArray(value)) throw new Error(code);
  return value.map((item) => requireStringV1(item, code));
}

function freezePayloadV1(input: CompileContinuationRuntimeConfigInputV1): ContinuationRuntimeConfigSemanticPayloadV1 {
  const cropStageContextRef = requireStringV1(input.crop_stage_context_ref, "CROP_STAGE_CONTEXT_REF_REQUIRED");
  const cropStageContextHash = requireStringV1(input.crop_stage_context_hash, "CROP_STAGE_CONTEXT_HASH_REQUIRED");
  const soilHydraulicSourceConfigRef = requireStringV1(input.soil_hydraulic_source_config_ref, "SOIL_HYDRAULIC_SOURCE_CONFIG_REF_REQUIRED");
  const soilHydraulicSourceConfigHash = requireStringV1(input.soil_hydraulic_source_config_hash, "SOIL_HYDRAULIC_SOURCE_CONFIG_HASH_REQUIRED");
  const dynamicsModelComponentRef = requireStringV1(input.dynamics_model_component_ref, "DYNAMICS_MODEL_COMPONENT_REF_REQUIRED");
  const soilRootZoneConfigRef = requireStringV1(input.soil_root_zone_config_ref, "SOIL_ROOT_ZONE_CONFIG_REF_REQUIRED");
  const modelComponentRefs = requireArrayV1(input.model_component_refs, "MODEL_COMPONENT_REFS_REQUIRED");

  if (cropStageContextRef !== MCFT_CAP_02_CONTINUATION_CROP_STAGE_CONTEXT_REF_V1) throw new Error("CROP_STAGE_CONTEXT_REF_MISMATCH");
  if (cropStageContextHash !== MCFT_CAP_02_CONTINUATION_CROP_STAGE_CONTEXT_HASH_V1) throw new Error("CROP_STAGE_CONTEXT_HASH_MISMATCH");
  if (soilHydraulicSourceConfigRef !== MCFT_CAP_02_CONTINUATION_SOIL_HYDRAULIC_SOURCE_CONFIG_REF_V1) throw new Error("SOIL_HYDRAULIC_SOURCE_CONFIG_REF_MISMATCH");
  if (soilHydraulicSourceConfigHash !== MCFT_CAP_02_CONTINUATION_SOIL_HYDRAULIC_SOURCE_CONFIG_HASH_V1) throw new Error("SOIL_HYDRAULIC_SOURCE_CONFIG_HASH_MISMATCH");
  if (dynamicsModelComponentRef !== MCFT_CAP_02_CONTINUATION_DYNAMICS_MODEL_COMPONENT_REF_V1) throw new Error("DYNAMICS_MODEL_COMPONENT_REF_MISMATCH");
  if (soilRootZoneConfigRef !== MCFT_CAP_02_CONTINUATION_SOIL_ROOT_ZONE_CONFIG_REF_V1) throw new Error("SOIL_ROOT_ZONE_CONFIG_REF_MISMATCH");
  if (JSON.stringify(modelComponentRefs) !== JSON.stringify([...MCFT_CAP_02_CONTINUATION_MODEL_COMPONENT_REFS_V1])) throw new Error("MODEL_COMPONENT_REFS_MISMATCH");

  return {
    config_purpose: MCFT_CAP_02_CONTINUATION_CONFIG_PURPOSE_V1,
    config_selection_mode: MCFT_CAP_02_CONTINUATION_CONFIG_SELECTION_MODE_V1,
    parent_runtime_config_ref: requireStringV1(input.parent_runtime_config_ref, "PARENT_RUNTIME_CONFIG_REF_REQUIRED"),
    parent_runtime_config_hash: requireStringV1(input.parent_runtime_config_hash, "PARENT_RUNTIME_CONFIG_HASH_REQUIRED"),
    reality_binding_ref: requireStringV1(input.reality_binding_ref, "REALITY_BINDING_REF_REQUIRED"),
    reality_binding_hash: requireStringV1(input.reality_binding_hash, "REALITY_BINDING_HASH_REQUIRED"),
    source_matrix_hash: requireStringV1(input.source_matrix_hash, "SOURCE_MATRIX_HASH_REQUIRED"),
    configuration_matrix_hash: requireStringV1(input.configuration_matrix_hash, "CONFIGURATION_MATRIX_HASH_REQUIRED"),
    geometry_semantic_hash: requireStringV1(input.geometry_semantic_hash, "GEOMETRY_SEMANTIC_HASH_REQUIRED"),
    crop_stage_context: {
      context_kind: MCFT_CAP_02_CONTINUATION_CROP_STAGE_CONTEXT_KIND_V1,
      context_ref: cropStageContextRef,
      context_hash: cropStageContextHash,
      resolution_policy_id: MCFT_CAP_02_CONTINUATION_ROOT_ZONE_POLICY_ID_V1,
    },
    dynamics_model: {
      model_component_ref: dynamicsModelComponentRef,
      model_id: MCFT_CAP_02_CONTINUATION_MODEL_ID_V1,
      model_version: 1,
      step_duration: "PT1H",
    },
    soil_hydraulic_snapshot: {
      source_config_ref: soilHydraulicSourceConfigRef,
      source_config_hash: soilHydraulicSourceConfigHash,
      root_zone_depth_mm: MCFT_CAP_02_CONTINUATION_CROP_ROOT_ZONE_DEPTH_MM_V1,
      wilting_point_fraction: MCFT_CAP_02_CONTINUATION_WILTING_POINT_FRACTION_V1,
      wilting_point_storage_mm: MCFT_CAP_02_CONTINUATION_WILTING_POINT_STORAGE_MM_V1,
      field_capacity_fraction: MCFT_CAP_02_CONTINUATION_FIELD_CAPACITY_FRACTION_V1,
      field_capacity_storage_mm: MCFT_CAP_02_CONTINUATION_FIELD_CAPACITY_STORAGE_MM_V1,
      saturation_fraction: MCFT_CAP_02_CONTINUATION_SATURATION_FRACTION_V1,
      saturation_storage_mm: MCFT_CAP_02_CONTINUATION_SATURATION_STORAGE_MM_V1,
    },
    dynamics_parameters: {
      parameter_class: "CONTROLLED_SYNTHETIC",
      field_calibration_status: "NOT_FIELD_CALIBRATED",
      runoff_fraction: MCFT_CAP_02_CONTINUATION_RUNOFF_FRACTION_V1,
      drainage_coefficient_per_hour: MCFT_CAP_02_CONTINUATION_DRAINAGE_COEFFICIENT_PER_HOUR_V1,
    },
    process_uncertainty: {
      policy_id: MCFT_CAP_02_CONTINUATION_PROCESS_UNCERTAINTY_POLICY_V1,
      policy_version: 1,
      structural_process_stddev_mm_per_hour: MCFT_CAP_02_CONTINUATION_STRUCTURAL_PROCESS_STDDEV_MM_PER_HOUR_V1,
      rainfall_relative_stddev: MCFT_CAP_02_CONTINUATION_RAINFALL_RELATIVE_STDDEV_V1,
      crop_et_relative_stddev: MCFT_CAP_02_CONTINUATION_CROP_ET_RELATIVE_STDDEV_V1,
      executed_irrigation_relative_stddev: MCFT_CAP_02_CONTINUATION_EXECUTED_IRRIGATION_RELATIVE_STDDEV_V1,
      covariance_policy: MCFT_CAP_02_CONTINUATION_COVARIANCE_POLICY_V1,
      physical_clipping_reduces_latent_variance: false,
    },
    irrigation_input_policy: {
      policy_id: MCFT_CAP_02_CONTINUATION_IRRIGATION_INPUT_POLICY_V1,
      event_order: "executed_at_asc_ingested_at_asc_source_record_id_asc",
      spatial_overlap_deduplication: MCFT_CAP_02_CONTINUATION_SPATIAL_OVERLAP_POLICY_V1,
    },
    no_observation_update_policy: {
      policy_id: MCFT_CAP_02_CONTINUATION_NO_OBSERVATION_POLICY_V1,
    },
    forecast_block_policy: {
      policy_id: MCFT_CAP_02_CONTINUATION_FORECAST_BLOCK_POLICY_V1,
    },
    rounding: {
      output_decimals: MCFT_CAP_02_CONTINUATION_OUTPUT_DECIMALS_V1,
      computation_storage_mean_scale: 6,
      computation_storage_variance_scale: MCFT_CAP_02_CONTINUATION_COMPUTATION_STORAGE_VARIANCE_SCALE_V1,
      rule: MCFT_CAP_02_CONTINUATION_ROUNDING_RULE_V1,
    },
    soil_root_zone_config_refs: [soilRootZoneConfigRef],
    model_component_refs: modelComponentRefs,
  };
}

export function compileContinuationRuntimeConfigV1(input: CompileContinuationRuntimeConfigInputV1): CanonicalObjectEnvelopeV1 {
  requireStringV1(input.created_at, "CREATED_AT_REQUIRED");
  requireStringV1(input.logical_time, "LOGICAL_TIME_REQUIRED");
  const payload = freezePayloadV1(input);
  validateContinuationRuntimeConfigSemanticPayloadV1(payload);

  const identityPayload = {
    object_type: "twin_runtime_config_v1",
    scope: input.scope,
    payload,
  };
  const objectId = deriveSemanticObjectIdV1("twin_runtime_config", identityPayload);
  const idempotencyKey = deriveSemanticObjectIdV1("runtime_config_key", identityPayload);
  const draft: CanonicalObjectEnvelopeV1 = {
    object_id: objectId,
    object_type: "twin_runtime_config_v1",
    schema_version: "v1",
    ...input.scope,
    logical_time: input.logical_time,
    as_of: input.logical_time,
    source_refs: [input.parent_runtime_config_ref, input.reality_binding_ref].sort(),
    evidence_refs: [],
    runtime_config_ref: null,
    runtime_config_hash: null,
    idempotency_key: idempotencyKey,
    determinism_hash: "",
    limitations: ["CONTROLLED_SYNTHETIC", "NOT_FIELD_CALIBRATED", "NO_ACTIVE_MODEL_ACTIVATION"],
    created_at: input.created_at,
    payload: payload as unknown as Record<string, unknown>,
  };
  draft.determinism_hash = computeMemberDeterminismHashV1(draft as unknown as Record<string, unknown>);
  return draft;
}
