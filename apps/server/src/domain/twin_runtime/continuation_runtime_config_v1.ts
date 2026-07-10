// apps/server/src/domain/twin_runtime/continuation_runtime_config_v1.ts
// Purpose: define, compile, and validate the immutable MCFT-CAP-02 continuation Runtime Config semantic payload.
// Boundary: pure domain contract and deterministic construction only; no persistence, filesystem, environment, clock, random values, network, or Runtime orchestration.

import { computeMemberDeterminismHashV1, deriveSemanticObjectIdV1 } from "./canonical_identity_v1.js";
import type { CanonicalObjectEnvelopeV1 } from "./canonical_object_contracts_v1.js";
import type { ContinuationScopeV1 } from "./continuation_operation_identity_v1.js";

export const CONTINUATION_CONFIG_PURPOSE_V1 = "HOURLY_DYNAMICS_CONTINUATION" as const;
export const CONTINUATION_CONFIG_SELECTION_MODE_V1 = "EXPLICIT_REPLAY_PIN" as const;
export const CONTINUATION_ROOT_ZONE_POLICY_ID_V1 = "GOVERNED_FIXED_ROOT_ZONE_300MM_V1" as const;
export const CONTINUATION_DYNAMICS_MODEL_COMPONENT_REF_V1 = "mcft_component_root_zone_hourly_water_balance_v1" as const;
export const CONTINUATION_DYNAMICS_MODEL_ID_V1 = "ROOT_ZONE_HOURLY_WATER_BALANCE_V1" as const;
export const CONTINUATION_PROCESS_UNCERTAINTY_COMPONENT_REF_V1 = "mcft_component_controlled_additive_process_uncertainty_budget_v1" as const;
export const CONTINUATION_PROCESS_UNCERTAINTY_POLICY_ID_V1 = "CONTROLLED_ADDITIVE_PROCESS_UNCERTAINTY_BUDGET_V1" as const;
export const CONTINUATION_NO_OBSERVATION_COMPONENT_REF_V1 = "mcft_component_deferred_observation_assimilation_v1" as const;
export const CONTINUATION_NO_OBSERVATION_POLICY_ID_V1 = "DEFER_OBSERVATION_ASSIMILATION_TO_MCFT_CAP_03_V1" as const;
export const CONTINUATION_FORECAST_BLOCK_COMPONENT_REF_V1 = "mcft_component_pinned_config_forecast_block_v1" as const;
export const CONTINUATION_FORECAST_BLOCK_POLICY_ID_V1 = "MCFT_CAP_02_PINNED_CONFIG_NO_FORECAST_COMPONENT_V1" as const;
export const CONTINUATION_CROP_STAGE_CONTEXT_KIND_V1 = "CONFIGURATION_DERIVED_CONTEXT" as const;
export const CONTINUATION_CROP_STAGE_CONTEXT_REF_V1 = "fixtures/mcft/water_state/replay_v1/configuration_context.json" as const;
export const CONTINUATION_CROP_STAGE_CONTEXT_HASH_V1 = "sha256:2287c71e983b1ba529e49939f025d9b035e09e195a5effc994fe54b4ef7863ce" as const;
export const CONTINUATION_SOIL_HYDRAULIC_BINDING_REF_V1 = "soil_hydraulic_config_c8_v1" as const;
export const CONTINUATION_SOIL_HYDRAULIC_BINDING_HASH_V1 = "sha256:3d6e3d8b52a9736ff6898487cacbbffdf71578cca693754ab34cb484e5bc3082" as const;
export const CONTINUATION_ROOT_ZONE_DEPTH_MM_V1 = 300 as const;
export const CONTINUATION_WILTING_POINT_FRACTION_V1 = 0.12 as const;
export const CONTINUATION_WILTING_POINT_STORAGE_MM_V1 = 36 as const;
export const CONTINUATION_FIELD_CAPACITY_FRACTION_V1 = 0.3 as const;
export const CONTINUATION_FIELD_CAPACITY_STORAGE_MM_V1 = 90 as const;
export const CONTINUATION_SATURATION_FRACTION_V1 = 0.45 as const;
export const CONTINUATION_SATURATION_STORAGE_MM_V1 = 135 as const;
export const CONTINUATION_RUNOFF_FRACTION_V1 = 0.05 as const;
export const CONTINUATION_DRAINAGE_COEFFICIENT_PER_HOUR_V1 = 0.03 as const;
export const CONTINUATION_STRUCTURAL_PROCESS_STDDEV_MM_PER_HOUR_V1 = 0.5 as const;
export const CONTINUATION_RAINFALL_RELATIVE_STDDEV_V1 = 0.1 as const;
export const CONTINUATION_CROP_ET_RELATIVE_STDDEV_V1 = 0.15 as const;
export const CONTINUATION_EXECUTED_IRRIGATION_RELATIVE_STDDEV_V1 = 0.1 as const;
export const CONTINUATION_COVARIANCE_POLICY_ID_V1 = "ZERO_COVARIANCE_CONTROLLED_ASSUMPTION_V1" as const;
export const CONTINUATION_IRRIGATION_INPUT_POLICY_ID_V1 = "COVERAGE_WEIGHTED_EXECUTED_AMOUNT_SUM_V1" as const;
export const CONTINUATION_ROUNDING_RULE_V1 = "DECIMAL_HALF_AWAY_FROM_ZERO_V1" as const;

export const CONTINUATION_MODEL_COMPONENT_REFS_V1 = [
  CONTINUATION_DYNAMICS_MODEL_COMPONENT_REF_V1,
  CONTINUATION_PROCESS_UNCERTAINTY_COMPONENT_REF_V1,
  CONTINUATION_NO_OBSERVATION_COMPONENT_REF_V1,
  CONTINUATION_FORECAST_BLOCK_COMPONENT_REF_V1,
] as const;

export type ContinuationRuntimeConfigPayloadV1 = {
  config_purpose: typeof CONTINUATION_CONFIG_PURPOSE_V1;
  config_selection_mode: typeof CONTINUATION_CONFIG_SELECTION_MODE_V1;
  parent_runtime_config_ref: string;
  parent_runtime_config_hash: string;
  reality_binding_ref: string;
  reality_binding_hash: string;
  source_matrix_hash: string;
  configuration_matrix_hash: string;
  geometry_semantic_hash: string;
  crop_stage_context: {
    context_kind: typeof CONTINUATION_CROP_STAGE_CONTEXT_KIND_V1;
    context_ref: typeof CONTINUATION_CROP_STAGE_CONTEXT_REF_V1;
    context_hash: typeof CONTINUATION_CROP_STAGE_CONTEXT_HASH_V1;
    resolution_policy_id: typeof CONTINUATION_ROOT_ZONE_POLICY_ID_V1;
  };
  dynamics_model: {
    model_component_ref: typeof CONTINUATION_DYNAMICS_MODEL_COMPONENT_REF_V1;
    model_id: typeof CONTINUATION_DYNAMICS_MODEL_ID_V1;
    model_version: 1;
    step_duration: "PT1H";
  };
  soil_hydraulic_snapshot: {
    source_config_ref: typeof CONTINUATION_SOIL_HYDRAULIC_BINDING_REF_V1;
    source_config_hash: typeof CONTINUATION_SOIL_HYDRAULIC_BINDING_HASH_V1;
    root_zone_depth_mm: typeof CONTINUATION_ROOT_ZONE_DEPTH_MM_V1;
    wilting_point_fraction: typeof CONTINUATION_WILTING_POINT_FRACTION_V1;
    wilting_point_storage_mm: typeof CONTINUATION_WILTING_POINT_STORAGE_MM_V1;
    field_capacity_fraction: typeof CONTINUATION_FIELD_CAPACITY_FRACTION_V1;
    field_capacity_storage_mm: typeof CONTINUATION_FIELD_CAPACITY_STORAGE_MM_V1;
    saturation_fraction: typeof CONTINUATION_SATURATION_FRACTION_V1;
    saturation_storage_mm: typeof CONTINUATION_SATURATION_STORAGE_MM_V1;
  };
  dynamics_parameters: {
    parameter_class: "CONTROLLED_SYNTHETIC";
    field_calibration_status: "NOT_FIELD_CALIBRATED";
    runoff_fraction: typeof CONTINUATION_RUNOFF_FRACTION_V1;
    drainage_coefficient_per_hour: typeof CONTINUATION_DRAINAGE_COEFFICIENT_PER_HOUR_V1;
  };
  process_uncertainty: {
    component_ref: typeof CONTINUATION_PROCESS_UNCERTAINTY_COMPONENT_REF_V1;
    policy_id: typeof CONTINUATION_PROCESS_UNCERTAINTY_POLICY_ID_V1;
    policy_version: 1;
    structural_process_stddev_mm_per_hour: typeof CONTINUATION_STRUCTURAL_PROCESS_STDDEV_MM_PER_HOUR_V1;
    rainfall_relative_stddev: typeof CONTINUATION_RAINFALL_RELATIVE_STDDEV_V1;
    crop_et_relative_stddev: typeof CONTINUATION_CROP_ET_RELATIVE_STDDEV_V1;
    executed_irrigation_relative_stddev: typeof CONTINUATION_EXECUTED_IRRIGATION_RELATIVE_STDDEV_V1;
    covariance_policy: typeof CONTINUATION_COVARIANCE_POLICY_ID_V1;
    physical_clipping_reduces_latent_variance: false;
  };
  irrigation_input_policy: {
    policy_id: typeof CONTINUATION_IRRIGATION_INPUT_POLICY_ID_V1;
    event_order: "executed_at_asc_ingested_at_asc_source_record_id_asc";
    spatial_overlap_deduplication: "NOT_ESTABLISHED";
  };
  no_observation_update_policy: {
    component_ref: typeof CONTINUATION_NO_OBSERVATION_COMPONENT_REF_V1;
    policy_id: typeof CONTINUATION_NO_OBSERVATION_POLICY_ID_V1;
    policy_version: 1;
  };
  forecast_block_policy: {
    component_ref: typeof CONTINUATION_FORECAST_BLOCK_COMPONENT_REF_V1;
    policy_id: typeof CONTINUATION_FORECAST_BLOCK_POLICY_ID_V1;
    policy_version: 1;
  };
  rounding: {
    output_decimals: 6;
    computation_storage_mean_scale: 6;
    computation_storage_variance_scale: 12;
    rule: typeof CONTINUATION_ROUNDING_RULE_V1;
  };
  soil_root_zone_config_refs: [typeof CONTINUATION_SOIL_HYDRAULIC_BINDING_REF_V1];
  model_component_refs: [
    typeof CONTINUATION_DYNAMICS_MODEL_COMPONENT_REF_V1,
    typeof CONTINUATION_PROCESS_UNCERTAINTY_COMPONENT_REF_V1,
    typeof CONTINUATION_NO_OBSERVATION_COMPONENT_REF_V1,
    typeof CONTINUATION_FORECAST_BLOCK_COMPONENT_REF_V1,
  ];
};

export type CompileContinuationRuntimeConfigInputV1 = {
  scope: ContinuationScopeV1;
  logical_time: string;
  created_at: string;
  parent_runtime_config_ref: string;
  parent_runtime_config_hash: string;
  reality_binding_ref: string;
  reality_binding_hash: string;
  source_matrix_hash: string;
  configuration_matrix_hash: string;
  geometry_semantic_hash: string;
};

function requireStringV1(value: unknown, code: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(code);
  return value;
}

function requireRecordV1(value: unknown, code: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(code);
  return value as Record<string, unknown>;
}

function exactV1(actual: unknown, expected: unknown, code: string): void {
  if (actual !== expected) throw new Error(code);
}

function exactArrayV1(actual: unknown, expected: readonly string[], code: string): void {
  if (!Array.isArray(actual) || JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(code);
}

export function validateContinuationRuntimeConfigPayloadV1(value: unknown): asserts value is ContinuationRuntimeConfigPayloadV1 {
  const payload = requireRecordV1(value, "CONTINUATION_RUNTIME_CONFIG_PAYLOAD_REQUIRED");
  exactV1(payload.config_purpose, CONTINUATION_CONFIG_PURPOSE_V1, "CONTINUATION_CONFIG_PURPOSE_MISMATCH");
  exactV1(payload.config_selection_mode, CONTINUATION_CONFIG_SELECTION_MODE_V1, "CONTINUATION_CONFIG_SELECTION_MODE_MISMATCH");
  requireStringV1(payload.parent_runtime_config_ref, "CONTINUATION_PARENT_CONFIG_REF_REQUIRED");
  requireStringV1(payload.parent_runtime_config_hash, "CONTINUATION_PARENT_CONFIG_HASH_REQUIRED");
  requireStringV1(payload.reality_binding_ref, "CONTINUATION_REALITY_BINDING_REF_REQUIRED");
  requireStringV1(payload.reality_binding_hash, "CONTINUATION_REALITY_BINDING_HASH_REQUIRED");
  requireStringV1(payload.source_matrix_hash, "CONTINUATION_SOURCE_MATRIX_HASH_REQUIRED");
  requireStringV1(payload.configuration_matrix_hash, "CONTINUATION_CONFIGURATION_MATRIX_HASH_REQUIRED");
  requireStringV1(payload.geometry_semantic_hash, "CONTINUATION_GEOMETRY_HASH_REQUIRED");

  const crop = requireRecordV1(payload.crop_stage_context, "CONTINUATION_CROP_STAGE_CONTEXT_REQUIRED");
  exactV1(crop.context_kind, CONTINUATION_CROP_STAGE_CONTEXT_KIND_V1, "CONTINUATION_CROP_STAGE_CONTEXT_KIND_MISMATCH");
  exactV1(crop.context_ref, CONTINUATION_CROP_STAGE_CONTEXT_REF_V1, "CONTINUATION_CROP_STAGE_CONTEXT_REF_MISMATCH");
  exactV1(crop.context_hash, CONTINUATION_CROP_STAGE_CONTEXT_HASH_V1, "CONTINUATION_CROP_STAGE_CONTEXT_HASH_MISMATCH");
  exactV1(crop.resolution_policy_id, CONTINUATION_ROOT_ZONE_POLICY_ID_V1, "CONTINUATION_ROOT_ZONE_POLICY_MISMATCH");

  const model = requireRecordV1(payload.dynamics_model, "CONTINUATION_DYNAMICS_MODEL_REQUIRED");
  exactV1(model.model_component_ref, CONTINUATION_DYNAMICS_MODEL_COMPONENT_REF_V1, "CONTINUATION_DYNAMICS_COMPONENT_MISMATCH");
  exactV1(model.model_id, CONTINUATION_DYNAMICS_MODEL_ID_V1, "CONTINUATION_DYNAMICS_MODEL_ID_MISMATCH");
  exactV1(model.model_version, 1, "CONTINUATION_DYNAMICS_MODEL_VERSION_MISMATCH");
  exactV1(model.step_duration, "PT1H", "CONTINUATION_STEP_DURATION_MISMATCH");

  const hydraulic = requireRecordV1(payload.soil_hydraulic_snapshot, "CONTINUATION_HYDRAULIC_SNAPSHOT_REQUIRED");
  exactV1(hydraulic.source_config_ref, CONTINUATION_SOIL_HYDRAULIC_BINDING_REF_V1, "CONTINUATION_HYDRAULIC_REF_MISMATCH");
  exactV1(hydraulic.source_config_hash, CONTINUATION_SOIL_HYDRAULIC_BINDING_HASH_V1, "CONTINUATION_HYDRAULIC_HASH_MISMATCH");
  exactV1(hydraulic.root_zone_depth_mm, CONTINUATION_ROOT_ZONE_DEPTH_MM_V1, "CONTINUATION_ROOT_ZONE_DEPTH_MISMATCH");
  exactV1(hydraulic.wilting_point_fraction, CONTINUATION_WILTING_POINT_FRACTION_V1, "CONTINUATION_WILTING_FRACTION_MISMATCH");
  exactV1(hydraulic.wilting_point_storage_mm, CONTINUATION_WILTING_POINT_STORAGE_MM_V1, "CONTINUATION_WILTING_STORAGE_MISMATCH");
  exactV1(hydraulic.field_capacity_fraction, CONTINUATION_FIELD_CAPACITY_FRACTION_V1, "CONTINUATION_FIELD_CAPACITY_FRACTION_MISMATCH");
  exactV1(hydraulic.field_capacity_storage_mm, CONTINUATION_FIELD_CAPACITY_STORAGE_MM_V1, "CONTINUATION_FIELD_CAPACITY_STORAGE_MISMATCH");
  exactV1(hydraulic.saturation_fraction, CONTINUATION_SATURATION_FRACTION_V1, "CONTINUATION_SATURATION_FRACTION_MISMATCH");
  exactV1(hydraulic.saturation_storage_mm, CONTINUATION_SATURATION_STORAGE_MM_V1, "CONTINUATION_SATURATION_STORAGE_MISMATCH");

  const dynamics = requireRecordV1(payload.dynamics_parameters, "CONTINUATION_DYNAMICS_PARAMETERS_REQUIRED");
  exactV1(dynamics.parameter_class, "CONTROLLED_SYNTHETIC", "CONTINUATION_DYNAMICS_PARAMETER_CLASS_MISMATCH");
  exactV1(dynamics.field_calibration_status, "NOT_FIELD_CALIBRATED", "CONTINUATION_DYNAMICS_CALIBRATION_STATUS_MISMATCH");
  exactV1(dynamics.runoff_fraction, CONTINUATION_RUNOFF_FRACTION_V1, "CONTINUATION_RUNOFF_FRACTION_MISMATCH");
  exactV1(dynamics.drainage_coefficient_per_hour, CONTINUATION_DRAINAGE_COEFFICIENT_PER_HOUR_V1, "CONTINUATION_DRAINAGE_COEFFICIENT_MISMATCH");

  const uncertainty = requireRecordV1(payload.process_uncertainty, "CONTINUATION_PROCESS_UNCERTAINTY_REQUIRED");
  exactV1(uncertainty.component_ref, CONTINUATION_PROCESS_UNCERTAINTY_COMPONENT_REF_V1, "CONTINUATION_UNCERTAINTY_COMPONENT_MISMATCH");
  exactV1(uncertainty.policy_id, CONTINUATION_PROCESS_UNCERTAINTY_POLICY_ID_V1, "CONTINUATION_UNCERTAINTY_POLICY_MISMATCH");
  exactV1(uncertainty.policy_version, 1, "CONTINUATION_UNCERTAINTY_POLICY_VERSION_MISMATCH");
  exactV1(uncertainty.structural_process_stddev_mm_per_hour, CONTINUATION_STRUCTURAL_PROCESS_STDDEV_MM_PER_HOUR_V1, "CONTINUATION_STRUCTURAL_STDDEV_MISMATCH");
  exactV1(uncertainty.rainfall_relative_stddev, CONTINUATION_RAINFALL_RELATIVE_STDDEV_V1, "CONTINUATION_RAINFALL_STDDEV_MISMATCH");
  exactV1(uncertainty.crop_et_relative_stddev, CONTINUATION_CROP_ET_RELATIVE_STDDEV_V1, "CONTINUATION_CROP_ET_STDDEV_MISMATCH");
  exactV1(uncertainty.executed_irrigation_relative_stddev, CONTINUATION_EXECUTED_IRRIGATION_RELATIVE_STDDEV_V1, "CONTINUATION_IRRIGATION_STDDEV_MISMATCH");
  exactV1(uncertainty.covariance_policy, CONTINUATION_COVARIANCE_POLICY_ID_V1, "CONTINUATION_COVARIANCE_POLICY_MISMATCH");
  exactV1(uncertainty.physical_clipping_reduces_latent_variance, false, "CONTINUATION_CLIPPING_VARIANCE_POLICY_MISMATCH");

  const irrigation = requireRecordV1(payload.irrigation_input_policy, "CONTINUATION_IRRIGATION_POLICY_REQUIRED");
  exactV1(irrigation.policy_id, CONTINUATION_IRRIGATION_INPUT_POLICY_ID_V1, "CONTINUATION_IRRIGATION_POLICY_MISMATCH");
  exactV1(irrigation.event_order, "executed_at_asc_ingested_at_asc_source_record_id_asc", "CONTINUATION_IRRIGATION_ORDER_MISMATCH");
  exactV1(irrigation.spatial_overlap_deduplication, "NOT_ESTABLISHED", "CONTINUATION_SPATIAL_OVERLAP_POLICY_MISMATCH");

  const noObservation = requireRecordV1(payload.no_observation_update_policy, "CONTINUATION_NO_OBSERVATION_POLICY_REQUIRED");
  exactV1(noObservation.component_ref, CONTINUATION_NO_OBSERVATION_COMPONENT_REF_V1, "CONTINUATION_NO_OBSERVATION_COMPONENT_MISMATCH");
  exactV1(noObservation.policy_id, CONTINUATION_NO_OBSERVATION_POLICY_ID_V1, "CONTINUATION_NO_OBSERVATION_POLICY_MISMATCH");
  exactV1(noObservation.policy_version, 1, "CONTINUATION_NO_OBSERVATION_POLICY_VERSION_MISMATCH");

  const forecast = requireRecordV1(payload.forecast_block_policy, "CONTINUATION_FORECAST_BLOCK_POLICY_REQUIRED");
  exactV1(forecast.component_ref, CONTINUATION_FORECAST_BLOCK_COMPONENT_REF_V1, "CONTINUATION_FORECAST_BLOCK_COMPONENT_MISMATCH");
  exactV1(forecast.policy_id, CONTINUATION_FORECAST_BLOCK_POLICY_ID_V1, "CONTINUATION_FORECAST_BLOCK_POLICY_MISMATCH");
  exactV1(forecast.policy_version, 1, "CONTINUATION_FORECAST_BLOCK_POLICY_VERSION_MISMATCH");

  const rounding = requireRecordV1(payload.rounding, "CONTINUATION_ROUNDING_REQUIRED");
  exactV1(rounding.output_decimals, 6, "CONTINUATION_OUTPUT_DECIMALS_MISMATCH");
  exactV1(rounding.computation_storage_mean_scale, 6, "CONTINUATION_STORAGE_MEAN_SCALE_MISMATCH");
  exactV1(rounding.computation_storage_variance_scale, 12, "CONTINUATION_STORAGE_VARIANCE_SCALE_MISMATCH");
  exactV1(rounding.rule, CONTINUATION_ROUNDING_RULE_V1, "CONTINUATION_ROUNDING_RULE_MISMATCH");

  exactArrayV1(payload.soil_root_zone_config_refs, [CONTINUATION_SOIL_HYDRAULIC_BINDING_REF_V1], "CONTINUATION_SOIL_ROOT_ZONE_REFS_MISMATCH");
  exactArrayV1(payload.model_component_refs, CONTINUATION_MODEL_COMPONENT_REFS_V1, "CONTINUATION_MODEL_COMPONENT_REFS_MISMATCH");
}

export function compileContinuationRuntimeConfigV1(input: CompileContinuationRuntimeConfigInputV1): CanonicalObjectEnvelopeV1 {
  const payload: ContinuationRuntimeConfigPayloadV1 = {
    config_purpose: CONTINUATION_CONFIG_PURPOSE_V1,
    config_selection_mode: CONTINUATION_CONFIG_SELECTION_MODE_V1,
    parent_runtime_config_ref: requireStringV1(input.parent_runtime_config_ref, "CONTINUATION_PARENT_CONFIG_REF_REQUIRED"),
    parent_runtime_config_hash: requireStringV1(input.parent_runtime_config_hash, "CONTINUATION_PARENT_CONFIG_HASH_REQUIRED"),
    reality_binding_ref: requireStringV1(input.reality_binding_ref, "CONTINUATION_REALITY_BINDING_REF_REQUIRED"),
    reality_binding_hash: requireStringV1(input.reality_binding_hash, "CONTINUATION_REALITY_BINDING_HASH_REQUIRED"),
    source_matrix_hash: requireStringV1(input.source_matrix_hash, "CONTINUATION_SOURCE_MATRIX_HASH_REQUIRED"),
    configuration_matrix_hash: requireStringV1(input.configuration_matrix_hash, "CONTINUATION_CONFIGURATION_MATRIX_HASH_REQUIRED"),
    geometry_semantic_hash: requireStringV1(input.geometry_semantic_hash, "CONTINUATION_GEOMETRY_HASH_REQUIRED"),
    crop_stage_context: {
      context_kind: CONTINUATION_CROP_STAGE_CONTEXT_KIND_V1,
      context_ref: CONTINUATION_CROP_STAGE_CONTEXT_REF_V1,
      context_hash: CONTINUATION_CROP_STAGE_CONTEXT_HASH_V1,
      resolution_policy_id: CONTINUATION_ROOT_ZONE_POLICY_ID_V1,
    },
    dynamics_model: {
      model_component_ref: CONTINUATION_DYNAMICS_MODEL_COMPONENT_REF_V1,
      model_id: CONTINUATION_DYNAMICS_MODEL_ID_V1,
      model_version: 1,
      step_duration: "PT1H",
    },
    soil_hydraulic_snapshot: {
      source_config_ref: CONTINUATION_SOIL_HYDRAULIC_BINDING_REF_V1,
      source_config_hash: CONTINUATION_SOIL_HYDRAULIC_BINDING_HASH_V1,
      root_zone_depth_mm: CONTINUATION_ROOT_ZONE_DEPTH_MM_V1,
      wilting_point_fraction: CONTINUATION_WILTING_POINT_FRACTION_V1,
      wilting_point_storage_mm: CONTINUATION_WILTING_POINT_STORAGE_MM_V1,
      field_capacity_fraction: CONTINUATION_FIELD_CAPACITY_FRACTION_V1,
      field_capacity_storage_mm: CONTINUATION_FIELD_CAPACITY_STORAGE_MM_V1,
      saturation_fraction: CONTINUATION_SATURATION_FRACTION_V1,
      saturation_storage_mm: CONTINUATION_SATURATION_STORAGE_MM_V1,
    },
    dynamics_parameters: {
      parameter_class: "CONTROLLED_SYNTHETIC",
      field_calibration_status: "NOT_FIELD_CALIBRATED",
      runoff_fraction: CONTINUATION_RUNOFF_FRACTION_V1,
      drainage_coefficient_per_hour: CONTINUATION_DRAINAGE_COEFFICIENT_PER_HOUR_V1,
    },
    process_uncertainty: {
      component_ref: CONTINUATION_PROCESS_UNCERTAINTY_COMPONENT_REF_V1,
      policy_id: CONTINUATION_PROCESS_UNCERTAINTY_POLICY_ID_V1,
      policy_version: 1,
      structural_process_stddev_mm_per_hour: CONTINUATION_STRUCTURAL_PROCESS_STDDEV_MM_PER_HOUR_V1,
      rainfall_relative_stddev: CONTINUATION_RAINFALL_RELATIVE_STDDEV_V1,
      crop_et_relative_stddev: CONTINUATION_CROP_ET_RELATIVE_STDDEV_V1,
      executed_irrigation_relative_stddev: CONTINUATION_EXECUTED_IRRIGATION_RELATIVE_STDDEV_V1,
      covariance_policy: CONTINUATION_COVARIANCE_POLICY_ID_V1,
      physical_clipping_reduces_latent_variance: false,
    },
    irrigation_input_policy: {
      policy_id: CONTINUATION_IRRIGATION_INPUT_POLICY_ID_V1,
      event_order: "executed_at_asc_ingested_at_asc_source_record_id_asc",
      spatial_overlap_deduplication: "NOT_ESTABLISHED",
    },
    no_observation_update_policy: {
      component_ref: CONTINUATION_NO_OBSERVATION_COMPONENT_REF_V1,
      policy_id: CONTINUATION_NO_OBSERVATION_POLICY_ID_V1,
      policy_version: 1,
    },
    forecast_block_policy: {
      component_ref: CONTINUATION_FORECAST_BLOCK_COMPONENT_REF_V1,
      policy_id: CONTINUATION_FORECAST_BLOCK_POLICY_ID_V1,
      policy_version: 1,
    },
    rounding: {
      output_decimals: 6,
      computation_storage_mean_scale: 6,
      computation_storage_variance_scale: 12,
      rule: CONTINUATION_ROUNDING_RULE_V1,
    },
    soil_root_zone_config_refs: [CONTINUATION_SOIL_HYDRAULIC_BINDING_REF_V1],
    model_component_refs: [...CONTINUATION_MODEL_COMPONENT_REFS_V1],
  };
  validateContinuationRuntimeConfigPayloadV1(payload);

  const identityBasis = {
    object_type: "twin_runtime_config_v1",
    scope: input.scope,
    logical_time: requireStringV1(input.logical_time, "CONTINUATION_CONFIG_LOGICAL_TIME_REQUIRED"),
    payload,
  };
  const objectId = deriveSemanticObjectIdV1("twin_runtime_config", identityBasis);
  const idempotencyKey = deriveSemanticObjectIdV1("runtime_config_key", identityBasis);
  const config: CanonicalObjectEnvelopeV1 = {
    object_id: objectId,
    object_type: "twin_runtime_config_v1",
    schema_version: "v1",
    ...input.scope,
    logical_time: input.logical_time,
    as_of: input.logical_time,
    source_refs: [payload.parent_runtime_config_ref, payload.reality_binding_ref].sort(),
    evidence_refs: [],
    runtime_config_ref: null,
    runtime_config_hash: null,
    idempotency_key: idempotencyKey,
    determinism_hash: "",
    limitations: [
      "CONTROLLED_SYNTHETIC",
      "NOT_FIELD_CALIBRATED",
      "NO_MODEL_ACTIVATION",
      "NO_DYNAMIC_ROOT_ZONE_GEOMETRY",
      "NO_SPATIAL_EXECUTION_OVERLAP_DEDUPLICATION",
    ],
    created_at: requireStringV1(input.created_at, "CONTINUATION_CONFIG_CREATED_AT_REQUIRED"),
    payload: payload as unknown as Record<string, unknown>,
  };
  config.determinism_hash = computeMemberDeterminismHashV1(config as unknown as Record<string, unknown>);
  return config;
}
