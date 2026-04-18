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

export type Stage1RefreshStatus = typeof STAGE1_REFRESH_SEMANTICS.status[number];
export type Stage1Freshness = typeof STAGE1_REFRESH_SEMANTICS.freshness[number];
