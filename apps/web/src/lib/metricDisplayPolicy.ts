import {
  METRIC_DISPLAY_POLICY_V1,
  type MetricDisplayPolicyItemV1,
  type TelemetryMetricNameV1,
} from "@geox/contracts";

export type SupportedMetricName = TelemetryMetricNameV1;

const METRIC_ALIASES: Readonly<Record<string, TelemetryMetricNameV1>> = Object.freeze({
  temperature: "air_temperature",
  humidity: "air_humidity",
  soil_moisture_pct: "soil_moisture",
});

function normalizeMetricName(metric: string | null | undefined): TelemetryMetricNameV1 | null {
  if (!metric) return null;
  if (metric in METRIC_DISPLAY_POLICY_V1) return metric as TelemetryMetricNameV1;
  return METRIC_ALIASES[metric] ?? null;
}

export function getMetricDisplayPolicy(metric: string | null | undefined): MetricDisplayPolicyItemV1 | null {
  const normalizedMetric = normalizeMetricName(metric);
  if (!normalizedMetric) return null;
  return METRIC_DISPLAY_POLICY_V1[normalizedMetric] ?? null;
}

export function isCustomerPrimaryMetric(metric: string | null | undefined): boolean {
  return getMetricDisplayPolicy(metric)?.display_tier === "customer_primary";
}

export function isCustomerSecondaryMetric(metric: string | null | undefined): boolean {
  return getMetricDisplayPolicy(metric)?.display_tier === "customer_secondary";
}

export function isProfessionalDetailMetric(metric: string | null | undefined): boolean {
  return getMetricDisplayPolicy(metric)?.display_tier === "professional_detail";
}

export function shouldShowMetricOnDashboard(metric: string | null | undefined): boolean {
  return getMetricDisplayPolicy(metric)?.show_on_dashboard ?? false;
}

export function shouldShowMetricOnFieldSummary(metric: string | null | undefined): boolean {
  return getMetricDisplayPolicy(metric)?.show_on_field_summary ?? false;
}

export function shouldShowMetricOnFieldDetail(metric: string | null | undefined): boolean {
  return getMetricDisplayPolicy(metric)?.show_on_field_detail ?? false;
}

export function shouldShowMetricOnDeviceDetail(metric: string | null | undefined): boolean {
  return getMetricDisplayPolicy(metric)?.show_on_device_detail ?? false;
}

export function shouldShowMetricOnExplain(metric: string | null | undefined): boolean {
  return getMetricDisplayPolicy(metric)?.show_on_explain ?? false;
}

export function getMetricDisplayLabelZh(metric: string | null | undefined): string {
  return getMetricDisplayPolicy(metric)?.display_label_zh ?? String(metric ?? "");
}

export function getMetricCanonicalUnit(metric: string | null | undefined): string {
  return getMetricDisplayPolicy(metric)?.canonical_unit ?? "";
}
