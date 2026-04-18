import {
  STAGE1_OFFICIAL_PIPELINE_AGGREGATE_FIELDS_V1,
  STAGE1_OFFICIAL_PIPELINE_CANONICAL_INPUT_METRICS_V1,
  STAGE1_OFFICIAL_SUMMARY_SOIL_METRICS_SUBSET_V1,
} from "./stage1_sensing_input_mapping_v1.js";

export const STAGE1_OFFICIAL_PIPELINE_CANONICAL_INPUT_METRICS = STAGE1_OFFICIAL_PIPELINE_CANONICAL_INPUT_METRICS_V1;

export const STAGE1_OFFICIAL_PIPELINE_AGGREGATE_FIELDS = STAGE1_OFFICIAL_PIPELINE_AGGREGATE_FIELDS_V1;

// Stage-1 customer-facing summary soil metric subset contract.
// IMPORTANT:
// - This is a display subset used by the Stage-1 customer summary payload.
// - It is NOT the Stage-1 pipeline canonical input whitelist.
// - It is NOT the complete pipeline canonical input set.
export const STAGE1_OFFICIAL_SUMMARY_SOIL_METRICS = STAGE1_OFFICIAL_SUMMARY_SOIL_METRICS_SUBSET_V1;
export type Stage1OfficialSummarySoilMetric = typeof STAGE1_OFFICIAL_SUMMARY_SOIL_METRICS[number];

export const STAGE1_OFFICIAL_SUMMARY_SOIL_METRIC_CONTRACT = {
  role: "stage1_customer_facing_summary_subset",
  usage: "customer_summary_display_only",
  semantic_boundaries: {
    equals_pipeline_input_whitelist: false,
    equals_complete_pipeline_canonical_input_set: false,
  },
  ordered_metrics: STAGE1_OFFICIAL_SUMMARY_SOIL_METRICS,
  canonical_input_to_summary_metric: {
    soil_moisture: "soil_moisture_pct",
    soil_ec: "ec_ds_m",
    canopy_temperature: null,
    air_temperature: null,
    air_humidity: null,
    water_flow_rate: null,
    water_pressure: null,
  } as const,
  note: "fertility_index/n/p/k are summary-facing soil indicators and are not Stage-1 canonical input metrics.",
} as const;

export const STAGE1_INPUT_CONTRACT_LAYERS = {
  // Layer-1 (source of truth): official telemetry/business canonical inputs for Stage-1.
  official_pipeline_input_whitelist: STAGE1_OFFICIAL_PIPELINE_CANONICAL_INPUT_METRICS,
  // Layer-2: official aggregate field layer used by pipeline aggregation.
  official_pipeline_aggregate_fields: STAGE1_OFFICIAL_PIPELINE_AGGREGATE_FIELDS,
  // Layer-3: customer-facing summary display subset for soil/nutrient metrics only.
  // This layer is intentionally separate from Stage-1 pipeline input contracts.
  official_customer_summary_soil_metrics_subset: STAGE1_OFFICIAL_SUMMARY_SOIL_METRICS,
  source_of_truth_layer: "official_pipeline_input_whitelist",
  aggregate_field_layer: "official_pipeline_aggregate_fields",
  summary_display_subset_layer: "official_customer_summary_soil_metrics_subset",
  source_of_truth_module: "stage1_sensing_input_mapping_v1",
} as const;

export const STAGE1_SUPPORTED_NON_OFFICIAL_INPUT_METRICS = [
  "soil_moisture",
  "moisture_pct",
  "ec",
  "soil_ec_ds_m",
  "salinity_ec_ds_m",
  "soil_fertility_index",
  "nitrogen",
  "phosphorus",
  "potassium",
  "soil_n",
  "soil_p",
  "soil_k",
] as const;

export const STAGE1_COMPATIBILITY_INPUT_ALIASES = {
  soil_moisture_pct: ["soil_moisture", "moisture_pct"],
  ec_ds_m: ["ec", "soil_ec_ds_m", "salinity_ec_ds_m"],
  fertility_index: ["soil_fertility_index"],
  n: ["nitrogen", "soil_n"],
  p: ["phosphorus", "soil_p"],
  k: ["potassium", "soil_k"],
} as const;

export const STAGE1_OFFICIAL_DERIVED_STATES = [
  "canopy_temperature_state",
  "evapotranspiration_risk_state",
  "sensor_quality_state",
  "irrigation_effectiveness_state",
  "leak_risk_state",
] as const;

export const STAGE1_COMPATIBILITY_DERIVED_STATES = [
  "canopy_state",
  "water_flow_state",
  "irrigation_need_state",
] as const;

export const STAGE1_CUSTOMER_SUMMARY_FIELDS = [
  "canopy_temp_status",
  "evapotranspiration_risk",
  "sensor_quality_level",
  "irrigation_effectiveness",
  "leak_risk",
] as const;

export const STAGE1_INTERNAL_SUMMARY_FIELDS = [
  ...STAGE1_CUSTOMER_SUMMARY_FIELDS,
  "sensor_quality",
  "irrigation_action_hint",
  "computed_at_ts_ms",
  "source_observed_at_ts_ms",
  "source_observation_ids_json",
  "explanation_codes_json",
  "soil_indicators_json",
  // compatibility-only retained fields (not customer whitelist)
  "irrigation_need_level",
] as const;

export const STAGE1_REFRESH_SEMANTICS = {
  status: ["ok", "fallback_stale", "no_data", "error"] as const,
  freshness: ["fresh", "stale", "unknown"] as const,
} as const;

export const STAGE1_SUMMARY_FIELD_NULLABILITY = {
  customer_facing: {
    tenant_id: false,
    project_id: true,
    group_id: true,
    field_id: false,
    freshness: false,
    confidence: true,
    canopy_temp_status: true,
    evapotranspiration_risk: true,
    sensor_quality_level: true,
    irrigation_effectiveness: true,
    leak_risk: true,
    official_soil_metrics_json: false,
    computed_at_ts_ms: true,
    updated_ts_ms: false,
  },
  internal: {
    sensor_quality: true,
    irrigation_action_hint: true,
    source_observed_at_ts_ms: true,
    source_observation_ids_json: false,
    explanation_codes_json: false,
    soil_indicators_json: false,
    irrigation_need_level: true,
  },
} as const;

export const STAGE1_SUMMARY_DISPLAY_ONLY_FIELDS = [
  "canopy_temp_status",
  "evapotranspiration_risk",
  "sensor_quality_level",
  "irrigation_effectiveness",
  "leak_risk",
] as const;

export const STAGE1_SUMMARY_INTERNAL_ONLY_FIELDS = [
  "sensor_quality",
  "irrigation_action_hint",
  "source_observed_at_ts_ms",
  "source_observation_ids_json",
  "explanation_codes_json",
  "soil_indicators_json",
  "irrigation_need_level",
] as const;

export const STAGE1_SUMMARY_CUSTOMER_FORBIDDEN_FIELDS = [
  ...STAGE1_SUMMARY_INTERNAL_ONLY_FIELDS,
  "sensing_overview",
  "fertility_state",
] as const;

export const STAGE1_OFFICIAL_SOIL_METRICS_SUMMARY_SUBSTRUCTURE = {
  container_field: "official_soil_metrics_json",
  ordered_metrics: STAGE1_OFFICIAL_SUMMARY_SOIL_METRICS,
  item_shape: {
    metric: "stage1_official_summary_soil_metric",
    value: "number|null",
    confidence: "number|null",
    observed_at_ts_ms: "number|null",
    freshness: STAGE1_REFRESH_SEMANTICS.freshness,
  },
  item_nullability: {
    metric: false,
    value: true,
    confidence: true,
    observed_at_ts_ms: true,
    freshness: false,
  },
} as const;

export const STAGE1_SUMMARY_REFRESH_CARRIAGE_SEMANTICS = {
  summary_payload_fields: {
    freshness: "Stage-1 summary freshness on payload",
    confidence: "Stage-1 summary confidence on payload",
    computed_at_ts_ms: "summary computation timestamp (nullable)",
    updated_ts_ms: "projection updated timestamp",
  },
  route_refresh_envelope: {
    stage1_refresh_fields: ["freshness", "status", "refreshed_ts_ms"] as const,
    refresh_status_semantics: STAGE1_REFRESH_SEMANTICS.status,
    refresh_freshness_semantics: STAGE1_REFRESH_SEMANTICS.freshness,
  },
} as const;

export const STAGE1_CUSTOMER_FACING_SUMMARY_CONTRACT_SHAPE = {
  required_top_level_fields: [
    "tenant_id",
    "project_id",
    "group_id",
    "field_id",
    "freshness",
    "confidence",
    ...STAGE1_CUSTOMER_SUMMARY_FIELDS,
    STAGE1_OFFICIAL_SOIL_METRICS_SUMMARY_SUBSTRUCTURE.container_field,
    "computed_at_ts_ms",
    "updated_ts_ms",
  ] as const,
  display_only_fields: STAGE1_SUMMARY_DISPLAY_ONLY_FIELDS,
  forbidden_fields: STAGE1_SUMMARY_CUSTOMER_FORBIDDEN_FIELDS,
  nullability: STAGE1_SUMMARY_FIELD_NULLABILITY.customer_facing,
  soil_metrics_substructure: STAGE1_OFFICIAL_SOIL_METRICS_SUMMARY_SUBSTRUCTURE,
  refresh_carriage: STAGE1_SUMMARY_REFRESH_CARRIAGE_SEMANTICS,
} as const;

export const STAGE1_INTERNAL_SUMMARY_CONTRACT_SHAPE = {
  customer_superset_base: STAGE1_CUSTOMER_FACING_SUMMARY_CONTRACT_SHAPE.required_top_level_fields,
  internal_only_fields: STAGE1_SUMMARY_INTERNAL_ONLY_FIELDS,
  nullability: STAGE1_SUMMARY_FIELD_NULLABILITY.internal,
} as const;

export const STAGE1_STATE_CLASSIFICATION = {
  official_decision_states: [
    "irrigation_effectiveness_state",
    "leak_risk_state",
  ] as const,
  official_diagnostic_states: [
    "canopy_temperature_state",
    "evapotranspiration_risk_state",
    "sensor_quality_state",
  ] as const,
  compatibility_only_states: STAGE1_COMPATIBILITY_DERIVED_STATES,
} as const;

export const STAGE1_DERIVED_STATE_COMPATIBILITY_ALIASES = {
  canopy_temperature_state: ["canopy_state"],
  evapotranspiration_risk_state: ["canopy_state"],
  irrigation_effectiveness_state: ["water_flow_state"],
  leak_risk_state: ["water_flow_state"],
} as const;

export const STAGE1_ALL_SENSING_INPUT_METRICS = [
  ...STAGE1_OFFICIAL_PIPELINE_CANONICAL_INPUT_METRICS,
  ...STAGE1_SUPPORTED_NON_OFFICIAL_INPUT_METRICS,
] as const;

export const STAGE1_ALL_SUPPORTED_DERIVED_STATES = [
  ...STAGE1_OFFICIAL_DERIVED_STATES,
  ...STAGE1_COMPATIBILITY_DERIVED_STATES,
] as const;

// Runtime-vs-diagnostic boundary:
// - Device runtime status (online/offline/heartbeat freshness) belongs to device_status_index_v1.
// - sensor_quality_state belongs to derived_sensing_state_index_v1 as a sensing diagnostic outcome.
// These layers may correlate but are intentionally not equivalent and must not be treated as interchangeable.
export const STAGE1_DEVICE_RUNTIME_STATUS = {
  source_table: "device_status_index_v1",
  status_examples: ["online", "offline", "unknown"] as const,
  heartbeat_fields: ["last_heartbeat_ts_ms", "heartbeat_lag_ms"] as const,
} as const;

export const STAGE1_SENSOR_QUALITY_DIAGNOSTIC_STATUS = {
  source_table: "derived_sensing_state_index_v1",
  derived_state_type: "sensor_quality_state",
  canonical_input_aliases: {
    signal_strength_dbm: ["signal_strength_dbm", "rssi_dbm", "signal_dbm"] as const,
    battery_level_pct: ["battery_level_pct", "battery_pct", "battery"] as const,
    packet_loss_rate_pct: ["packet_loss_rate_pct", "packet_loss_pct", "packet_loss_rate"] as const,
  },
  // Guardrail: heartbeat runtime status MUST NOT be used as direct sensor-quality input.
  forbidden_direct_inputs: ["last_heartbeat_ts_ms", "device_online", "is_online", "heartbeat_status"] as const,
} as const;

export const STAGE1_RUNTIME_DIAGNOSTIC_BOUNDARY = {
  device_runtime_status_layer: "device_runtime_status",
  sensing_diagnostic_layer: "sensing_diagnostic_state",
  default_equivalence_forbidden: true,
  explicit_bridge_rule_required: true,
  note: "Heartbeat online/offline is runtime status, not sensor_quality_state input by default.",
} as const;

export function isForbiddenDirectSensorQualityInputV1(field: string): boolean {
  return (STAGE1_SENSOR_QUALITY_DIAGNOSTIC_STATUS.forbidden_direct_inputs as readonly string[]).includes(String(field ?? "").trim());
}

export function isStage1OfficialPipelineCanonicalInputMetricV1(metric: string): boolean {
  return (STAGE1_OFFICIAL_PIPELINE_CANONICAL_INPUT_METRICS as readonly string[]).includes(String(metric ?? "").trim());
}

export function isStage1OfficialSummarySoilMetricV1(metric: string): boolean {
  return (STAGE1_OFFICIAL_SUMMARY_SOIL_METRICS as readonly string[]).includes(String(metric ?? "").trim());
}

export type Stage1RefreshStatus = typeof STAGE1_REFRESH_SEMANTICS.status[number];
export type Stage1Freshness = typeof STAGE1_REFRESH_SEMANTICS.freshness[number];
