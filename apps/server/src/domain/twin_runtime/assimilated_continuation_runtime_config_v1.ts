// apps/server/src/domain/twin_runtime/assimilated_continuation_runtime_config_v1.ts
// Purpose: define, compile, and validate the immutable MCFT-CAP-03 observation-assimilation Runtime Config while inheriting the frozen MCFT-CAP-02 Dynamics authority.
// Boundary: pure domain contract and deterministic construction only; no persistence, active-config pointer, model activation, filesystem, clock, network, or Runtime orchestration.

import { computeMemberDeterminismHashV1, deriveSemanticObjectIdV1 } from "./canonical_identity_v1.js";
import type { CanonicalObjectEnvelopeV1 } from "./canonical_object_contracts_v1.js";
import type { ContinuationScopeV1 } from "./continuation_operation_identity_v1.js";
import {
  CONTINUATION_CONFIG_SELECTION_MODE_V1,
  CONTINUATION_COVARIANCE_POLICY_ID_V1,
  CONTINUATION_CROP_ET_RELATIVE_STDDEV_V1,
  CONTINUATION_CROP_STAGE_CONTEXT_HASH_V1,
  CONTINUATION_CROP_STAGE_CONTEXT_KIND_V1,
  CONTINUATION_CROP_STAGE_CONTEXT_REF_V1,
  CONTINUATION_DRAINAGE_COEFFICIENT_PER_HOUR_V1,
  CONTINUATION_DYNAMICS_MODEL_COMPONENT_REF_V1,
  CONTINUATION_DYNAMICS_MODEL_ID_V1,
  CONTINUATION_EXECUTED_IRRIGATION_RELATIVE_STDDEV_V1,
  CONTINUATION_FIELD_CAPACITY_FRACTION_V1,
  CONTINUATION_FIELD_CAPACITY_STORAGE_MM_V1,
  CONTINUATION_FORECAST_BLOCK_COMPONENT_REF_V1,
  CONTINUATION_FORECAST_BLOCK_POLICY_ID_V1,
  CONTINUATION_IRRIGATION_INPUT_POLICY_ID_V1,
  CONTINUATION_PROCESS_UNCERTAINTY_COMPONENT_REF_V1,
  CONTINUATION_PROCESS_UNCERTAINTY_POLICY_ID_V1,
  CONTINUATION_RAINFALL_RELATIVE_STDDEV_V1,
  CONTINUATION_ROOT_ZONE_DEPTH_MM_V1,
  CONTINUATION_ROOT_ZONE_POLICY_ID_V1,
  CONTINUATION_ROUNDING_RULE_V1,
  CONTINUATION_RUNOFF_FRACTION_V1,
  CONTINUATION_SATURATION_FRACTION_V1,
  CONTINUATION_SATURATION_STORAGE_MM_V1,
  CONTINUATION_SOIL_HYDRAULIC_BINDING_HASH_V1,
  CONTINUATION_SOIL_HYDRAULIC_BINDING_REF_V1,
  CONTINUATION_STRUCTURAL_PROCESS_STDDEV_MM_PER_HOUR_V1,
  CONTINUATION_WILTING_POINT_FRACTION_V1,
  CONTINUATION_WILTING_POINT_STORAGE_MM_V1,
} from "./continuation_runtime_config_v1.js";
import { ASSIMILATED_CONTINUATION_RECORD_SET_CONTRACT_ID_V1 } from "./assimilated_continuation_contracts_v1.js";

export const ASSIMILATED_CONTINUATION_CONFIG_PURPOSE_V1 =
  "HOURLY_DYNAMICS_WITH_OBSERVATION_ASSIMILATION" as const;
export const ASSIMILATED_CONTINUATION_OBSERVATION_SELECTOR_ID_V1 =
  "LATEST_USABLE_AUTHORIZED_OBSERVATION_WITHIN_15M_BEFORE_TICK_V1" as const;
export const ASSIMILATED_CONTINUATION_OBSERVATION_BINDING_ID_V1 = "soil_obs_c8_20cm_v1" as const;
export const ASSIMILATED_CONTINUATION_OBSERVATION_QUANTITY_KIND_V1 = "VOLUMETRIC_WATER_CONTENT" as const;
export const ASSIMILATED_CONTINUATION_CANONICAL_UNIT_V1 = "fraction" as const;
export const ASSIMILATED_CONTINUATION_OBSERVATION_OPERATOR_ID_V1 =
  "POINT_200MM_TO_ROOT_ZONE_MEAN_H1_WITH_REPRESENTATIVENESS_V1" as const;
export const ASSIMILATED_CONTINUATION_SENSOR_STDDEV_FRACTION_V1 = 0.02 as const;
export const ASSIMILATED_CONTINUATION_REPRESENTATIVENESS_STDDEV_FRACTION_V1 = 0.06 as const;
export const ASSIMILATED_CONTINUATION_METHOD_ID_V1 = "SCALAR_GAUSSIAN_ASSIMILATION_V1" as const;
export const ASSIMILATED_CONTINUATION_OUTLIER_POLICY_ID_V1 =
  "SQUARED_NORMALIZED_INNOVATION_MAX_16_INCLUSIVE_V1" as const;
export const ASSIMILATED_CONTINUATION_MAX_SQUARED_NORMALIZED_INNOVATION_V1 = 16 as const;
export const ASSIMILATED_CONTINUATION_REPORTED_MAX_ABSOLUTE_NORMALIZED_INNOVATION_V1 = 4 as const;
export const ASSIMILATED_CONTINUATION_PHYSICAL_BOUND_VERSION_V1 =
  "ROOT_ZONE_WATER_PHYSICAL_BOUNDS_V1" as const;
export const ASSIMILATED_CONTINUATION_POSTERIOR_CLIP_POLICY_V1 =
  "CLIP_MEAN_TO_ZERO_AND_SATURATION_RETAIN_LATENT_VARIANCE_V1" as const;
export const ASSIMILATED_CONTINUATION_COMPONENT_REF_V1 =
  "mcft_component_scalar_gaussian_observation_assimilation_v1" as const;
export const ASSIMILATED_CONTINUATION_OBSERVATION_OPERATOR_COMPONENT_REF_V1 =
  "mcft_component_point_200mm_root_zone_operator_v1" as const;

export const ASSIMILATED_CONTINUATION_MODEL_COMPONENT_REFS_V1 = [
  CONTINUATION_DYNAMICS_MODEL_COMPONENT_REF_V1,
  CONTINUATION_PROCESS_UNCERTAINTY_COMPONENT_REF_V1,
  ASSIMILATED_CONTINUATION_OBSERVATION_OPERATOR_COMPONENT_REF_V1,
  ASSIMILATED_CONTINUATION_COMPONENT_REF_V1,
  CONTINUATION_FORECAST_BLOCK_COMPONENT_REF_V1,
] as const;

export type AssimilatedContinuationRuntimeConfigPayloadV1 = {
  config_purpose: typeof ASSIMILATED_CONTINUATION_CONFIG_PURPOSE_V1;
  config_selection_mode: typeof CONTINUATION_CONFIG_SELECTION_MODE_V1;
  parent_runtime_config_ref: string;
  parent_runtime_config_hash: string;
  record_set_contract_id: typeof ASSIMILATED_CONTINUATION_RECORD_SET_CONTRACT_ID_V1;
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
  observation_assimilation: {
    component_ref: typeof ASSIMILATED_CONTINUATION_COMPONENT_REF_V1;
    observation_selector_id: typeof ASSIMILATED_CONTINUATION_OBSERVATION_SELECTOR_ID_V1;
    observation_binding_id: typeof ASSIMILATED_CONTINUATION_OBSERVATION_BINDING_ID_V1;
    observation_quantity_kind: typeof ASSIMILATED_CONTINUATION_OBSERVATION_QUANTITY_KIND_V1;
    canonical_unit: typeof ASSIMILATED_CONTINUATION_CANONICAL_UNIT_V1;
    observation_operator: {
      component_ref: typeof ASSIMILATED_CONTINUATION_OBSERVATION_OPERATOR_COMPONENT_REF_V1;
      id: typeof ASSIMILATED_CONTINUATION_OBSERVATION_OPERATOR_ID_V1;
      h: 1;
      direct_state_equivalence: false;
    };
    sensor_measurement_stddev_fraction: typeof ASSIMILATED_CONTINUATION_SENSOR_STDDEV_FRACTION_V1;
    point_to_zone_representativeness_stddev_fraction: typeof ASSIMILATED_CONTINUATION_REPRESENTATIVENESS_STDDEV_FRACTION_V1;
    quality_weights: { PASS: 1; LIMITED: 0.5; FAIL: 0 };
    assimilation_method_id: typeof ASSIMILATED_CONTINUATION_METHOD_ID_V1;
    innovation_outlier_policy_id: typeof ASSIMILATED_CONTINUATION_OUTLIER_POLICY_ID_V1;
    max_squared_normalized_innovation: typeof ASSIMILATED_CONTINUATION_MAX_SQUARED_NORMALIZED_INNOVATION_V1;
    reported_max_absolute_normalized_innovation: typeof ASSIMILATED_CONTINUATION_REPORTED_MAX_ABSOLUTE_NORMALIZED_INNOVATION_V1;
    physical_bound_version: typeof ASSIMILATED_CONTINUATION_PHYSICAL_BOUND_VERSION_V1;
    posterior_clip_policy: typeof ASSIMILATED_CONTINUATION_POSTERIOR_CLIP_POLICY_V1;
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
    computation_vwc_scale: 12;
    computation_vwc_variance_scale: 12;
    rule: typeof CONTINUATION_ROUNDING_RULE_V1;
  };
  soil_root_zone_config_refs: [typeof CONTINUATION_SOIL_HYDRAULIC_BINDING_REF_V1];
  model_component_refs: readonly string[];
  active_model_parameter_change: "FORBIDDEN";
};

export type CompileAssimilatedContinuationRuntimeConfigInputV1 = {
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

function requiredStringV1(value: unknown, code: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(code);
  return value;
}

function requiredRecordV1(value: unknown, code: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(code);
  return value as Record<string, unknown>;
}

function exactV1(actual: unknown, expected: unknown, code: string): void {
  if (actual !== expected) throw new Error(code);
}

function exactArrayV1(actual: unknown, expected: readonly string[], code: string): void {
  if (!Array.isArray(actual) || JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(code);
}

function finitePositiveV1(value: unknown, code: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) throw new Error(code);
  return value;
}

export function validateAssimilatedContinuationRuntimeConfigPayloadV1(
  value: unknown,
): asserts value is AssimilatedContinuationRuntimeConfigPayloadV1 {
  const payload = requiredRecordV1(value, "ASSIMILATED_RUNTIME_CONFIG_PAYLOAD_REQUIRED");
  exactV1(payload.config_purpose, ASSIMILATED_CONTINUATION_CONFIG_PURPOSE_V1, "ASSIMILATED_CONFIG_PURPOSE_MISMATCH");
  exactV1(payload.config_selection_mode, CONTINUATION_CONFIG_SELECTION_MODE_V1, "ASSIMILATED_CONFIG_SELECTION_MODE_MISMATCH");
  exactV1(payload.record_set_contract_id, ASSIMILATED_CONTINUATION_RECORD_SET_CONTRACT_ID_V1, "ASSIMILATED_CONFIG_RECORD_SET_CONTRACT_MISMATCH");
  for (const field of [
    "parent_runtime_config_ref",
    "parent_runtime_config_hash",
    "reality_binding_ref",
    "reality_binding_hash",
    "source_matrix_hash",
    "configuration_matrix_hash",
    "geometry_semantic_hash",
  ]) requiredStringV1(payload[field], `ASSIMILATED_CONFIG_${field.toUpperCase()}_REQUIRED`);

  const crop = requiredRecordV1(payload.crop_stage_context, "ASSIMILATED_CROP_STAGE_CONTEXT_REQUIRED");
  exactV1(crop.context_kind, CONTINUATION_CROP_STAGE_CONTEXT_KIND_V1, "ASSIMILATED_CROP_STAGE_CONTEXT_KIND_MISMATCH");
  exactV1(crop.context_ref, CONTINUATION_CROP_STAGE_CONTEXT_REF_V1, "ASSIMILATED_CROP_STAGE_CONTEXT_REF_MISMATCH");
  exactV1(crop.context_hash, CONTINUATION_CROP_STAGE_CONTEXT_HASH_V1, "ASSIMILATED_CROP_STAGE_CONTEXT_HASH_MISMATCH");
  exactV1(crop.resolution_policy_id, CONTINUATION_ROOT_ZONE_POLICY_ID_V1, "ASSIMILATED_ROOT_ZONE_POLICY_MISMATCH");

  const dynamicsModel = requiredRecordV1(payload.dynamics_model, "ASSIMILATED_DYNAMICS_MODEL_REQUIRED");
  exactV1(dynamicsModel.model_component_ref, CONTINUATION_DYNAMICS_MODEL_COMPONENT_REF_V1, "ASSIMILATED_DYNAMICS_COMPONENT_MISMATCH");
  exactV1(dynamicsModel.model_id, CONTINUATION_DYNAMICS_MODEL_ID_V1, "ASSIMILATED_DYNAMICS_MODEL_ID_MISMATCH");
  exactV1(dynamicsModel.model_version, 1, "ASSIMILATED_DYNAMICS_MODEL_VERSION_MISMATCH");
  exactV1(dynamicsModel.step_duration, "PT1H", "ASSIMILATED_STEP_DURATION_MISMATCH");

  const hydraulic = requiredRecordV1(payload.soil_hydraulic_snapshot, "ASSIMILATED_HYDRAULIC_SNAPSHOT_REQUIRED");
  exactV1(hydraulic.source_config_ref, CONTINUATION_SOIL_HYDRAULIC_BINDING_REF_V1, "ASSIMILATED_HYDRAULIC_REF_MISMATCH");
  exactV1(hydraulic.source_config_hash, CONTINUATION_SOIL_HYDRAULIC_BINDING_HASH_V1, "ASSIMILATED_HYDRAULIC_HASH_MISMATCH");
  exactV1(hydraulic.root_zone_depth_mm, CONTINUATION_ROOT_ZONE_DEPTH_MM_V1, "ASSIMILATED_ROOT_ZONE_DEPTH_MISMATCH");
  exactV1(hydraulic.wilting_point_fraction, CONTINUATION_WILTING_POINT_FRACTION_V1, "ASSIMILATED_WILTING_FRACTION_MISMATCH");
  exactV1(hydraulic.wilting_point_storage_mm, CONTINUATION_WILTING_POINT_STORAGE_MM_V1, "ASSIMILATED_WILTING_STORAGE_MISMATCH");
  exactV1(hydraulic.field_capacity_fraction, CONTINUATION_FIELD_CAPACITY_FRACTION_V1, "ASSIMILATED_FIELD_CAPACITY_FRACTION_MISMATCH");
  exactV1(hydraulic.field_capacity_storage_mm, CONTINUATION_FIELD_CAPACITY_STORAGE_MM_V1, "ASSIMILATED_FIELD_CAPACITY_STORAGE_MISMATCH");
  exactV1(hydraulic.saturation_fraction, CONTINUATION_SATURATION_FRACTION_V1, "ASSIMILATED_SATURATION_FRACTION_MISMATCH");
  exactV1(hydraulic.saturation_storage_mm, CONTINUATION_SATURATION_STORAGE_MM_V1, "ASSIMILATED_SATURATION_STORAGE_MISMATCH");

  const dynamics = requiredRecordV1(payload.dynamics_parameters, "ASSIMILATED_DYNAMICS_PARAMETERS_REQUIRED");
  exactV1(dynamics.parameter_class, "CONTROLLED_SYNTHETIC", "ASSIMILATED_DYNAMICS_PARAMETER_CLASS_MISMATCH");
  exactV1(dynamics.field_calibration_status, "NOT_FIELD_CALIBRATED", "ASSIMILATED_DYNAMICS_CALIBRATION_STATUS_MISMATCH");
  exactV1(dynamics.runoff_fraction, CONTINUATION_RUNOFF_FRACTION_V1, "ASSIMILATED_RUNOFF_FRACTION_MISMATCH");
  exactV1(dynamics.drainage_coefficient_per_hour, CONTINUATION_DRAINAGE_COEFFICIENT_PER_HOUR_V1, "ASSIMILATED_DRAINAGE_COEFFICIENT_MISMATCH");

  const uncertainty = requiredRecordV1(payload.process_uncertainty, "ASSIMILATED_PROCESS_UNCERTAINTY_REQUIRED");
  exactV1(uncertainty.component_ref, CONTINUATION_PROCESS_UNCERTAINTY_COMPONENT_REF_V1, "ASSIMILATED_UNCERTAINTY_COMPONENT_MISMATCH");
  exactV1(uncertainty.policy_id, CONTINUATION_PROCESS_UNCERTAINTY_POLICY_ID_V1, "ASSIMILATED_UNCERTAINTY_POLICY_MISMATCH");
  exactV1(uncertainty.policy_version, 1, "ASSIMILATED_UNCERTAINTY_POLICY_VERSION_MISMATCH");
  exactV1(uncertainty.structural_process_stddev_mm_per_hour, CONTINUATION_STRUCTURAL_PROCESS_STDDEV_MM_PER_HOUR_V1, "ASSIMILATED_STRUCTURAL_STDDEV_MISMATCH");
  exactV1(uncertainty.rainfall_relative_stddev, CONTINUATION_RAINFALL_RELATIVE_STDDEV_V1, "ASSIMILATED_RAINFALL_STDDEV_MISMATCH");
  exactV1(uncertainty.crop_et_relative_stddev, CONTINUATION_CROP_ET_RELATIVE_STDDEV_V1, "ASSIMILATED_CROP_ET_STDDEV_MISMATCH");
  exactV1(uncertainty.executed_irrigation_relative_stddev, CONTINUATION_EXECUTED_IRRIGATION_RELATIVE_STDDEV_V1, "ASSIMILATED_IRRIGATION_STDDEV_MISMATCH");
  exactV1(uncertainty.covariance_policy, CONTINUATION_COVARIANCE_POLICY_ID_V1, "ASSIMILATED_COVARIANCE_POLICY_MISMATCH");
  exactV1(uncertainty.physical_clipping_reduces_latent_variance, false, "ASSIMILATED_CLIPPING_VARIANCE_POLICY_MISMATCH");

  const irrigation = requiredRecordV1(payload.irrigation_input_policy, "ASSIMILATED_IRRIGATION_POLICY_REQUIRED");
  exactV1(irrigation.policy_id, CONTINUATION_IRRIGATION_INPUT_POLICY_ID_V1, "ASSIMILATED_IRRIGATION_POLICY_MISMATCH");
  exactV1(irrigation.event_order, "executed_at_asc_ingested_at_asc_source_record_id_asc", "ASSIMILATED_IRRIGATION_ORDER_MISMATCH");
  exactV1(irrigation.spatial_overlap_deduplication, "NOT_ESTABLISHED", "ASSIMILATED_SPATIAL_OVERLAP_POLICY_MISMATCH");

  if ("no_observation_update_policy" in payload) throw new Error("ASSIMILATED_DEFERRED_OBSERVATION_POLICY_FORBIDDEN");
  const assimilation = requiredRecordV1(payload.observation_assimilation, "ASSIMILATED_OBSERVATION_ASSIMILATION_REQUIRED");
  exactV1(assimilation.component_ref, ASSIMILATED_CONTINUATION_COMPONENT_REF_V1, "ASSIMILATED_COMPONENT_REF_MISMATCH");
  exactV1(assimilation.observation_selector_id, ASSIMILATED_CONTINUATION_OBSERVATION_SELECTOR_ID_V1, "ASSIMILATED_SELECTOR_MISMATCH");
  exactV1(assimilation.observation_binding_id, ASSIMILATED_CONTINUATION_OBSERVATION_BINDING_ID_V1, "ASSIMILATED_BINDING_MISMATCH");
  exactV1(assimilation.observation_quantity_kind, ASSIMILATED_CONTINUATION_OBSERVATION_QUANTITY_KIND_V1, "ASSIMILATED_QUANTITY_MISMATCH");
  exactV1(assimilation.canonical_unit, ASSIMILATED_CONTINUATION_CANONICAL_UNIT_V1, "ASSIMILATED_CANONICAL_UNIT_MISMATCH");
  const operator = requiredRecordV1(assimilation.observation_operator, "ASSIMILATED_OBSERVATION_OPERATOR_REQUIRED");
  exactV1(operator.component_ref, ASSIMILATED_CONTINUATION_OBSERVATION_OPERATOR_COMPONENT_REF_V1, "ASSIMILATED_OPERATOR_COMPONENT_MISMATCH");
  exactV1(operator.id, ASSIMILATED_CONTINUATION_OBSERVATION_OPERATOR_ID_V1, "ASSIMILATED_OPERATOR_ID_MISMATCH");
  exactV1(operator.h, 1, "ASSIMILATED_OPERATOR_H_MISMATCH");
  exactV1(operator.direct_state_equivalence, false, "ASSIMILATED_DIRECT_STATE_EQUIVALENCE_FORBIDDEN");
  finitePositiveV1(assimilation.sensor_measurement_stddev_fraction, "ASSIMILATED_SENSOR_STDDEV_NOT_POSITIVE");
  finitePositiveV1(assimilation.point_to_zone_representativeness_stddev_fraction, "ASSIMILATED_REPRESENTATIVENESS_STDDEV_NOT_POSITIVE");
  const weights = requiredRecordV1(assimilation.quality_weights, "ASSIMILATED_QUALITY_WEIGHTS_REQUIRED");
  exactV1(weights.PASS, 1, "ASSIMILATED_PASS_WEIGHT_MISMATCH");
  exactV1(weights.LIMITED, 0.5, "ASSIMILATED_LIMITED_WEIGHT_MISMATCH");
  exactV1(weights.FAIL, 0, "ASSIMILATED_FAIL_WEIGHT_MISMATCH");
  exactV1(assimilation.assimilation_method_id, ASSIMILATED_CONTINUATION_METHOD_ID_V1, "ASSIMILATED_METHOD_MISMATCH");
  exactV1(assimilation.innovation_outlier_policy_id, ASSIMILATED_CONTINUATION_OUTLIER_POLICY_ID_V1, "ASSIMILATED_OUTLIER_POLICY_MISMATCH");
  exactV1(assimilation.max_squared_normalized_innovation, ASSIMILATED_CONTINUATION_MAX_SQUARED_NORMALIZED_INNOVATION_V1, "ASSIMILATED_OUTLIER_THRESHOLD_MISMATCH");
  exactV1(assimilation.reported_max_absolute_normalized_innovation, ASSIMILATED_CONTINUATION_REPORTED_MAX_ABSOLUTE_NORMALIZED_INNOVATION_V1, "ASSIMILATED_REPORTED_THRESHOLD_MISMATCH");
  exactV1(assimilation.physical_bound_version, ASSIMILATED_CONTINUATION_PHYSICAL_BOUND_VERSION_V1, "ASSIMILATED_PHYSICAL_BOUND_VERSION_MISMATCH");
  exactV1(assimilation.posterior_clip_policy, ASSIMILATED_CONTINUATION_POSTERIOR_CLIP_POLICY_V1, "ASSIMILATED_CLIP_POLICY_MISMATCH");

  const forecast = requiredRecordV1(payload.forecast_block_policy, "ASSIMILATED_FORECAST_BLOCK_POLICY_REQUIRED");
  exactV1(forecast.component_ref, CONTINUATION_FORECAST_BLOCK_COMPONENT_REF_V1, "ASSIMILATED_FORECAST_COMPONENT_MISMATCH");
  exactV1(forecast.policy_id, CONTINUATION_FORECAST_BLOCK_POLICY_ID_V1, "ASSIMILATED_FORECAST_POLICY_MISMATCH");
  exactV1(forecast.policy_version, 1, "ASSIMILATED_FORECAST_POLICY_VERSION_MISMATCH");

  const rounding = requiredRecordV1(payload.rounding, "ASSIMILATED_ROUNDING_REQUIRED");
  exactV1(rounding.output_decimals, 6, "ASSIMILATED_OUTPUT_DECIMALS_MISMATCH");
  exactV1(rounding.computation_storage_mean_scale, 6, "ASSIMILATED_STORAGE_MEAN_SCALE_MISMATCH");
  exactV1(rounding.computation_storage_variance_scale, 12, "ASSIMILATED_STORAGE_VARIANCE_SCALE_MISMATCH");
  exactV1(rounding.computation_vwc_scale, 12, "ASSIMILATED_VWC_SCALE_MISMATCH");
  exactV1(rounding.computation_vwc_variance_scale, 12, "ASSIMILATED_VWC_VARIANCE_SCALE_MISMATCH");
  exactV1(rounding.rule, CONTINUATION_ROUNDING_RULE_V1, "ASSIMILATED_ROUNDING_RULE_MISMATCH");
  exactArrayV1(payload.soil_root_zone_config_refs, [CONTINUATION_SOIL_HYDRAULIC_BINDING_REF_V1], "ASSIMILATED_SOIL_ROOT_ZONE_REFS_MISMATCH");
  exactArrayV1(payload.model_component_refs, ASSIMILATED_CONTINUATION_MODEL_COMPONENT_REFS_V1, "ASSIMILATED_MODEL_COMPONENT_REFS_MISMATCH");
  exactV1(payload.active_model_parameter_change, "FORBIDDEN", "ASSIMILATED_ACTIVE_MODEL_PARAMETER_CHANGE_MISMATCH");
}

export function compileAssimilatedContinuationRuntimeConfigV1(
  input: CompileAssimilatedContinuationRuntimeConfigInputV1,
): CanonicalObjectEnvelopeV1 {
  const payload: AssimilatedContinuationRuntimeConfigPayloadV1 = {
    config_purpose: ASSIMILATED_CONTINUATION_CONFIG_PURPOSE_V1,
    config_selection_mode: CONTINUATION_CONFIG_SELECTION_MODE_V1,
    parent_runtime_config_ref: requiredStringV1(input.parent_runtime_config_ref, "ASSIMILATED_PARENT_CONFIG_REF_REQUIRED"),
    parent_runtime_config_hash: requiredStringV1(input.parent_runtime_config_hash, "ASSIMILATED_PARENT_CONFIG_HASH_REQUIRED"),
    record_set_contract_id: ASSIMILATED_CONTINUATION_RECORD_SET_CONTRACT_ID_V1,
    reality_binding_ref: requiredStringV1(input.reality_binding_ref, "ASSIMILATED_REALITY_BINDING_REF_REQUIRED"),
    reality_binding_hash: requiredStringV1(input.reality_binding_hash, "ASSIMILATED_REALITY_BINDING_HASH_REQUIRED"),
    source_matrix_hash: requiredStringV1(input.source_matrix_hash, "ASSIMILATED_SOURCE_MATRIX_HASH_REQUIRED"),
    configuration_matrix_hash: requiredStringV1(input.configuration_matrix_hash, "ASSIMILATED_CONFIGURATION_MATRIX_HASH_REQUIRED"),
    geometry_semantic_hash: requiredStringV1(input.geometry_semantic_hash, "ASSIMILATED_GEOMETRY_HASH_REQUIRED"),
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
    observation_assimilation: {
      component_ref: ASSIMILATED_CONTINUATION_COMPONENT_REF_V1,
      observation_selector_id: ASSIMILATED_CONTINUATION_OBSERVATION_SELECTOR_ID_V1,
      observation_binding_id: ASSIMILATED_CONTINUATION_OBSERVATION_BINDING_ID_V1,
      observation_quantity_kind: ASSIMILATED_CONTINUATION_OBSERVATION_QUANTITY_KIND_V1,
      canonical_unit: ASSIMILATED_CONTINUATION_CANONICAL_UNIT_V1,
      observation_operator: {
        component_ref: ASSIMILATED_CONTINUATION_OBSERVATION_OPERATOR_COMPONENT_REF_V1,
        id: ASSIMILATED_CONTINUATION_OBSERVATION_OPERATOR_ID_V1,
        h: 1,
        direct_state_equivalence: false,
      },
      sensor_measurement_stddev_fraction: ASSIMILATED_CONTINUATION_SENSOR_STDDEV_FRACTION_V1,
      point_to_zone_representativeness_stddev_fraction: ASSIMILATED_CONTINUATION_REPRESENTATIVENESS_STDDEV_FRACTION_V1,
      quality_weights: { PASS: 1, LIMITED: 0.5, FAIL: 0 },
      assimilation_method_id: ASSIMILATED_CONTINUATION_METHOD_ID_V1,
      innovation_outlier_policy_id: ASSIMILATED_CONTINUATION_OUTLIER_POLICY_ID_V1,
      max_squared_normalized_innovation: ASSIMILATED_CONTINUATION_MAX_SQUARED_NORMALIZED_INNOVATION_V1,
      reported_max_absolute_normalized_innovation: ASSIMILATED_CONTINUATION_REPORTED_MAX_ABSOLUTE_NORMALIZED_INNOVATION_V1,
      physical_bound_version: ASSIMILATED_CONTINUATION_PHYSICAL_BOUND_VERSION_V1,
      posterior_clip_policy: ASSIMILATED_CONTINUATION_POSTERIOR_CLIP_POLICY_V1,
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
      computation_vwc_scale: 12,
      computation_vwc_variance_scale: 12,
      rule: CONTINUATION_ROUNDING_RULE_V1,
    },
    soil_root_zone_config_refs: [CONTINUATION_SOIL_HYDRAULIC_BINDING_REF_V1],
    model_component_refs: [...ASSIMILATED_CONTINUATION_MODEL_COMPONENT_REFS_V1],
    active_model_parameter_change: "FORBIDDEN",
  };
  validateAssimilatedContinuationRuntimeConfigPayloadV1(payload);

  const identityBasis = {
    object_type: "twin_runtime_config_v1",
    scope: input.scope,
    logical_time: requiredStringV1(input.logical_time, "ASSIMILATED_CONFIG_LOGICAL_TIME_REQUIRED"),
    payload,
  };
  const config: CanonicalObjectEnvelopeV1 = {
    object_id: deriveSemanticObjectIdV1("twin_runtime_config", identityBasis),
    object_type: "twin_runtime_config_v1",
    schema_version: "v1",
    ...input.scope,
    logical_time: input.logical_time,
    as_of: input.logical_time,
    source_refs: [payload.parent_runtime_config_ref, payload.reality_binding_ref].sort(),
    evidence_refs: [],
    runtime_config_ref: null,
    runtime_config_hash: null,
    idempotency_key: deriveSemanticObjectIdV1("runtime_config_key", identityBasis),
    determinism_hash: "",
    limitations: [
      "CONTROLLED_SYNTHETIC",
      "NOT_FIELD_CALIBRATED",
      "NO_MODEL_ACTIVATION",
      "NO_ACTIVE_MODEL_PARAMETER_CHANGE",
      "NO_DYNAMIC_ROOT_ZONE_GEOMETRY",
      "NO_MULTI_SENSOR_FUSION",
      "NO_SPATIAL_EXECUTION_OVERLAP_DEDUPLICATION",
    ],
    created_at: requiredStringV1(input.created_at, "ASSIMILATED_CONFIG_CREATED_AT_REQUIRED"),
    payload: payload as unknown as Record<string, unknown>,
  };
  config.determinism_hash = computeMemberDeterminismHashV1(config as unknown as Record<string, unknown>);
  return config;
}
