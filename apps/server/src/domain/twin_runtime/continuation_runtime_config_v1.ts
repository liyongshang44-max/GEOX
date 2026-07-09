// apps/server/src/domain/twin_runtime/continuation_runtime_config_v1.ts
// Purpose: define and validate the frozen MCFT-CAP-02 continuation Runtime Config semantic payload.
// Boundary: pure domain contract validation only; no database, routes, wall clock, random values, filesystem, or network.

export const MCFT_CAP_02_CONTINUATION_CONFIG_PURPOSE_V1 = "HOURLY_DYNAMICS_CONTINUATION" as const;
export const MCFT_CAP_02_CONTINUATION_CONFIG_SELECTION_MODE_V1 = "EXPLICIT_REPLAY_PIN" as const;
export const MCFT_CAP_02_CONTINUATION_ROOT_ZONE_POLICY_ID_V1 = "GOVERNED_FIXED_ROOT_ZONE_300MM_V1" as const;
export const MCFT_CAP_02_CONTINUATION_MODEL_ID_V1 = "ROOT_ZONE_HOURLY_WATER_BALANCE_V1" as const;
export const MCFT_CAP_02_CONTINUATION_PROCESS_UNCERTAINTY_POLICY_ID_V1 = "CONTROLLED_ADDITIVE_PROCESS_UNCERTAINTY_BUDGET_V1" as const;
export const MCFT_CAP_02_CONTINUATION_NO_OBSERVATION_POLICY_ID_V1 = "DEFER_OBSERVATION_ASSIMILATION_TO_MCFT_CAP_03_V1" as const;
export const MCFT_CAP_02_CONTINUATION_FORECAST_BLOCK_POLICY_ID_V1 = "MCFT_CAP_02_PINNED_CONFIG_NO_FORECAST_COMPONENT_V1" as const;
export const MCFT_CAP_02_CONTINUATION_ROUNDING_RULE_V1 = "DECIMAL_HALF_AWAY_FROM_ZERO_V1" as const;
export const MCFT_CAP_02_CONTINUATION_CROP_STAGE_CONTEXT_KIND_V1 = "CONFIGURATION_DERIVED_CONTEXT" as const;
export const MCFT_CAP_02_CONTINUATION_CROP_ROOT_ZONE_DEPTH_MM_V1 = 300 as const;
export const MCFT_CAP_02_CONTINUATION_WILTING_POINT_FRACTION_V1 = 0.120000 as const;
export const MCFT_CAP_02_CONTINUATION_WILTING_POINT_STORAGE_MM_V1 = 36.000000 as const;
export const MCFT_CAP_02_CONTINUATION_FIELD_CAPACITY_FRACTION_V1 = 0.300000 as const;
export const MCFT_CAP_02_CONTINUATION_FIELD_CAPACITY_STORAGE_MM_V1 = 90.000000 as const;
export const MCFT_CAP_02_CONTINUATION_SATURATION_FRACTION_V1 = 0.450000 as const;
export const MCFT_CAP_02_CONTINUATION_SATURATION_STORAGE_MM_V1 = 135.000000 as const;
export const MCFT_CAP_02_CONTINUATION_RUNOFF_FRACTION_V1 = 0.050000 as const;
export const MCFT_CAP_02_CONTINUATION_DRAINAGE_COEFFICIENT_PER_HOUR_V1 = 0.030000 as const;
export const MCFT_CAP_02_CONTINUATION_STRUCTURAL_PROCESS_STDDEV_MM_PER_HOUR_V1 = 0.500000 as const;
export const MCFT_CAP_02_CONTINUATION_RAINFALL_RELATIVE_STDDEV_V1 = 0.100000 as const;
export const MCFT_CAP_02_CONTINUATION_CROP_ET_RELATIVE_STDDEV_V1 = 0.150000 as const;
export const MCFT_CAP_02_CONTINUATION_EXECUTED_IRRIGATION_RELATIVE_STDDEV_V1 = 0.100000 as const;
export const MCFT_CAP_02_CONTINUATION_COVARIANCE_POLICY_V1 = "ZERO_COVARIANCE_CONTROLLED_ASSUMPTION_V1" as const;
export const MCFT_CAP_02_CONTINUATION_IRRIGATION_INPUT_POLICY_V1 = "COVERAGE_WEIGHTED_EXECUTED_AMOUNT_SUM_V1" as const;
export const MCFT_CAP_02_CONTINUATION_SPATIAL_OVERLAP_POLICY_V1 = "NOT_ESTABLISHED" as const;
export const MCFT_CAP_02_CONTINUATION_OUTPUT_DECIMALS_V1 = 6 as const;
export const MCFT_CAP_02_CONTINUATION_COMPUTATION_STORAGE_VARIANCE_SCALE_V1 = 12 as const;

export type ContinuationScopeV1 = {
  tenant_id: string;
  project_id: string;
  group_id: string;
  field_id: string;
  season_id: string;
  zone_id: string;
};

export type ContinuationRuntimeConfigSemanticPayloadV1 = {
  config_purpose: typeof MCFT_CAP_02_CONTINUATION_CONFIG_PURPOSE_V1;
  config_selection_mode: typeof MCFT_CAP_02_CONTINUATION_CONFIG_SELECTION_MODE_V1;
  parent_runtime_config_ref: string;
  parent_runtime_config_hash: string;
  reality_binding_ref: string;
  reality_binding_hash: string;
  source_matrix_hash: string;
  configuration_matrix_hash: string;
  geometry_semantic_hash: string;
  crop_stage_context: {
    context_kind: typeof MCFT_CAP_02_CONTINUATION_CROP_STAGE_CONTEXT_KIND_V1;
    context_ref: string;
    context_hash: string;
    resolution_policy_id: typeof MCFT_CAP_02_CONTINUATION_ROOT_ZONE_POLICY_ID_V1;
  };
  dynamics_model: {
    model_component_ref: string;
    model_id: typeof MCFT_CAP_02_CONTINUATION_MODEL_ID_V1;
    model_version: 1;
    step_duration: "PT1H";
  };
  soil_hydraulic_snapshot: {
    source_config_ref: string;
    source_config_hash: string;
    root_zone_depth_mm: typeof MCFT_CAP_02_CONTINUATION_CROP_ROOT_ZONE_DEPTH_MM_V1;
    wilting_point_fraction: typeof MCFT_CAP_02_CONTINUATION_WILTING_POINT_FRACTION_V1;
    wilting_point_storage_mm: typeof MCFT_CAP_02_CONTINUATION_WILTING_POINT_STORAGE_MM_V1;
    field_capacity_fraction: typeof MCFT_CAP_02_CONTINUATION_FIELD_CAPACITY_FRACTION_V1;
    field_capacity_storage_mm: typeof MCFT_CAP_02_CONTINUATION_FIELD_CAPACITY_STORAGE_MM_V1;
    saturation_fraction: typeof MCFT_CAP_02_CONTINUATION_SATURATION_FRACTION_V1;
    saturation_storage_mm: typeof MCFT_CAP_02_CONTINUATION_SATURATION_STORAGE_MM_V1;
  };
  dynamics_parameters: {
    parameter_class: "CONTROLLED_SYNTHETIC";
    field_calibration_status: "NOT_FIELD_CALIBRATED";
    runoff_fraction: typeof MCFT_CAP_02_CONTINUATION_RUNOFF_FRACTION_V1;
    drainage_coefficient_per_hour: typeof MCFT_CAP_02_CONTINUATION_DRAINAGE_COEFFICIENT_PER_HOUR_V1;
  };
  process_uncertainty: {
    policy_id: typeof MCFT_CAP_02_CONTINUATION_PROCESS_UNCERTAINTY_POLICY_ID_V1;
    policy_version: 1;
    structural_process_stddev_mm_per_hour: typeof MCFT_CAP_02_CONTINUATION_STRUCTURAL_PROCESS_STDDEV_MM_PER_HOUR_V1;
    rainfall_relative_stddev: typeof MCFT_CAP_02_CONTINUATION_RAINFALL_RELATIVE_STDDEV_V1;
    crop_et_relative_stddev: typeof MCFT_CAP_02_CONTINUATION_CROP_ET_RELATIVE_STDDEV_V1;
    executed_irrigation_relative_stddev: typeof MCFT_CAP_02_CONTINUATION_EXECUTED_IRRIGATION_RELATIVE_STDDEV_V1;
    covariance_policy: typeof MCFT_CAP_02_CONTINUATION_COVARIANCE_POLICY_V1;
    physical_clipping_reduces_latent_variance: false;
  };
  irrigation_input_policy: {
    policy_id: typeof MCFT_CAP_02_CONTINUATION_IRRIGATION_INPUT_POLICY_V1;
    event_order: "executed_at_asc_ingested_at_asc_source_record_id_asc";
    spatial_overlap_deduplication: typeof MCFT_CAP_02_CONTINUATION_SPATIAL_OVERLAP_POLICY_V1;
  };
  no_observation_update_policy: {
    policy_id: typeof MCFT_CAP_02_CONTINUATION_NO_OBSERVATION_POLICY_ID_V1;
  };
  forecast_block_policy: {
    policy_id: typeof MCFT_CAP_02_CONTINUATION_FORECAST_BLOCK_POLICY_ID_V1;
  };
  rounding: {
    output_decimals: typeof MCFT_CAP_02_CONTINUATION_OUTPUT_DECIMALS_V1;
    computation_storage_mean_scale: 6;
    computation_storage_variance_scale: typeof MCFT_CAP_02_CONTINUATION_COMPUTATION_STORAGE_VARIANCE_SCALE_V1;
    rule: typeof MCFT_CAP_02_CONTINUATION_ROUNDING_RULE_V1;
  };
  soil_root_zone_config_refs: string[];
  model_component_refs: string[];
};

function requireRecordV1(value: unknown, code: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(code);
  return value as Record<string, unknown>;
}

function requireStringV1(value: unknown, code: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(code);
  return value;
}

function requireNumberV1(value: unknown, code: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(code);
  return value;
}

function requireArrayV1(value: unknown, code: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(code);
  return value;
}

function exactV1<T>(actual: T, expected: T, code: string): void {
  if (actual !== expected) throw new Error(code);
}

export function validateContinuationRuntimeConfigSemanticPayloadV1(value: unknown): asserts value is ContinuationRuntimeConfigSemanticPayloadV1 {
  const payload = requireRecordV1(value, "CONTINUATION_RUNTIME_CONFIG_PAYLOAD_REQUIRED");
  exactV1(payload.config_purpose, MCFT_CAP_02_CONTINUATION_CONFIG_PURPOSE_V1, "CONTINUATION_CONFIG_PURPOSE_MISMATCH");
  exactV1(payload.config_selection_mode, MCFT_CAP_02_CONTINUATION_CONFIG_SELECTION_MODE_V1, "CONTINUATION_CONFIG_SELECTION_MODE_MISMATCH");
  requireStringV1(payload.parent_runtime_config_ref, "PARENT_RUNTIME_CONFIG_REF_REQUIRED");
  requireStringV1(payload.parent_runtime_config_hash, "PARENT_RUNTIME_CONFIG_HASH_REQUIRED");
  requireStringV1(payload.reality_binding_ref, "REALITY_BINDING_REF_REQUIRED");
  requireStringV1(payload.reality_binding_hash, "REALITY_BINDING_HASH_REQUIRED");
  requireStringV1(payload.source_matrix_hash, "SOURCE_MATRIX_HASH_REQUIRED");
  requireStringV1(payload.configuration_matrix_hash, "CONFIGURATION_MATRIX_HASH_REQUIRED");
  requireStringV1(payload.geometry_semantic_hash, "GEOMETRY_SEMANTIC_HASH_REQUIRED");

  const cropStageContext = requireRecordV1(payload.crop_stage_context, "CROP_STAGE_CONTEXT_REQUIRED");
  exactV1(cropStageContext.context_kind, MCFT_CAP_02_CONTINUATION_CROP_STAGE_CONTEXT_KIND_V1, "CROP_STAGE_CONTEXT_KIND_MISMATCH");
  requireStringV1(cropStageContext.context_ref, "CROP_STAGE_CONTEXT_REF_REQUIRED");
  requireStringV1(cropStageContext.context_hash, "CROP_STAGE_CONTEXT_HASH_REQUIRED");
  exactV1(cropStageContext.resolution_policy_id, MCFT_CAP_02_CONTINUATION_ROOT_ZONE_POLICY_ID_V1, "CROP_STAGE_CONTEXT_POLICY_MISMATCH");

  const dynamicsModel = requireRecordV1(payload.dynamics_model, "DYNAMICS_MODEL_REQUIRED");
  requireStringV1(dynamicsModel.model_component_ref, "DYNAMICS_MODEL_COMPONENT_REF_REQUIRED");
  exactV1(dynamicsModel.model_id, MCFT_CAP_02_CONTINUATION_MODEL_ID_V1, "DYNAMICS_MODEL_ID_MISMATCH");
  exactV1(dynamicsModel.model_version, 1, "DYNAMICS_MODEL_VERSION_MISMATCH");
  exactV1(dynamicsModel.step_duration, "PT1H", "DYNAMICS_MODEL_STEP_DURATION_MISMATCH");

  const hydraulic = requireRecordV1(payload.soil_hydraulic_snapshot, "SOIL_HYDRAULIC_SNAPSHOT_REQUIRED");
  requireStringV1(hydraulic.source_config_ref, "SOIL_HYDRAULIC_SOURCE_CONFIG_REF_REQUIRED");
  requireStringV1(hydraulic.source_config_hash, "SOIL_HYDRAULIC_SOURCE_CONFIG_HASH_REQUIRED");
  exactV1(hydraulic.root_zone_depth_mm, MCFT_CAP_02_CONTINUATION_CROP_ROOT_ZONE_DEPTH_MM_V1, "ROOT_ZONE_DEPTH_MM_MISMATCH");
  exactV1(hydraulic.wilting_point_fraction, MCFT_CAP_02_CONTINUATION_WILTING_POINT_FRACTION_V1, "WILTING_POINT_FRACTION_MISMATCH");
  exactV1(hydraulic.wilting_point_storage_mm, MCFT_CAP_02_CONTINUATION_WILTING_POINT_STORAGE_MM_V1, "WILTING_POINT_STORAGE_MISMATCH");
  exactV1(hydraulic.field_capacity_fraction, MCFT_CAP_02_CONTINUATION_FIELD_CAPACITY_FRACTION_V1, "FIELD_CAPACITY_FRACTION_MISMATCH");
  exactV1(hydraulic.field_capacity_storage_mm, MCFT_CAP_02_CONTINUATION_FIELD_CAPACITY_STORAGE_MM_V1, "FIELD_CAPACITY_STORAGE_MISMATCH");
  exactV1(hydraulic.saturation_fraction, MCFT_CAP_02_CONTINUATION_SATURATION_FRACTION_V1, "SATURATION_FRACTION_MISMATCH");
  exactV1(hydraulic.saturation_storage_mm, MCFT_CAP_02_CONTINUATION_SATURATION_STORAGE_MM_V1, "SATURATION_STORAGE_MISMATCH");

  const dynamicsParameters = requireRecordV1(payload.dynamics_parameters, "DYNAMICS_PARAMETERS_REQUIRED");
  exactV1(dynamicsParameters.parameter_class, "CONTROLLED_SYNTHETIC", "DYNAMICS_PARAMETER_CLASS_MISMATCH");
  exactV1(dynamicsParameters.field_calibration_status, "NOT_FIELD_CALIBRATED", "FIELD_CALIBRATION_STATUS_MISMATCH");
  exactV1(dynamicsParameters.runoff_fraction, MCFT_CAP_02_CONTINUATION_RUNOFF_FRACTION_V1, "RUNOFF_FRACTION_MISMATCH");
  exactV1(dynamicsParameters.drainage_coefficient_per_hour, MCFT_CAP_02_CONTINUATION_DRAINAGE_COEFFICIENT_PER_HOUR_V1, "DRAINAGE_COEFFICIENT_MISMATCH");

  const processUncertainty = requireRecordV1(payload.process_uncertainty, "PROCESS_UNCERTAINTY_REQUIRED");
  exactV1(processUncertainty.policy_id, MCFT_CAP_02_CONTINUATION_PROCESS_UNCERTAINTY_POLICY_ID_V1, "PROCESS_UNCERTAINTY_POLICY_MISMATCH");
  exactV1(processUncertainty.policy_version, 1, "PROCESS_UNCERTAINTY_POLICY_VERSION_MISMATCH");
  exactV1(processUncertainty.structural_process_stddev_mm_per_hour, MCFT_CAP_02_CONTINUATION_STRUCTURAL_PROCESS_STDDEV_MM_PER_HOUR_V1, "PROCESS_UNCERTAINTY_STRUCTURAL_STDDEV_MISMATCH");
  exactV1(processUncertainty.rainfall_relative_stddev, MCFT_CAP_02_CONTINUATION_RAINFALL_RELATIVE_STDDEV_V1, "PROCESS_UNCERTAINTY_RAINFALL_STDDEV_MISMATCH");
  exactV1(processUncertainty.crop_et_relative_stddev, MCFT_CAP_02_CONTINUATION_CROP_ET_RELATIVE_STDDEV_V1, "PROCESS_UNCERTAINTY_CROP_ET_STDDEV_MISMATCH");
  exactV1(processUncertainty.executed_irrigation_relative_stddev, MCFT_CAP_02_CONTINUATION_EXECUTED_IRRIGATION_RELATIVE_STDDEV_V1, "PROCESS_UNCERTAINTY_IRRIGATION_STDDEV_MISMATCH");
  exactV1(processUncertainty.covariance_policy, MCFT_CAP_02_CONTINUATION_COVARIANCE_POLICY_V1, "PROCESS_UNCERTAINTY_COVARIANCE_POLICY_MISMATCH");
  exactV1(processUncertainty.physical_clipping_reduces_latent_variance, false, "PROCESS_UNCERTAINTY_CLIPPING_POLICY_MISMATCH");

  const irrigationInputPolicy = requireRecordV1(payload.irrigation_input_policy, "IRRIGATION_INPUT_POLICY_REQUIRED");
  exactV1(irrigationInputPolicy.policy_id, MCFT_CAP_02_CONTINUATION_IRRIGATION_INPUT_POLICY_V1, "IRRIGATION_INPUT_POLICY_ID_MISMATCH");
  exactV1(irrigationInputPolicy.event_order, "executed_at_asc_ingested_at_asc_source_record_id_asc", "IRRIGATION_EVENT_ORDER_MISMATCH");
  exactV1(irrigationInputPolicy.spatial_overlap_deduplication, MCFT_CAP_02_CONTINUATION_SPATIAL_OVERLAP_POLICY_V1, "IRRIGATION_SPATIAL_OVERLAP_POLICY_MISMATCH");

  const noObservation = requireRecordV1(payload.no_observation_update_policy, "NO_OBSERVATION_UPDATE_POLICY_REQUIRED");
  exactV1(noObservation.policy_id, MCFT_CAP_02_CONTINUATION_NO_OBSERVATION_POLICY_ID_V1, "NO_OBSERVATION_POLICY_MISMATCH");

  const forecastBlock = requireRecordV1(payload.forecast_block_policy, "FORECAST_BLOCK_POLICY_REQUIRED");
  exactV1(forecastBlock.policy_id, MCFT_CAP_02_CONTINUATION_FORECAST_BLOCK_POLICY_ID_V1, "FORECAST_BLOCK_POLICY_MISMATCH");

  const rounding = requireRecordV1(payload.rounding, "ROUNDING_REQUIRED");
  exactV1(rounding.output_decimals, MCFT_CAP_02_CONTINUATION_OUTPUT_DECIMALS_V1, "ROUNDING_OUTPUT_DECIMALS_MISMATCH");
  exactV1(rounding.computation_storage_mean_scale, 6, "ROUNDING_STORAGE_MEAN_SCALE_MISMATCH");
  exactV1(rounding.computation_storage_variance_scale, MCFT_CAP_02_CONTINUATION_COMPUTATION_STORAGE_VARIANCE_SCALE_V1, "ROUNDING_STORAGE_VARIANCE_SCALE_MISMATCH");
  exactV1(rounding.rule, MCFT_CAP_02_CONTINUATION_ROUNDING_RULE_V1, "ROUNDING_RULE_MISMATCH");

  const soilRootZoneConfigRefs = requireArrayV1(payload.soil_root_zone_config_refs, "SOIL_ROOT_ZONE_CONFIG_REFS_REQUIRED");
  if (soilRootZoneConfigRefs.length !== 1) throw new Error("SOIL_ROOT_ZONE_CONFIG_REFS_CARDINALITY");
  soilRootZoneConfigRefs.forEach((value) => requireStringV1(value, "SOIL_ROOT_ZONE_CONFIG_REF_REQUIRED"));

  const modelComponentRefs = requireArrayV1(payload.model_component_refs, "MODEL_COMPONENT_REFS_REQUIRED");
  if (modelComponentRefs.length !== 4) throw new Error("MODEL_COMPONENT_REFS_CARDINALITY");
  modelComponentRefs.forEach((value) => requireStringV1(value, "MODEL_COMPONENT_REF_REQUIRED"));
  if (!modelComponentRefs.includes(dynamicsModel.model_component_ref as string)) throw new Error("DYNAMICS_MODEL_COMPONENT_REF_NOT_LISTED");
}
