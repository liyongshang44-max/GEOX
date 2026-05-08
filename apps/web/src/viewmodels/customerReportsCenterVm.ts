import type { CustomerReportCenterItem, CustomerReportsCenterResponse, CustomerReportsDataScope } from "../api/customerReportsCenter";
import { sanitizeCustomerText } from "../lib/customerLabels";
import { getCustomerEmptyState } from "../lib/customerEmptyStates";

export type CustomerReportGroupKey = "OVERVIEW" | "FIELD" | "OPERATION" | "EVIDENCE_VALUE";

export type CustomerReportsCenterItemVm = {
  title: string;
  subtitle: string;
  href?: string;
  statusText: string;
  updatedAtText: string;
  disabled: boolean;
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
  EVIDENCE_VALUE: { title: "证据与价值报告", description: "证据包生成能力待接入。" },
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

function capabilityText(raw: unknown): { text: string; disabled: boolean } {
  const value = String(raw ?? "").trim().toUpperCase();
  if (value === "PENDING") return { text: "待接入", disabled: true }; // no-raw-enum-customer-allow: backend capability code mapping only, converted before render
  if (value === "UNAVAILABLE") return { text: "暂不可用", disabled: true };
  return { text: "可查看", disabled: false };
}

function buildItem(item: CustomerReportCenterItem): CustomerReportsCenterItemVm {
  const capability = capabilityText(item.capability_status);
  const href = String(item.href ?? "").trim();
  return {
    title: sanitizeCustomerText(item.title, "未命名报告"),
    subtitle: sanitizeCustomerText(item.subtitle, "暂无补充说明"),
    href: href || undefined,
    statusText: sanitizeCustomerText(item.status_text, capability.text),
    updatedAtText: toDateTimeText(item.updated_at),
    disabled: capability.disabled || !href,
  };
}

function evidenceValuePendingItem(generatedAt: unknown): CustomerReportsCenterItemVm {
  return {
    title: "证据与价值报告",
    subtitle: "证据包生成能力待接入。",
    statusText: "待接入",
    updatedAtText: toDateTimeText(generatedAt),
    disabled: true,
  };
}

function scopeCopy(response: CustomerReportsCenterResponse): { subtitle: string; badge: string; note?: string; isPreview: boolean } {
  if (response.dataScope === "FALLBACK_RECENT_ONLY") {
    return {
      subtitle: "P1-A Preview：当前仅展示驾驶舱与近期可见对象对应报告入口，非全部报告列表。",
      badge: "P1-A Preview",
      note: response.data_scope_note || "当前仅展示驾驶舱与近期可见对象对应报告入口，非全部报告列表",
      isPreview: true,
    };
  }
  if (response.dataScope === "ERROR_EMPTY") {
    return {
      subtitle: "报告中心暂不可用，请稍后刷新。",
      badge: "暂不可用",
      note: response.data_scope_note || "报告中心暂不可用，请稍后刷新",
      isPreview: true,
    };
  }
  return {
    subtitle: "查看授权范围内可交付报告入口。",
    badge: "正式列表",
    isPreview: false,
  };
}

export function buildCustomerReportsCenterVm(response: CustomerReportsCenterResponse): CustomerReportsCenterVm {
  const grouped = new Map<CustomerReportGroupKey, CustomerReportsCenterItemVm[]>();
  for (const key of Object.keys(GROUP_LABELS) as CustomerReportGroupKey[]) grouped.set(key, []);

  for (const report of response.reports ?? []) {
    const key = normalizeGroup(report.report_type);
    grouped.get(key)?.push(buildItem(report));
  }

  if ((grouped.get("EVIDENCE_VALUE") ?? []).length === 0) {
    grouped.set("EVIDENCE_VALUE", [evidenceValuePendingItem(response.generated_at)]);
  }

  const groups = (Object.keys(GROUP_LABELS) as CustomerReportGroupKey[]).map((key) => {
    const base = GROUP_LABELS[key];
    return {
      key,
      title: base.title,
      description: base.description,
      items: grouped.get(key) ?? [],
    };
  });
  const scope = scopeCopy(response);

  return {
    title: "报告中心",
    subtitle: scope.subtitle,
    generatedAtText: toDateTimeText(response.generated_at),
    dataScope: response.dataScope,
    isFallback: response.dataScope !== "OFFICIAL_CUSTOMER_API",
    isPreview: scope.isPreview,
    scopeBadgeText: scope.badge,
    dataScopeNote: scope.note,
    groups,
    emptyState: getCustomerEmptyState("NO_RECENT_OPERATIONS"),
  };
}
