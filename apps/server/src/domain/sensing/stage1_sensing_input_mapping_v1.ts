import type { TelemetryMetricNameV1 } from "@geox/contracts";

const STAGE1_SENSING_INPUT_MAPPING_V1_INTERNAL = {
  soil_moisture: {
    metric: "soil_moisture",
    observation_canonical_fields: ["soil_moisture", "soil_moisture_pct"],
    pipeline_aggregate_fields: ["soil_moisture_pct"],
    downstream_derived_states: ["fertility_state", "salinity_risk_state"],
    enters_customer_summary: false,
    internal_summary_only: true,
  },
  canopy_temperature: {
    metric: "canopy_temperature",
    observation_canonical_fields: ["canopy_temperature", "canopy_temp_c", "canopy_temp", "temperature_c"],
    pipeline_aggregate_fields: ["canopy_temp_c"],
    downstream_derived_states: ["fertility_state", "salinity_risk_state", "canopy_temperature_state", "evapotranspiration_risk_state"],
    enters_customer_summary: true,
    internal_summary_only: false,
  },
  soil_ec: {
    metric: "soil_ec",
    observation_canonical_fields: ["soil_ec", "ec_ds_m", "soil_ec_ds_m"],
    pipeline_aggregate_fields: ["ec_ds_m"],
    downstream_derived_states: ["fertility_state", "salinity_risk_state"],
    enters_customer_summary: false,
    internal_summary_only: true,
  },
  air_temperature: {
    metric: "air_temperature",
    observation_canonical_fields: ["air_temperature", "ambient_temp_c", "air_temp_c", "ambient_temperature_c"],
    pipeline_aggregate_fields: ["ambient_temp_c"],
    downstream_derived_states: ["canopy_temperature_state", "evapotranspiration_risk_state"],
    enters_customer_summary: true,
    internal_summary_only: false,
  },
  air_humidity: {
    metric: "air_humidity",
    observation_canonical_fields: ["air_humidity", "relative_humidity_pct", "humidity_pct", "rh_pct"],
    pipeline_aggregate_fields: ["relative_humidity_pct"],
    downstream_derived_states: ["canopy_temperature_state", "evapotranspiration_risk_state"],
    enters_customer_summary: true,
    internal_summary_only: false,
  },
  water_flow_rate: {
    metric: "water_flow_rate",
    observation_canonical_fields: ["water_flow_rate", "inlet_flow_lpm", "inlet_lpm"],
    pipeline_aggregate_fields: ["inlet_flow_lpm"],
    downstream_derived_states: ["irrigation_effectiveness_state", "leak_risk_state"],
    enters_customer_summary: true,
    internal_summary_only: false,
  },
  water_pressure: {
    metric: "water_pressure",
    observation_canonical_fields: ["water_pressure", "pressure_drop_kpa", "pressure_kpa"],
    pipeline_aggregate_fields: ["pressure_drop_kpa"],
    downstream_derived_states: ["irrigation_effectiveness_state", "leak_risk_state"],
    enters_customer_summary: true,
    internal_summary_only: false,
  },
} as const;

export type Stage1OfficialCanonicalInputMetricV1 = keyof typeof STAGE1_SENSING_INPUT_MAPPING_V1_INTERNAL;

export type Stage1SensingInputMappingEntryV1 = {
  metric: Stage1OfficialCanonicalInputMetricV1;
  observation_canonical_fields: readonly string[];
  pipeline_aggregate_fields: readonly string[];
  downstream_derived_states: readonly string[];
  enters_customer_summary: boolean;
  internal_summary_only: boolean;
};

export const STAGE1_SENSING_INPUT_MAPPING_V1: Readonly<Record<Stage1OfficialCanonicalInputMetricV1, Stage1SensingInputMappingEntryV1>> =
  STAGE1_SENSING_INPUT_MAPPING_V1_INTERNAL;

// Layer-1 source of truth: Stage-1 official telemetry/business canonical inputs.
export const STAGE1_PIPELINE_INPUT_WHITELIST_METRICS_V1 = Object.freeze(
  Object.keys(STAGE1_SENSING_INPUT_MAPPING_V1) as Stage1OfficialCanonicalInputMetricV1[]
);

// Layer-2: official pipeline aggregate fields used by Stage-1 aggregations.
export const STAGE1_PIPELINE_AGGREGATE_LAYER_FIELDS_V1 = Object.freeze(
  Array.from(new Set(Object.values(STAGE1_SENSING_INPUT_MAPPING_V1).flatMap((entry) => entry.pipeline_aggregate_fields)))
);

// Layer-3: official summary soil metrics subset displayed in customer summary.
export const STAGE1_CUSTOMER_SUMMARY_SOIL_METRIC_SUBSET_V1 = [
  "soil_moisture_pct",
  "ec_ds_m",
  "fertility_index",
  "n",
  "p",
  "k",
] as const;

export function isStage1OfficialPipelineCanonicalInputMetricV1(metric: string): metric is Stage1OfficialCanonicalInputMetricV1 {
  return Object.prototype.hasOwnProperty.call(STAGE1_SENSING_INPUT_MAPPING_V1, metric);
}

export function getStage1SensingInputMappingEntryV1(metric: string): Stage1SensingInputMappingEntryV1 | null {
  if (!isStage1OfficialPipelineCanonicalInputMetricV1(metric)) return null;
  return STAGE1_SENSING_INPUT_MAPPING_V1[metric];
}

export function mapStage1ObservationMetricToPipelineObservationV1(metric: string, value_num: number, device_id: string): Record<string, unknown> {
  const observation: Record<string, unknown> = { device_id, [metric]: value_num };
  const entry = getStage1SensingInputMappingEntryV1(metric);
  if (!entry) return observation;
  for (const field of entry.observation_canonical_fields) {
    observation[field] = value_num;
  }
  return observation;
}

export function isStage1OfficialTelemetryMetricV1(metric: string): metric is Stage1OfficialCanonicalInputMetricV1 & TelemetryMetricNameV1 {
  return isStage1OfficialPipelineCanonicalInputMetricV1(metric);
}
