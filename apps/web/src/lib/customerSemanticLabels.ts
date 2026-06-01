import { customerFormalChainText, customerNeedsReviewText, customerOperationStateText, customerReasonText, customerSafeName, isUnsafeCustomerText, mapCustomerEnum } from "./customerSafeText";
import { customerStatusLabel, labelCustomerChainIntegrity, labelCustomerCropContextStatus, labelCustomerObservabilityStatus } from "./customerStatusLabels";

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

function normalize(raw: unknown): string {
  return String(raw ?? "").trim();
}

function normalizeKey(raw: unknown): string {
  return normalize(raw).replace(/[\s/-]+/g, "_").toUpperCase();
}

function isBlankText(raw: string): boolean {
  return !raw || raw === "--" || raw === "[object Object]" || raw.toLowerCase() === "null" || raw.toLowerCase() === "undefined";
}

export function customerSemanticLabel(raw: unknown, fallback = "暂无记录"): string {
  const text = normalize(raw);
  if (isBlankText(text)) return fallback;
  const key = normalizeKey(text);
  if (key === "TRUE" || key === "FALSE") return customerNeedsReviewText(text);
  if (key === "PENDING_ACCEPTANCE_REQUIRES_FORMAL_REVIEW" || key === "SOIL_MOISTURE_BELOW_THRESHOLD" || key === "NO_RAIN_FORECAST") return customerReasonText(text);
  if (key === "PENDING_ACCEPTANCE" || key === "BLOCKED") return customerOperationStateText(text);
  const statusText = customerStatusLabel(text, "generic", "");
  const mapped = statusText || mapCustomerEnum(text, "generic");
  if (isUnsafeCustomerText(raw)) return mapped && mapped !== text ? mapped : fallback;
  return mapped || fallback;
}

export function customerDisplayName(raw: unknown, fallback: string): string {
  return customerSafeName(raw, fallback);
}

export function customerCropLabel(raw: unknown, fallback = "作物待确认"): string {
  return customerSemanticLabel(raw, fallback);
}

export function customerStageLabel(raw: unknown, fallback = "阶段待确认"): string {
  const text = labelCustomerCropContextStatus(raw);
  return text === "未确认" ? customerSemanticLabel(raw, fallback) : text;
}

export function customerSourceLabel(raw: unknown, fallback = "暂无数据来源"): string {
  const text = normalize(raw);
  if (isBlankText(text)) return fallback;
  if (text.toLowerCase().includes("weather_unavailable")) return "天气源暂不可用";
  if (text.toLowerCase().startsWith("weather")) return "天气数据源";
  const key = normalizeKey(text);
  if (SOURCE_LABELS[text]) return SOURCE_LABELS[text];
  if (SOURCE_LABELS[key]) return SOURCE_LABELS[key];
  if (text.toLowerCase().endsWith("_v1") || text.toLowerCase().startsWith("ao_act_")) return "系统记录摘要";
  return customerSemanticLabel(text, fallback);
}

export function customerChainIntegrityLabel(raw: unknown, fallback = "链路状态待确认"): string {
  const key = normalizeKey(raw);
  if (!key) return fallback;
  return customerFormalChainText(key);
}

export function customerObservabilityLabel(raw: unknown, fallback = "观测状态待确认"): string {
  const text = labelCustomerObservabilityStatus(raw);
  return text === "未确认" ? customerSemanticLabel(raw, fallback) : text;
}

export function isCustomerChainComplete(raw: unknown): boolean {
  return normalizeKey(raw) === "COMPLETE";
}

export function customerMissingInputsText(raw: unknown): string {
  if (!Array.isArray(raw) || raw.length === 0) return "无";
  return raw.map((item) => customerSemanticLabel(item, "待补充输入")).filter(Boolean).join("、") || "无";
}
