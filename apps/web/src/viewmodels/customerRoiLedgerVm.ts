import type { CustomerRoiLedgerDataScope, CustomerRoiLedgerItem, CustomerRoiLedgerResponse } from "../api/customerRoiLedger";
import { labelConfidenceHint, labelValueType, sanitizeCustomerText } from "../lib/customerLabels";

export type CustomerRoiLedgerRowVm = {
  title: string;
  valueText: string;
  natureText: "实测" | "估算" | "假设";
  methodText: string;
  evidenceText: string;
  confidenceText: string;
  generatedAtText: string;
};

export type CustomerRoiLedgerVm = {
  dataScope: CustomerRoiLedgerDataScope;
  title: string;
  subtitle: string;
  statusText: string;
  generatedAtText: string;
  rows: CustomerRoiLedgerRowVm[];
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

function toNum(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function hasText(value: unknown): boolean {
  return String(value ?? "").trim().length > 0;
}

function valueText(item: CustomerRoiLedgerItem): string {
  const n = toNum(item.delta_value);
  if (n == null) return "暂无可量化数值";
  const unit = sanitizeCustomerText(item.unit, "");
  return `${n}${unit}`;
}

function evidenceText(item: CustomerRoiLedgerItem): string {
  return sanitizeCustomerText(item.customer_text || item.evidence_text, "暂无证据说明");
}

function confidenceScore(item: CustomerRoiLedgerItem): number | null {
  return toNum(item.confidence?.score ?? item.confidence_score);
}

function hasConfidence(item: CustomerRoiLedgerItem): boolean {
  return confidenceScore(item) != null || hasText(item.confidence?.label);
}

function isAssumption(item: CustomerRoiLedgerItem): boolean {
  const raw = `${item.value_type ?? ""} ${item.value_kind ?? ""} ${item.calculation_method ?? ""}`.toLowerCase();
  return raw.includes("assumption") || raw.includes("假设");
}

function natureText(item: CustomerRoiLedgerItem): "实测" | "估算" | "假设" {
  if (isAssumption(item)) return "假设";
  const hasBaseline = toNum(item.baseline_value) != null;
  const hasEvidence = hasText(item.customer_text) || hasText(item.evidence_text);
  if (hasBaseline && hasEvidence && hasConfidence(item)) return "实测";
  return "估算";
}

function confidenceText(item: CustomerRoiLedgerItem): string {
  if (hasText(item.confidence?.label)) return sanitizeCustomerText(item.confidence?.label, "可信度待补充");
  const score = confidenceScore(item);
  if (score == null) return "可信度待补充";
  return labelConfidenceHint(score);
}

function buildRow(item: CustomerRoiLedgerItem): CustomerRoiLedgerRowVm {
  const typeText = labelValueType(item.value_type ?? item.value_kind ?? item.metric_name);
  return {
    title: sanitizeCustomerText(item.title || item.metric_name || typeText, "价值记录"),
    valueText: valueText(item),
    natureText: natureText(item),
    methodText: sanitizeCustomerText(item.calculation_method, "计算方法待补充"),
    evidenceText: evidenceText(item),
    confidenceText: confidenceText(item),
    generatedAtText: toDateTimeText(item.generated_at ?? item.updated_at),
  };
}

function scopeSubtitle(response: CustomerRoiLedgerResponse): string {
  if (response.dataScope === "OFFICIAL_CUSTOMER_API") return "客户 ROI 账本只读明细。";
  if (response.dataScope === "FALLBACK_EMBEDDED_REPORT") return "当前展示报告内嵌价值摘要，非完整 ROI 账本。";
  if (response.dataScope === "ERROR_EMPTY") return "价值记录暂不可用，请稍后刷新。";
  return "暂无可量化价值记录。";
}

function statusText(response: CustomerRoiLedgerResponse): string {
  if (response.dataScope === "OFFICIAL_CUSTOMER_API") return "正式账本";
  if (response.dataScope === "FALLBACK_EMBEDDED_REPORT") return "报告内嵌摘要";
  if (response.dataScope === "ERROR_EMPTY") return "暂不可用";
  return "暂无记录";
}

export function buildCustomerRoiLedgerVm(response: CustomerRoiLedgerResponse): CustomerRoiLedgerVm {
  const rows = (response.items ?? []).map(buildRow);
  return {
    dataScope: response.dataScope,
    title: "价值记录明细",
    subtitle: response.message || scopeSubtitle(response),
    statusText: statusText(response),
    generatedAtText: toDateTimeText(response.generated_at),
    rows,
    emptyTitle: "暂无可量化价值记录",
    emptyDescription: "当前未形成可审计的节水、节工、预警或验收价值明细。",
  };
}
