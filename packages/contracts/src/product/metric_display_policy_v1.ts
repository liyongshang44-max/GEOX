import type { TelemetryMetricNameV1 } from "../schema/telemetry_metric_catalog_v1.js";

export type MetricDisplayTierV1 =
  | "customer_primary"
  | "customer_secondary"
  | "professional_detail";

export type MetricReasoningStatusV1 =
  | "PRIMARY_REASONING_INPUT"
  | "SECONDARY_REASONING_INPUT"
  | "PROFESSIONAL_ONLY"
  | "RAW_ONLY"
  | "NOT_IN_CURRENT_REASONING";

type MetricDisplayPolicyItemSourceV1 =
  | {
      source_field_key: string;
      source_field_aliases?: readonly string[];
    }
  | {
      source_field_key?: string;
      source_field_aliases: readonly string[];
    };

export type MetricDisplayPolicyItemV1 = MetricDisplayPolicyItemSourceV1 & {
  metric: TelemetryMetricNameV1;
  display_tier: MetricDisplayTierV1;
  reasoning_status: MetricReasoningStatusV1;
  display_label_zh: string;
  display_label_en: string;
  canonical_unit: string;
  show_on_dashboard: boolean;
  show_on_field_summary: boolean;
  show_on_field_detail: boolean;
  show_on_device_detail: boolean;
  show_on_explain: boolean;
  fixed_routes?: readonly string[];
  forbidden_surfaces?: readonly string[];
  customer_story_allowed?: boolean;
  notes?: string;
};

export const METRIC_DISPLAY_POLICY_V1: Readonly<Record<TelemetryMetricNameV1, MetricDisplayPolicyItemV1>> = Object.freeze({
  air_temperature: {
    metric: "air_temperature",
    display_tier: "customer_primary",
    reasoning_status: "PRIMARY_REASONING_INPUT",
    display_label_zh: "空气温度",
    display_label_en: "Air Temperature",
    canonical_unit: "°C",
    show_on_dashboard: true,
    show_on_field_summary: true,
    show_on_field_detail: true,
    show_on_device_detail: true,
    show_on_explain: true,
    source_field_key: "sensor.air_temperature",
    fixed_routes: ["dashboard.kpi", "field.summary", "field.detail", "explain.signal"],
    customer_story_allowed: true,
  },
  air_humidity: {
    metric: "air_humidity",
    display_tier: "customer_primary",
    reasoning_status: "PRIMARY_REASONING_INPUT",
    display_label_zh: "空气湿度",
    display_label_en: "Air Humidity",
    canonical_unit: "%RH",
    show_on_dashboard: true,
    show_on_field_summary: true,
    show_on_field_detail: true,
    show_on_device_detail: true,
    show_on_explain: true,
    source_field_key: "sensor.air_humidity",
    fixed_routes: ["dashboard.kpi", "field.summary", "field.detail", "explain.signal"],
    customer_story_allowed: true,
  },
  soil_moisture: {
    metric: "soil_moisture",
    display_tier: "customer_secondary",
    reasoning_status: "SECONDARY_REASONING_INPUT",
    display_label_zh: "土壤水分",
    display_label_en: "Soil Moisture",
    canonical_unit: "%VWC",
    show_on_dashboard: true,
    show_on_field_summary: true,
    show_on_field_detail: true,
    show_on_device_detail: true,
    show_on_explain: true,
    source_field_key: "sensor.soil_moisture",
    source_field_aliases: ["soil.vwc", "soil.moisture"],
    fixed_routes: ["field.soil_status", "field.trend", "explain.evidence_basis"],
    customer_story_allowed: true,
    notes: "冻结策略：客户二级展示 + 二级推理输入。",
  },
  light_lux: {
    metric: "light_lux",
    display_tier: "professional_detail",
    reasoning_status: "NOT_IN_CURRENT_REASONING",
    display_label_zh: "光照强度",
    display_label_en: "Light Intensity",
    canonical_unit: "lux",
    show_on_dashboard: false,
    show_on_field_summary: false,
    show_on_field_detail: true,
    show_on_device_detail: true,
    show_on_explain: false,
    source_field_key: "sensor.light_lux",
    forbidden_surfaces: ["dashboard.kpi", "customer.story"],
    customer_story_allowed: false,
  },
  soil_ec: {
    metric: "soil_ec",
    display_tier: "professional_detail",
    reasoning_status: "SECONDARY_REASONING_INPUT",
    display_label_zh: "土壤电导率",
    display_label_en: "Soil EC",
    canonical_unit: "dS/m",
    show_on_dashboard: false,
    show_on_field_summary: false,
    show_on_field_detail: true,
    show_on_device_detail: true,
    show_on_explain: true,
    source_field_key: "sensor.soil_ec",
    source_field_aliases: ["soil.ec", "soil.conductivity"],
    fixed_routes: ["field.detail.professional", "explain.evidence_basis"],
    customer_story_allowed: false,
    notes: "冻结策略：专业明细展示 + 二级推理输入。",
  },
  soil_ph: {
    metric: "soil_ph",
    display_tier: "professional_detail",
    reasoning_status: "NOT_IN_CURRENT_REASONING",
    display_label_zh: "土壤 pH",
    display_label_en: "Soil pH",
    canonical_unit: "pH",
    show_on_dashboard: false,
    show_on_field_summary: false,
    show_on_field_detail: true,
    show_on_device_detail: true,
    show_on_explain: false,
    source_field_key: "sensor.soil_ph",
    customer_story_allowed: false,
    forbidden_surfaces: ["dashboard.kpi", "customer.story", "explain.reasoning"],
    notes: "冻结策略：专业明细展示 + 不参与当前推理。",
  },
  soil_temperature: {
    metric: "soil_temperature",
    display_tier: "professional_detail",
    reasoning_status: "NOT_IN_CURRENT_REASONING",
    display_label_zh: "土壤温度",
    display_label_en: "Soil Temperature",
    canonical_unit: "°C",
    show_on_dashboard: false,
    show_on_field_summary: false,
    show_on_field_detail: true,
    show_on_device_detail: true,
    show_on_explain: false,
    source_field_key: "sensor.soil_temperature",
    customer_story_allowed: false,
    forbidden_surfaces: ["dashboard.kpi", "customer.story", "explain.reasoning"],
    notes: "冻结策略：专业明细展示 + 不参与当前推理。",
  },
  canopy_temperature: {
    metric: "canopy_temperature",
    display_tier: "customer_secondary",
    reasoning_status: "SECONDARY_REASONING_INPUT",
    display_label_zh: "冠层温度",
    display_label_en: "Canopy Temperature",
    canonical_unit: "°C",
    show_on_dashboard: true,
    show_on_field_summary: true,
    show_on_field_detail: true,
    show_on_device_detail: true,
    show_on_explain: true,
    source_field_key: "sensor.canopy_temperature",
    fixed_routes: ["field.trend", "explain.evidence_basis"],
    customer_story_allowed: true,
  },
  soil_salinity_index: {
    metric: "soil_salinity_index",
    display_tier: "professional_detail",
    reasoning_status: "NOT_IN_CURRENT_REASONING",
    display_label_zh: "土壤盐渍指数",
    display_label_en: "Soil Salinity Index",
    canonical_unit: "index",
    show_on_dashboard: false,
    show_on_field_summary: false,
    show_on_field_detail: true,
    show_on_device_detail: true,
    show_on_explain: false,
    source_field_key: "sensor.soil_salinity_index",
    source_field_aliases: ["soil.ssi", "soil.salinity_index"],
    customer_story_allowed: false,
    forbidden_surfaces: ["dashboard.kpi", "customer.story", "explain.reasoning"],
    notes: "冻结策略：专业明细展示 + 不参与当前推理。",
  },
  water_flow_rate: {
    metric: "water_flow_rate",
    display_tier: "customer_primary",
    reasoning_status: "PRIMARY_REASONING_INPUT",
    display_label_zh: "水流量",
    display_label_en: "Water Flow Rate",
    canonical_unit: "L/min",
    show_on_dashboard: true,
    show_on_field_summary: true,
    show_on_field_detail: true,
    show_on_device_detail: true,
    show_on_explain: true,
    source_field_key: "sensor.water_flow_rate",
    fixed_routes: ["dashboard.irrigation", "field.summary", "explain.signal"],
    customer_story_allowed: true,
  },
  water_pressure: {
    metric: "water_pressure",
    display_tier: "customer_secondary",
    reasoning_status: "SECONDARY_REASONING_INPUT",
    display_label_zh: "水压",
    display_label_en: "Water Pressure",
    canonical_unit: "kPa",
    show_on_dashboard: true,
    show_on_field_summary: true,
    show_on_field_detail: true,
    show_on_device_detail: true,
    show_on_explain: true,
    source_field_key: "sensor.water_pressure",
    source_field_aliases: ["water.pressure", "irrigation.pressure"],
    fixed_routes: ["dashboard.irrigation", "field.detail", "explain.evidence_basis"],
    customer_story_allowed: true,
  },
});
