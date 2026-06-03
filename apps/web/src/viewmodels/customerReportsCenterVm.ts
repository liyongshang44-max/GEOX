import type { CustomerReportCenterItem, CustomerReportsCenterResponse, CustomerReportsDataScope } from "../api/customerReportsCenter";
import { sanitizeCustomerText } from "../lib/customerLabels";
import { getCustomerEmptyState } from "../lib/customerEmptyStates";
import { customerDisplayName, customerSemanticLabel } from "../lib/customerSemanticLabels";

export type CustomerReportGroupKey = "OVERVIEW" | "FIELD" | "OPERATION" | "EVIDENCE_VALUE";

export type CustomerReportsCenterItemVm = {
  title: string;
  subtitle: string;
  href?: string;
  statusText: string;
  updatedAtText: string;
  disabled: boolean;
  coverageText: string;
  trustText: string;
};

export type CustomerReportsCenterGroupVm = {
  key: CustomerReportGroupKey;
  title: string;
  description: string;
  items: CustomerReportsCenterItemVm[];
};

export type CustomerReportsCenterVm = {
  title: string;
  subtitle: string;
  generatedAtText: string;
  dataScope: CustomerReportsDataScope;
  isFallback: boolean;
  isPreview: boolean;
  scopeBadgeText: string;
  dataScopeNote?: string;
  trustText: string;
  groups: CustomerReportsCenterGroupVm[];
  emptyState: { title: string; description: string; severity: "neutral" | "info" | "warning" };
};

const GROUP_LABELS: Record<CustomerReportGroupKey, { title: string; description: string }> = {
  OVERVIEW: { title: "总览报告", description: "经营驾驶舱、风险、作业和价值记录的交付入口。" },
  FIELD: { title: "地块报告", description: "按地块查看地块范围、最近作业、风险诊断、价值与田块记忆。" },
  OPERATION: { title: "作业报告", description: "按作业查看建议、处方审批、执行结果、证据验收、价值学习。" },
  EVIDENCE_VALUE: { title: "证据与价值报告", description: "证据包、价值记录与可信状态汇总入口。" },
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

function n(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function normalizeGroup(raw: unknown): CustomerReportGroupKey {
  const value = String(raw ?? "").trim().toUpperCase();
  if (value === "FIELD") return "FIELD";
  if (value === "OPERATION") return "OPERATION";
  if (value === "EVIDENCE_VALUE" || value === "EVIDENCE" || value === "ROI") return "EVIDENCE_VALUE";
  return "OVERVIEW";
}

function safeCustomerText(raw: unknown, fallback: string): string {
  return customerSemanticLabel(sanitizeCustomerText(raw, fallback), fallback);
}

function trustText(raw: unknown): string {
  const text = safeCustomerText(raw, "有限记录");
  if (["有限记录", "可信价值记录", "数据不足"].includes(text)) return text;
  return "有限记录";
}

function capabilityText(raw: unknown, href: string): { text: string; disabled: boolean; trustText: string } {
  const value = String(raw ?? "").trim().toUpperCase();
  if (value === "PENDING") return { text: "数据不足", disabled: true, trustText: "数据不足，暂不形成可交付报告" }; // no-raw-enum-customer-allow: backend capability code mapping only, converted before render
  if (value === "UNAVAILABLE") return { text: "数据不足", disabled: true, trustText: "数据暂不可用，暂不形成可交付报告" };
  if (!href) return { text: "数据不足", disabled: true, trustText: "缺少报告入口，暂不可查看或导出" };
  return { text: href.includes("export") ? "可导出" : "可查看", disabled: false, trustText: href.includes("export") ? "可导出" : "可查看" };
}

function overviewCoverageText(item: CustomerReportCenterItem): string {
  const fieldCount = n(item.coverage_fields_count);
  const operationCount = n(item.coverage_operations_count);
  const valueCount = n(item.coverage_value_records_count);
  if (fieldCount || operationCount || valueCount) return `覆盖：${fieldCount} 个地块、${operationCount} 条作业、${valueCount} 条价值记录`;
  return "覆盖：经营总览、风险地块、近期作业与价值记录";
}

function coverageText(item: CustomerReportCenterItem, group: CustomerReportGroupKey): string {
  if (group === "OVERVIEW") return overviewCoverageText(item);
  if (group === "FIELD") return "包含：地块范围、最近作业、风险诊断、价值与田块记忆";
  if (group === "OPERATION") return "包含：为什么做、处方审批、执行结果、证据验收、价值学习";
  return "包含：证据包、价值记录与可信状态";
}

function reportTitle(item: CustomerReportCenterItem, group: CustomerReportGroupKey): string {
  if (group === "FIELD") return `${customerDisplayName(item.field_name ?? item.title, "未命名地块")} · 地块报告`;
  if (group === "OPERATION") return `${customerDisplayName(item.operation_title ?? item.title, "未命名作业")} · 作业报告`;
  if (group === "EVIDENCE_VALUE") return "证据与价值报告";
  return customerDisplayName(item.title, "经营总览报告");
}

function subtitleText(item: CustomerReportCenterItem, group: CustomerReportGroupKey): string {
  const fallback = group === "OVERVIEW"
    ? "经营总览、风险地块、近期作业与价值记录"
    : group === "FIELD"
      ? "地块范围、最近作业、风险诊断、价值与田块记忆"
      : group === "OPERATION"
        ? "建议、处方审批、执行结果、证据验收、价值学习"
        : "证据包、价值记录与可信状态";
  const cleaned = safeCustomerText(item.subtitle, fallback);
  if (cleaned.includes("基于当前可见") || cleaned.includes("基于当前客户驾驶舱")) return fallback;
  return cleaned;
}

function buildItem(item: CustomerReportCenterItem): CustomerReportsCenterItemVm {
  const group = normalizeGroup(item.report_type);
  const href = String(item.href ?? "").trim();
  const capability = capabilityText(item.capability_status, href);
  const statusText = safeCustomerText(item.status_text, capability.text);
  const normalizedStatus = ["可查看", "可导出", "数据不足", "需复核"].includes(statusText) ? statusText : capability.text;
  const itemTrustText = trustText(item.data_trust_text);
  return {
    title: reportTitle(item, group),
    subtitle: subtitleText(item, group),
    href: href || undefined,
    statusText: normalizedStatus,
    updatedAtText: toDateTimeText(item.updated_at),
    disabled: capability.disabled || !href,
    coverageText: coverageText(item, group),
    trustText: itemTrustText || capability.trustText,
  };
}

function evidenceValuePendingItem(generatedAt: unknown): CustomerReportsCenterItemVm {
  return { title: "证据与价值报告", subtitle: "证据包、价值记录与可信状态", statusText: "数据不足", updatedAtText: toDateTimeText(generatedAt), disabled: true, coverageText: "包含：证据包、价值记录与可信状态", trustText: "有限记录" };
}

function scopeNote(raw: unknown): string | undefined {
  const text = String(raw ?? "").trim();
  return text ? safeCustomerText(text, text) : undefined;
}

function scopeCopy(response: CustomerReportsCenterResponse): { subtitle: string; badge: string; note?: string; isPreview: boolean } {
  const mode = String(response.scope?.scope_mode ?? "").toUpperCase();
  if (mode === "INTERNAL_PREVIEW") return { subtitle: "当前展示可见经营范围内的报告入口。", badge: "受控试点预览数据", note: scopeNote(response.scope?.reason), isPreview: true };
  if (mode === "DENIED") return { subtitle: "暂无授权地块，因此暂无可见报告入口。", badge: "暂无授权地块", note: scopeNote(response.scope?.reason) || "当前账户未授权任何地块", isPreview: false };
  if (mode === "CLIENT_ALLOWLIST") return { subtitle: "查看授权范围内可交付报告入口。", badge: `授权报告 ${response.report_count ?? response.reports.length} 个`, isPreview: false };
  if (response.dataScope === "dashboard_recent_fallback") return { subtitle: "当前展示驾驶舱与近期可见对象对应的报告入口。", badge: "近期报告", note: safeCustomerText(response.data_scope_note, "当前仅展示近期可见报告入口，完整列表待同步"), isPreview: true };
  if (response.dataScope === "error_empty_state") return { subtitle: "报告中心暂不可用，请稍后刷新。", badge: "暂不可用", note: safeCustomerText(response.data_scope_note, "报告中心暂不可用，请稍后刷新"), isPreview: true };
  return { subtitle: "查看授权范围内可交付报告入口。", badge: "受控试点预览数据", isPreview: true };
}

export function buildCustomerReportsCenterVm(response: CustomerReportsCenterResponse): CustomerReportsCenterVm {
  const grouped = new Map<CustomerReportGroupKey, CustomerReportsCenterItemVm[]>();
  for (const key of Object.keys(GROUP_LABELS) as CustomerReportGroupKey[]) grouped.set(key, []);
  for (const report of response.reports ?? []) {
    const key = normalizeGroup(report.report_type);
    grouped.get(key)?.push(buildItem(report));
  }
  if ((grouped.get("EVIDENCE_VALUE") ?? []).length === 0) grouped.set("EVIDENCE_VALUE", [evidenceValuePendingItem(response.generated_at)]);
  const groups = (Object.keys(GROUP_LABELS) as CustomerReportGroupKey[]).map((key) => ({ key, title: GROUP_LABELS[key].title, description: GROUP_LABELS[key].description, items: grouped.get(key) ?? [] }));
  const scope = scopeCopy(response);
  return { title: "报告中心", subtitle: scope.subtitle, generatedAtText: toDateTimeText(response.generated_at), dataScope: response.dataScope, isFallback: response.dataScope !== "customer_report_center_v1", isPreview: scope.isPreview, scopeBadgeText: scope.badge, dataScopeNote: scope.note, trustText: trustText(response.data_trust_text), groups, emptyState: response.scope?.scope_mode === "DENIED" ? getCustomerEmptyState("NO_AUTHORIZED_FIELDS") : getCustomerEmptyState("NO_RECENT_OPERATIONS") };
}
