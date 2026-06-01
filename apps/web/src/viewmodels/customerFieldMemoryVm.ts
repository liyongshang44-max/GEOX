import type { CustomerFieldMemoryDataScope, CustomerFieldMemoryItem, CustomerFieldMemoryResponse } from "../api/customerFieldMemory";
import { labelConfidenceHint, sanitizeCustomerText } from "../lib/customerLabels";

export type CustomerFieldMemoryEntryVm = {
  title: string;
  learnedText: string;
  summaryText: string;
  confidenceText: string;
  updatedAtText: string;
  technicalRefs: Array<{ label: string; value: string }>;
};

export type CustomerFieldMemoryVm = {
  dataScope: CustomerFieldMemoryDataScope;
  title: string;
  subtitle: string;
  statusText: string;
  generatedAtText: string;
  entries: CustomerFieldMemoryEntryVm[];
  emptyTitle: string;
  emptyDescription: string;
};

const INTERNAL_ID_PATTERN = /\b(?:act|opl|op|rec|apr|tsk|rcp|evd|acc|roi|mem|skill|trace)_[A-Za-z0-9-]{8,}\b/g;
const UUID_PATTERN = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;
const RAW_MEMORY_TITLE_MAP: Record<string, string> = {
  FIELD_RESPONSE_MEMORY: "地块响应记忆",
  DEVICE_RELIABILITY_MEMORY: "设备可靠性记忆",
  SKILL_PERFORMANCE_MEMORY: "诊断能力记忆",
  OPERATION_DECISION_MEMORY: "作业决策记忆",
  AGRONOMY_DECISION_MEMORY: "农艺决策记忆",
};

function toDateTimeText(raw: unknown): string {
  const text = String(raw ?? "").trim();
  if (!text) return "暂无更新时间";
  const ms = Date.parse(text);
  if (!Number.isFinite(ms) || ms <= 0) return "暂无更新时间";
  const date = new Date(ms);
  if (date.getUTCFullYear() <= 1970) return "暂无更新时间";
  return date.toLocaleString("zh-CN", { hour12: false });
}

function cleanCustomerMemoryText(value: unknown, fallback = "暂无摘要"): string {
  const raw = String(value ?? "").trim();
  if (!raw || raw === "--" || raw === "[object Object]") return fallback;
  const withoutIds = raw.replace(INTERNAL_ID_PATTERN, "相关作业").replace(UUID_PATTERN, "相关记录");
  if (/valve response confirmed/i.test(withoutIds)) return "系统确认设备响应已被记录，后续调度会参考该设备可靠性。";
  if (/skill.*performance/i.test(withoutIds)) return "系统记录了本次诊断能力表现，后续建议会参考该结果。";
  if (/field response/i.test(withoutIds)) return "系统记录了地块对本次作业的响应，后续处方会参考该地块表现。";
  return sanitizeCustomerText(withoutIds, fallback);
}

function readableText(value: unknown, fallback = "暂无摘要"): string {
  if (Array.isArray(value)) return value.map((item) => readableText(item, "")).filter(Boolean).join("；") || fallback;
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const candidate = obj.customer_text ?? obj.learned_text ?? obj.summary_text ?? obj.text ?? obj.title ?? obj.label;
    return candidate != null ? cleanCustomerMemoryText(candidate, fallback) : fallback;
  }
  return cleanCustomerMemoryText(value, fallback);
}

function confidenceText(item: CustomerFieldMemoryItem): string {
  if (item.confidence?.label) return sanitizeCustomerText(item.confidence.label, "可信度待补充");
  const n = typeof item.confidence?.score === "number" ? item.confidence.score : Number(item.confidence?.score ?? item.confidence_score);
  return Number.isFinite(n) ? labelConfidenceHint(n) : "可信度待补充";
}

function memoryTitle(item: CustomerFieldMemoryItem): string {
  const raw = String(item.title || item.memory_type || item.memory_code || "").trim();
  const normalized = raw.toUpperCase();
  if (RAW_MEMORY_TITLE_MAP[normalized]) return RAW_MEMORY_TITLE_MAP[normalized];
  if (/SKILL/.test(normalized)) return "诊断能力记忆";
  if (/DEVICE|VALVE|PUMP/.test(normalized)) return "设备可靠性记忆";
  if (/FIELD|RESPONSE/.test(normalized)) return "地块响应记忆";
  return cleanCustomerMemoryText(raw, "田块记忆");
}

function learnedText(item: CustomerFieldMemoryItem): string {
  return readableText(item.learned_text ?? item.customer_text ?? item.summary_text ?? item.text, "系统暂未形成可解释的学习结论");
}

function technicalRefs(item: CustomerFieldMemoryItem): Array<{ label: string; value: string }> {
  return [
    { label: "记忆类型", value: sanitizeCustomerText(item.memory_type, "--") },
    { label: "记忆代码", value: sanitizeCustomerText(item.memory_code, "--") },
    { label: "技术引用", value: sanitizeCustomerText(item.technical_ref ?? item.source_ref, "--") },
  ].filter((row) => row.value && row.value !== "--");
}

function isCustomerVisibleFormalMemory(item: CustomerFieldMemoryItem): boolean {
  const raw = item as CustomerFieldMemoryItem & Record<string, unknown>;
  if (raw.customer_visible === true || raw.customer_visible_eligible === true || raw.formal_memory === true) return true;
  const lane = String(raw.memory_lane ?? raw.lane ?? raw.visibility ?? raw.status ?? "").toUpperCase();
  if (/CUSTOMER_VISIBLE|FORMAL|ACCEPTED|PASSED/.test(lane)) return true;
  const text = `${raw.memory_type ?? ""} ${raw.memory_code ?? ""} ${raw.source_ref ?? ""}`.toUpperCase();
  if (/SIMULATED|TECHNICAL|DEV|INTERNAL|DRAFT/.test(text)) return false;
  return false;
}

function buildEntry(item: CustomerFieldMemoryItem): CustomerFieldMemoryEntryVm {
  const learned = learnedText(item);
  return {
    title: memoryTitle(item),
    learnedText: learned,
    summaryText: readableText(item.customer_text ?? item.summary_text ?? item.text, learned),
    confidenceText: confidenceText(item),
    updatedAtText: toDateTimeText(item.updated_at ?? item.generated_at),
    technicalRefs: technicalRefs(item),
  };
}

function scopeSubtitle(response: CustomerFieldMemoryResponse): string {
  if (response.dataScope === "OFFICIAL_CUSTOMER_API") return "客户授权范围内的正式田块记忆摘要。";
  if (response.dataScope === "COMPAT_MEMORY_API") return "当前只展示兼容接口返回的正式客户可见记忆。";
  if (response.dataScope === "FALLBACK_EMBEDDED_REPORT") return "当前只展示报告内嵌的正式客户可见记忆。";
  if (response.dataScope === "ERROR_EMPTY") return "田块记忆暂不可用，请稍后刷新。";
  return "暂无正式田块记忆。";
}

function statusText(response: CustomerFieldMemoryResponse): string {
  if (response.dataScope === "OFFICIAL_CUSTOMER_API") return "正式记忆";
  if (response.dataScope === "COMPAT_MEMORY_API") return "兼容接口";
  if (response.dataScope === "FALLBACK_EMBEDDED_REPORT") return "报告内嵌摘要";
  if (response.dataScope === "ERROR_EMPTY") return "暂不可用";
  return "暂无记录";
}

export function buildCustomerFieldMemoryVm(response: CustomerFieldMemoryResponse): CustomerFieldMemoryVm {
  const entries = (response.items ?? [])
    .filter(isCustomerVisibleFormalMemory)
    .map(buildEntry)
    .filter((entry) => entry.learnedText.trim().length > 0);
  return {
    dataScope: response.dataScope,
    title: "田块记忆",
    subtitle: response.message || scopeSubtitle(response),
    statusText: statusText(response),
    generatedAtText: toDateTimeText(response.generated_at),
    entries,
    emptyTitle: "暂无正式田块记忆",
    emptyDescription: "系统只会在正式验收通过后形成客户可见的田块学习结论；技术调试、模拟或内部记忆不会进入客户页。",
  };
}
