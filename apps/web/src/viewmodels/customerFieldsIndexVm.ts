import type { CustomerFieldsListResponse, CustomerFieldListItem, CustomerFieldRiskLevel, CustomerDataScope } from "../api/customerFields";
import { labelRiskLevel, sanitizeCustomerText } from "../lib/customerLabels";
import { getCustomerEmptyState } from "../lib/customerEmptyStates";

export type CustomerFieldRiskFilter = "ALL" | "HIGH" | "MEDIUM" | "LOW";

export type CustomerFieldsIndexCardVm = {
  fieldId: string;
  fieldName: string;
  riskLevel: CustomerFieldRiskFilter | "UNKNOWN";
  riskLabel: string;
  riskTone: "danger" | "warning" | "neutral";
  reasons: string[];
  updatedAtText: string;
  cropStageText: string;
  recentOperationText: string;
  summaryText: string;
  href: string;
};

export type CustomerFieldsIndexVm = {
  title: string;
  subtitle: string;
  generatedAtText: string;
  dataScope: CustomerDataScope;
  isFallback: boolean;
  isPreview: boolean;
  scopeBadgeText: string;
  dataScopeNote?: string;
  filters: Array<{ key: CustomerFieldRiskFilter; label: string; count: number }>;
  cards: CustomerFieldsIndexCardVm[];
  emptyState: { title: string; description: string; severity: "neutral" | "info" | "warning" };
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

function normalizeRisk(raw: unknown): CustomerFieldRiskFilter | "UNKNOWN" {
  const value = String(raw ?? "").trim().toUpperCase();
  if (value === "HIGH" || value === "MEDIUM" || value === "LOW") return value;
  return "UNKNOWN";
}

function riskTone(risk: CustomerFieldRiskFilter | "UNKNOWN"): "danger" | "warning" | "neutral" {
  if (risk === "HIGH") return "danger";
  if (risk === "MEDIUM") return "warning";
  return "neutral";
}

function buildCard(item: CustomerFieldListItem, isFallback: boolean): CustomerFieldsIndexCardVm {
  const fieldId = String(item.field_id ?? "").trim();
  const risk = normalizeRisk(item.risk_level as CustomerFieldRiskLevel | string | null | undefined);
  if (isFallback) {
    return {
      fieldId,
      fieldName: sanitizeCustomerText(item.field_name, "地块名称待补充"),
      riskLevel: "UNKNOWN",
      riskLabel: "正式报告条件不足",
      riskTone: "neutral",
      reasons: ["地块列表暂不可用"],
      updatedAtText: toDateTimeText(item.updated_at),
      cropStageText: "正式报告条件不足",
      recentOperationText: "地块列表暂不可用",
      summaryText: sanitizeCustomerText(item.summary, "地块列表暂不可用"),
      href: fieldId ? `/customer/fields/${encodeURIComponent(fieldId)}` : "/customer/fields",
    };
  }
  const cropText = sanitizeCustomerText(item.crop_name, "作物信息待补充");
  const stageText = sanitizeCustomerText(item.stage_name, "生育期待补充");
  const recentOperationTitle = sanitizeCustomerText(item.recent_operation_title, "暂无近期作业");
  const summaryText = sanitizeCustomerText(item.summary, "");
  return { fieldId, fieldName: sanitizeCustomerText(item.field_name, "地块名称待补充"), riskLevel: risk, riskLabel: risk === "UNKNOWN" ? "风险待确认" : labelRiskLevel(risk), riskTone: riskTone(risk), reasons: Array.isArray(item.risk_reasons) ? item.risk_reasons.map((x) => sanitizeCustomerText(x)).filter(Boolean) : [], updatedAtText: toDateTimeText(item.updated_at), cropStageText: `${cropText} / ${stageText}`, recentOperationText: recentOperationTitle, summaryText, href: fieldId ? `/customer/fields/${encodeURIComponent(fieldId)}` : "/customer/fields" };
}

function scopeCopy(response: CustomerFieldsListResponse): { subtitle: string; badge: string; note?: string; isPreview: boolean } {
  const mode = String(response.scope?.scope_mode ?? "").toUpperCase();
  if (mode === "INTERNAL_PREVIEW") return { subtitle: "内部预览：当前按全域客户视图展示地块。", badge: "内部预览 / 全域预览", note: response.scope?.reason, isPreview: true };
  if (mode === "DENIED") return { subtitle: "暂无授权地块。", badge: "暂无授权地块", note: response.scope?.reason || "当前账户未授权任何地块", isPreview: false };
  if (mode === "CLIENT_ALLOWLIST") return { subtitle: "查看授权地块、风险状态与地块报告入口。", badge: `授权地块 ${response.field_count ?? response.fields.length} 块`, isPreview: false };
  if (response.dataScope === "FALLBACK_RECENT_ONLY") return { subtitle: "正式报告条件不足，地块列表暂不可用。", badge: "条件不足", note: response.data_scope_note || "正式报告条件不足，地块列表暂不可用", isPreview: true };
  if (response.dataScope === "ERROR_EMPTY") return { subtitle: "正式报告条件不足，地块列表暂不可用，请稍后刷新。", badge: "暂不可用", note: response.data_scope_note || "正式报告条件不足，地块列表暂不可用，请稍后刷新", isPreview: true };
  return { subtitle: "查看授权地块、风险状态与地块报告入口。", badge: "正式列表", isPreview: false };
}

export function filterCustomerFields(cards: CustomerFieldsIndexCardVm[], risk: CustomerFieldRiskFilter): CustomerFieldsIndexCardVm[] {
  if (risk === "ALL") return cards;
  return cards.filter((card) => card.riskLevel === risk);
}

export function buildCustomerFieldsIndexVm(response: CustomerFieldsListResponse): CustomerFieldsIndexVm {
  const isFallback = response.dataScope !== "OFFICIAL_CUSTOMER_API";
  const cards = (response.fields ?? []).map((item) => buildCard(item, isFallback)).filter((card) => card.fieldId);
  const countByRisk = (risk: CustomerFieldRiskFilter) => risk === "ALL" ? cards.length : cards.filter((card) => card.riskLevel === risk).length;
  const scope = scopeCopy(response);
  return { title: "授权地块", subtitle: scope.subtitle, generatedAtText: toDateTimeText(response.generated_at), dataScope: response.dataScope, isFallback, isPreview: scope.isPreview, scopeBadgeText: scope.badge, dataScopeNote: scope.note, filters: [{ key: "ALL", label: "全部", count: countByRisk("ALL") }, { key: "HIGH", label: "高风险", count: countByRisk("HIGH") }, { key: "MEDIUM", label: "中风险", count: countByRisk("MEDIUM") }, { key: "LOW", label: "低风险", count: countByRisk("LOW") }], cards, emptyState: response.scope?.scope_mode === "DENIED" ? getCustomerEmptyState("NO_AUTHORIZED_FIELDS") : isFallback ? { title: "正式报告条件不足", description: "地块列表暂不可用，请稍后刷新。", severity: "warning" } : getCustomerEmptyState("NO_RISK_FIELDS") };
}
