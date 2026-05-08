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

function toDateTimeText(raw: unknown): string {
  const text = String(raw ?? "").trim();
  if (!text) return "暂无更新时间";
  const ms = Date.parse(text);
  if (!Number.isFinite(ms) || ms <= 0) return "暂无更新时间";
  const date = new Date(ms);
  if (date.getUTCFullYear() <= 1970) return "暂无更新时间";
  return date.toLocaleString("zh-CN", { hour12: false });
}

function readableText(value: unknown, fallback = "暂无摘要"): string {
  if (Array.isArray(value)) return value.map((item) => readableText(item, "")).filter(Boolean).join("；") || fallback;
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const candidate = obj.customer_text ?? obj.learned_text ?? obj.summary_text ?? obj.text ?? obj.title ?? obj.label;
    return candidate != null ? sanitizeCustomerText(candidate, fallback) : fallback;
  }
  return sanitizeCustomerText(value, fallback);
}

function confidenceText(item: CustomerFieldMemoryItem): string {
  if (item.confidence?.label) return sanitizeCustomerText(item.confidence.label, "可信度待补充");
  const n = typeof item.confidence?.score === "number" ? item.confidence.score : Number(item.confidence?.score ?? item.confidence_score);
  return Number.isFinite(n) ? labelConfidenceHint(n) : "可信度待补充";
}

function memoryTitle(item: CustomerFieldMemoryItem): string {
  return sanitizeCustomerText(item.title || item.memory_type || item.memory_code, "田块记忆");
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
  if (response.dataScope === "OFFICIAL_CUSTOMER_API") return "客户授权范围内的田块记忆摘要。";
  if (response.dataScope === "COMPAT_MEMORY_API") return "当前展示兼容记忆接口返回的客户可读摘要。";
  if (response.dataScope === "FALLBACK_EMBEDDED_REPORT") return "当前展示报告内嵌田块记忆摘要。";
  if (response.dataScope === "ERROR_EMPTY") return "田块记忆暂不可用，请稍后刷新。";
  return "暂无田块记忆。";
}

function statusText(response: CustomerFieldMemoryResponse): string {
  if (response.dataScope === "OFFICIAL_CUSTOMER_API") return "正式记忆";
  if (response.dataScope === "COMPAT_MEMORY_API") return "兼容接口";
  if (response.dataScope === "FALLBACK_EMBEDDED_REPORT") return "报告内嵌摘要";
  if (response.dataScope === "ERROR_EMPTY") return "暂不可用";
  return "暂无记录";
}

export function buildCustomerFieldMemoryVm(response: CustomerFieldMemoryResponse): CustomerFieldMemoryVm {
  const entries = (response.items ?? []).map(buildEntry).filter((entry) => entry.learnedText.trim().length > 0);
  return {
    dataScope: response.dataScope,
    title: "田块记忆",
    subtitle: response.message || scopeSubtitle(response),
    statusText: statusText(response),
    generatedAtText: toDateTimeText(response.generated_at),
    entries,
    emptyTitle: "暂无田块记忆",
    emptyDescription: "当前系统还没有形成可复用的地块响应、设备可靠性或技能表现记忆。",
  };
}
