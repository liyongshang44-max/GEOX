import {
  getMetricDisplayLabelZh,
  shouldShowMetricOnDeviceDetail,
  getMetricDisplayPolicy,
} from "../lib/metricDisplayPolicy";
import { resolveSourceMeta, type SourceMeta } from "../lib/dataOrigin";

export type DeviceSeriesPoint = {
  ts_ms: number;
  value_num: number | null;
  value_text: string | null;
  fact_id?: string;
};

export type DevicePolicyAwareMetric = {
  metric: string;
  display_label_zh: string;
  value: string;
  canonical_unit: string;
  reasoning_status: string;
  source: "latest" | "metrics" | "series";
  source_kind: SourceMeta["source_kind"];
  source_type: SourceMeta["source_type"];
  data_origin: SourceMeta["data_origin"];
};

function metricKeyOf(input: any): string {
  return String(input?.metric ?? input?.metric_key ?? input?.name ?? "").trim();
}

function toDisplayValue(valueNum: unknown, valueText: unknown): string {
  if (typeof valueNum === "number" && Number.isFinite(valueNum)) return String(valueNum);
  if (typeof valueText === "string" && valueText.trim()) return valueText;
  return "-";
}

function fromLatest(latest: any[]): Map<string, DevicePolicyAwareMetric> {
  const out = new Map<string, DevicePolicyAwareMetric>();
  for (const item of latest) {
    const metric = metricKeyOf(item);
    if (!metric) continue;
    const policy = getMetricDisplayPolicy(metric);
    if (!policy) continue; // policy 存在性校验
    if (!shouldShowMetricOnDeviceDetail(metric)) continue;
    out.set(metric, {
      metric,
      display_label_zh: getMetricDisplayLabelZh(metric),
      value: toDisplayValue(item?.value_num ?? item?.value, item?.value_text),
      canonical_unit: policy.canonical_unit,
      reasoning_status: policy.reasoning_status,
      source: "latest",
      ...resolveSourceMeta(item, { source_kind: "device_observation", source_type: "device_observation", data_origin: "device_observation" }),
    });
  }
  return out;
}

function fromMetrics(metrics: any[], existing: Map<string, DevicePolicyAwareMetric>): void {
  for (const item of metrics) {
    const metric = metricKeyOf(item);
    if (!metric || existing.has(metric)) continue;
    const policy = getMetricDisplayPolicy(metric);
    if (!policy) continue;
    if (!shouldShowMetricOnDeviceDetail(metric)) continue;
    existing.set(metric, {
      metric,
      display_label_zh: getMetricDisplayLabelZh(metric),
      value: toDisplayValue(item?.value_num ?? item?.latest_value ?? item?.value, item?.value_text),
      canonical_unit: policy.canonical_unit,
      reasoning_status: policy.reasoning_status,
      source: "metrics",
      ...resolveSourceMeta(item, { source_kind: "derived_state", source_type: "derived_state", data_origin: "derived_state" }),
    });
  }
}

function fromSeries(
  series: Record<string, DeviceSeriesPoint[]>,
  existing: Map<string, DevicePolicyAwareMetric>,
): void {
  for (const [rawMetric, points] of Object.entries(series || {})) {
    if (!rawMetric || existing.has(rawMetric)) continue;
    const policy = getMetricDisplayPolicy(rawMetric);
    if (!policy) continue;
    if (!shouldShowMetricOnDeviceDetail(rawMetric)) continue;
    const sorted = Array.isArray(points)
      ? points.slice().sort((a, b) => Number(b?.ts_ms ?? 0) - Number(a?.ts_ms ?? 0))
      : [];
    const latestPoint = sorted[0];
    existing.set(rawMetric, {
      metric: rawMetric,
      display_label_zh: getMetricDisplayLabelZh(rawMetric),
      value: toDisplayValue(latestPoint?.value_num, latestPoint?.value_text),
      canonical_unit: policy.canonical_unit,
      reasoning_status: policy.reasoning_status,
      source: "series",
      ...resolveSourceMeta(latestPoint, { source_kind: "device_observation", source_type: "device_observation", data_origin: "device_observation" }),
    });
  }
}

export function buildDevicePolicyAwareMetrics(params: {
  latest: any[];
  metrics: any[];
  series: Record<string, DeviceSeriesPoint[]>;
}): DevicePolicyAwareMetric[] {
  const mapped = fromLatest(params.latest);
  fromMetrics(params.metrics, mapped);
  fromSeries(params.series, mapped);
  return Array.from(mapped.values()).sort((a, b) => a.display_label_zh.localeCompare(b.display_label_zh, "zh-CN"));
}
