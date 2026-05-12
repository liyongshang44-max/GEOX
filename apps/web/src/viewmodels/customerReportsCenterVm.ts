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
  groups: CustomerReportsCenterGroupVm[];
  emptyState: { title: string; description: string; severity: "neutral" | "info" | "warning" };
};

const GROUP_LABELS: Record<CustomerReportGroupKey, { title: string; description: string }> = {
  OVERVIEW: { title: "总览报告", description: "经营驾驶舱和整体经营结论导出入口。" },
  FIELD: { title: "地块报告", description: "按地块查看地块病历、风险和近期变化。" },
  OPERATION: { title: "作业报告", description: "按作业查看建议、审批、执行、证据、验收与价值记录。" },
  EVIDENCE_VALUE: { title: "证据与价值报告", description: "证据包与价值记录汇总入口。" },
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

function normalizeGroup(raw: unknown): CustomerReportGroupKey {
  const value = String(raw ?? "").trim().toUpperCase();
  if (value === "FIELD") return "FIELD";
  if (value === "OPERATION") return "OPERATION";
  if (value === "EVIDENCE_VALUE" || value === "EVIDENCE" || value === "ROI") return "EVIDENCE_VALUE";
  return "OVERVIEW";
}

function capabilityText(raw: unknown): { text: string; disabled: boolean; trustText: string } {
  const value = String(raw ?? "").trim().toUpperCase();
  if (value === "PENDING") return { text: "待接入", disabled: true, trustText: "能力待接入，暂不形成可交付报告" }; // no-raw-enum-customer-allow: backend capability code mapping only, converted before render
  if (value === "UNAVAILABLE") return { text: "暂不可用", disabled: true, trustText: "数据暂不可用，暂不形成可交付报告" };
  return { text: "可查看", disabled: false, trustText: "可交付，来源于当前客户报告数据" };
}

function coverageText(item: CustomerReportCenterItem, group: CustomerReportGroupKey): string {
  if (group === "OVERVIEW") return "覆盖：经营总览、风险地块、近期作业与价值摘要";
  if (group === "FIELD") return `覆盖：${customerDisplayName(item.field_name, "对应地块")} 的地块病历、风险与近期作业`;
  if (group === "OPERATION") return `覆盖：${customerDisplayName(item.operation_title ?? item.title, "对应作业")} 的作业闭环、证据与验收`;
  return "覆盖：证据包与价值记录汇总";
}

function reportTitle(item: CustomerReportCenterItem, group: CustomerReportGroupKey): string {
  if (group === "FIELD") return `${customerDisplayName(item.field_name ?? item.title, "未命名地块")} · 地块报告`;
  if (group === "OPERATION") return `${customerDisplayName(item.operation_title ?? item.title, "未命名作业")} · 作业报告`;
  if (group === "EVIDENCE_VALUE") return "证据与价值报告";
  return customerDisplayName(item.title, "经营总览报告");
}

function buildItem(item: CustomerReportCenterItem): CustomerReportsCenterItemVm {
  const group = normalizeGroup(item.report_type);
  const capability = capabilityText(item.capability_status);
  const href = String(item.href ?? "").trim();
  const statusText = customerSemanticLabel(item.status_text, capability.text);
  return {
    title: reportTitle(item, group),
    subtitle: sanitizeCustomerText(item.subtitle, group === "OVERVIEW" ? "基于当前客户驾驶舱可见数据生成" : "基于当前可见对象生成"),
    href: href || undefined,
    statusText,
    updatedAtText: toDateTimeText(item.updated_at),
    disabled: capability.disabled || !href,
    coverageText: coverageText(item, group),
    trustText: capability.disabled ? capability.trustText : `${capability.trustText}；状态：${statusText}`,
  };
}

function evidenceValuePendingItem(generatedAt: unknown): CustomerReportsCenterItemVm {
  return { title: "证据与价值报告", subtitle: "证据包汇总能力待接入。", statusText: "待接入", updatedAtText: toDateTimeText(generatedAt), disabled: true, coverageText: "覆盖：证据包、价值记录与可信状态", trustText: "能力待接入，暂不形成可交付报告" };
}

function scopeNote(raw: unknown): string | undefined {
  const text = String(raw ?? "").trim();
  return text ? customerSemanticLabel(text, text) : undefined;
}

function scopeCopy(response: CustomerReportsCenterResponse): { subtitle: string; badge: string; note?: string; isPreview: boolean } {
  const mode = String(response.scope?.scope_mode ?? "").toUpperCase();
  if (mode === "INTERNAL_PREVIEW") return { subtitle: "当前展示可见经营范围内的报告入口。", badge: "经营范围预览", note: scopeNote(response.scope?.reason), isPreview: true };
  if (mode === "DENIED") return { subtitle: "暂无授权地块，因此暂无可见报告入口。", badge: "暂无授权地块", note: scopeNote(response.scope?.reason) || "当前账户未授权任何地块", isPreview: false };
  if (mode === "CLIENT_ALLOWLIST") return { subtitle: "查看授权范围内可交付报告入口。", badge: `授权报告 ${response.report_count ?? response.reports.length} 个`, isPreview: false };
  if (response.dataScope === "FALLBACK_RECENT_ONLY") return { subtitle: "当前展示驾驶舱与近期可见对象对应的报告入口。", badge: "近期报告", note: customerSemanticLabel(response.data_scope_note, "当前仅展示近期可见报告入口，完整列表待同步"), isPreview: true };
  if (response.dataScope === "ERROR_EMPTY") return { subtitle: "报告中心暂不可用，请稍后刷新。", badge: "暂不可用", note: customerSemanticLabel(response.data_scope_note, "报告中心暂不可用，请稍后刷新"), isPreview: true };
  return { subtitle: "查看授权范围内可交付报告入口。", badge: "正式列表", isPreview: false };
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
  return { title: "报告中心", subtitle: scope.subtitle, generatedAtText: toDateTimeText(response.generated_at), dataScope: response.dataScope, isFallback: response.dataScope !== "OFFICIAL_CUSTOMER_API", isPreview: scope.isPreview, scopeBadgeText: scope.badge, dataScopeNote: scope.note, groups, emptyState: response.scope?.scope_mode === "DENIED" ? getCustomerEmptyState("NO_AUTHORIZED_FIELDS") : getCustomerEmptyState("NO_RECENT_OPERATIONS") };
}
