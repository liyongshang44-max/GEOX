export const STAGE1_OFFICIAL_INPUT_METRICS = [
  "soil_moisture_pct",
  "ec_ds_m",
  "fertility_index",
  "n",
  "p",
  "k",
] as const;

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
  ...STAGE1_OFFICIAL_INPUT_METRICS,
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

export type Stage1RefreshStatus = typeof STAGE1_REFRESH_SEMANTICS.status[number];
export type Stage1Freshness = typeof STAGE1_REFRESH_SEMANTICS.freshness[number];
