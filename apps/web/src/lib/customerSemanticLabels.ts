import { customerSafeName, isUnsafeCustomerText, mapCustomerEnum } from "./customerSafeText";

const SOURCE_LABELS: Record<string, string> = {
  operation_report_v1: "作业报告摘要",
  customer_report_v1: "客户报告摘要",
  field_report_v1: "地块报告摘要",
  operation_plan_v1: "作业计划记录",
  ao_act_task_v0: "执行任务记录",
  ao_act_receipt_v0: "执行回执记录",
  approval_request_v1: "审批记录",
  roi_ledger_v1: "价值记录",
  field_memory_v1: "田块记忆记录",
  remote_sensing: "遥感观测",
  machinery: "农机作业记录",
  telemetry: "设备监测数据",
  sensor: "传感器监测数据",
  weather: "天气数据源",
  USER_DECLARED: "人工声明",
  SYSTEM_INFERRED: "系统推断",
  SENSOR_INFERRED: "监测推断",
};

const CHAIN_INTEGRITY_LABELS: Record<string, string> = {
  COMPLETE: "完整",
  PARTIAL: "链路不完整",
  LEGACY_OR_MANUAL: "历史/人工链路",
  MISSING: "链路记录不足",
};

function normalize(raw: unknown): string {
  return String(raw ?? "").trim();
}

function normalizeKey(raw: unknown): string {
  return normalize(raw).replace(/[\s-]+/g, "_").toUpperCase();
}

function isBlankText(raw: string): boolean {
  return !raw || raw === "--" || raw === "[object Object]" || raw.toLowerCase() === "null" || raw.toLowerCase() === "undefined";
}

export function customerSemanticLabel(raw: unknown, fallback = "暂无记录"): string {
  if (isUnsafeCustomerText(raw)) return fallback;
  const text = normalize(raw);
  if (isBlankText(text)) return fallback;
  return mapCustomerEnum(text, "generic") || fallback;
}

export function customerDisplayName(raw: unknown, fallback: string): string {
  return customerSafeName(raw, fallback);
}

export function customerCropLabel(raw: unknown, fallback = "作物待确认"): string {
  return customerSemanticLabel(raw, fallback);
}

export function customerStageLabel(raw: unknown, fallback = "阶段待确认"): string {
  return customerSemanticLabel(raw, fallback);
}

export function customerSourceLabel(raw: unknown, fallback = "暂无数据来源"): string {
  const text = normalize(raw);
  if (isBlankText(text)) return fallback;
  if (/weather_unavailable/i.test(text)) return "天气源暂不可用";
  if (/^weather/i.test(text)) return "天气数据源";
  const key = normalizeKey(text);
  if (SOURCE_LABELS[text]) return SOURCE_LABELS[text];
  if (SOURCE_LABELS[key]) return SOURCE_LABELS[key];
  if (/_v\d+$/i.test(text) || /^ao_act_/i.test(text)) return "系统记录摘要";
  return customerSemanticLabel(text, fallback);
}

export function customerChainIntegrityLabel(raw: unknown, fallback = "链路状态待确认"): string {
  const key = normalizeKey(raw);
  if (!key) return fallback;
  return CHAIN_INTEGRITY_LABELS[key] ?? customerSemanticLabel(raw, fallback);
}

export function isCustomerChainComplete(raw: unknown): boolean {
  return normalizeKey(raw) === "COMPLETE";
}

export function customerMissingInputsText(raw: unknown): string {
  if (!Array.isArray(raw) || raw.length === 0) return "无";
  return raw.map((item) => customerSemanticLabel(item, "待补充输入")).filter(Boolean).join("、") || "无";
}
