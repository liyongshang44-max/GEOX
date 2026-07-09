// apps/server/src/domain/twin_runtime/runtime_config_v1.ts
// Purpose: define the immutable MCFT-CAP-01 Runtime Config semantic payload and frozen bootstrap model configuration.
// Boundary: pure types and constants only; no artifact reads, database access, clock, random values, or network.

export const MCFT_CAP_01_EXPECTED_AUTHORITY_V1 = {
  binding_id: "mcft_rb_bf1da664164a4fedda249bcb",
  reality_binding_hash: "sha256:bf1da664164a4fedda249bcb0e330c1af2083173a52bd704f01eac3ad277ba4f",
  source_matrix_hash: "sha256:c5187c23be0d058ffa23d464ae1139f924f5af064a270248746fbabde4c3e51b",
  configuration_matrix_hash: "sha256:381ef166454c7b698c6641fadc5d08019fecff127e9529a4c58a1f09d9e1fef5",
  geometry_semantic_hash: "sha256:d3dbc5495485e7af68acdc4b32e6061c2ea99772835be2805ae706b74d75ca51",
  soil_hydraulic_binding_id: "soil_hydraulic_config_c8_v1",
  crop_water_use_binding_id: "crop_water_use_config_c8_v1",
} as const;

export const MCFT_CAP_01_BOOTSTRAP_MODEL_CONFIG_V1 = {
  model_component_id: "mcft_static_gaussian_bootstrap_water_state_v1",
  prior_rule_id: "MIDPOINT_WILTING_FIELD_CAPACITY_WEAK_PRIOR_V1",
  observation_operator_id: "POINT_200MM_TO_ROOT_ZONE_MEAN_H1_WITH_REPRESENTATIVENESS_V1",
  assimilation_method_id: "SCALAR_GAUSSIAN_ASSIMILATION_V1",
  uncertainty_method_id: "GAUSSIAN_APPROXIMATION_95_INTERVAL_V1",
  observation_selector_id: "LATEST_USABLE_OBSERVATION_BEFORE_TICK_V1",
  numeric_output_decimals: 6,
  rounding_rule: "DECIMAL_HALF_AWAY_FROM_ZERO_V1",
  sensor_measurement_stddev_fraction: 0.02,
  point_to_zone_representativeness_stddev_fraction: 0.06,
  quality_weights: { PASS: 1, LIMITED: 0.5, FAIL: 0 },
  evidence_classification_version: "ROLE_SPECIFIC_AVAILABILITY_CLASSIFICATION_V1",
  forecast_prerequisite_policy_version: "MCFT_CAP_01_BLOCKED_PREREQUISITES_V1",
  truth_class: "CONTROLLED_SYNTHETIC",
  calibration_status: "NOT_FIELD_CALIBRATED",
} as const;

export type RuntimeConfigSemanticPayloadV1 = {
  reality_binding_ref: string; reality_binding_hash: string;
  source_matrix_ref: string; source_matrix_hash: string;
  configuration_matrix_ref: string; configuration_matrix_hash: string;
  geometry_semantic_hash: string;
  root_zone_definition: Record<string, unknown>;
  configuration_binding_refs: string[];
  soil_hydraulic_configuration_refs: string[];
  crop_water_use_configuration_refs: string[];
  source_binding_refs: string[];
  replay_release_policy_id: string;
  tick_duration: "PT1H";
  evidence_window_rule: "OPEN_START_CLOSED_END_PT1H_V1";
  bootstrap_model_config: typeof MCFT_CAP_01_BOOTSTRAP_MODEL_CONFIG_V1;
  object_schema_versions: Record<string, string>;
};
