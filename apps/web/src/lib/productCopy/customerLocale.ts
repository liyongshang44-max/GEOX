// apps/web/src/lib/productCopy/customerLocale.ts
// Purpose: map Customer Portal semantic display states to intentional zh-CN / en-US product copy.
// Boundary: business names, identifiers, timestamps, and user-entered data are preserved; only known product labels and safe fallbacks are localized.

import { localizedText, type LocaleCode, type LocalizedCopy } from "../locale";

export const CUSTOMER_COMMON_COPY = {
  portalEyebrow: { zh: "客户门户", en: "Customer Portal" },
  scope: { zh: "范围", en: "Scope" },
  updated: { zh: "更新时间", en: "Updated" },
  trust: { zh: "可信状态", en: "Trust" },
  summary: { zh: "摘要", en: "Summary" },
  reportStatus: { zh: "报告状态", en: "Report Status" },
  noSummary: { zh: "暂无摘要。", en: "No summary available." },
  noReportSummary: { zh: "暂无报告摘要。", en: "No report summary available." },
  backOverview: { zh: "返回经营总览", en: "Back to Operating Overview" },
  reportingOnly: { zh: "仅报告", en: "Reporting only" },
  authorizedOnly: { zh: "仅授权范围", en: "Authorized scope only" },
  safeError: { zh: "当前报告暂不可用，请稍后重试。", en: "The report is temporarily unavailable. Try again later." },
  safeLoading: { zh: "正在准备客户可见报告。", en: "Preparing the customer-visible report." },
  updatedAtPrefix: { zh: "更新时间", en: "Updated at" },
} as const satisfies Record<string, LocalizedCopy>;

export const CUSTOMER_DASHBOARD_COPY = {
  eyebrow: { zh: "客户门户 / 经营总览", en: "Customer Portal / Operating Overview" },
  title: { zh: "经营总览", en: "Operating Overview" },
  lead: { zh: "查看授权范围内的经营概况、近期进展与可交付报告。", en: "Review operating status, recent progress, and deliverable reports within the authorized scope." },
  loadingAria: { zh: "经营总览加载状态", en: "Operating overview loading state" },
  unavailableAria: { zh: "经营总览不可用状态", en: "Operating overview unavailable state" },
  unavailableTitle: { zh: "经营总览暂不可用", en: "Operating Overview Unavailable" },
  exportReport: { zh: "导出报告", en: "Export Report" },
  openReports: { zh: "打开报告中心", en: "Open Reports" },
  nonclaim: { zh: "仅用于客户报告与回查；不提供作业控制、内部审批、价值台账写入、长期记忆写入或诊断控制台。", en: "Customer reporting and review only; no operation control, internal approval, value-ledger write, long-term memory write, or diagnostic console is available." },
  railAria: { zh: "经营总览报告入口", en: "Operating overview report entries" },
  reportEntries: { zh: "报告条目", en: "Report Entries" },
  reportEntriesLead: { zh: "打开客户可见的报告界面。", en: "Open customer-visible report surfaces." },
  fieldReports: { zh: "地块报告", en: "Field Reports" },
  operationReports: { zh: "作业报告", en: "Operation Reports" },
  reportsCenter: { zh: "报告中心", en: "Reports Center" },
  authorizedScope: { zh: "授权范围", en: "Authorized Scope" },
  exportDelivery: { zh: "导出交付", en: "Export Delivery" },
  exportDeliveryLead: { zh: "可打印、可交付的客户报告界面。", en: "Print-ready customer report delivery surface." },
  exportDashboard: { zh: "导出经营总览报告", en: "Export Operating Overview Report" },
  boundaryTitle: { zh: "客户报告只读边界", en: "Read-only Customer Reporting Boundary" },
  boundaryLead: { zh: "本页汇总授权地块和作业供客户回查，不提供命令、控制或写入流程。", en: "This page summarizes authorized fields and operations for customer review and provides no command, control, or write workflow." },
  boundaryItems: {
    language: { zh: "客户安全报告语言", en: "Customer-safe report language" },
    scope: { zh: "仅授权范围", en: "Authorized scope only" },
    export: { zh: "可交付总览", en: "Deliverable overview" },
  },
  summaryLead: { zh: "授权客户范围内的关键报告指标。", en: "Key reporting indicators for the authorized customer scope." },
  fieldEntries: { zh: "地块报告条目", en: "Field Report Entries" },
  fieldEntriesLead: { zh: "查看授权地块状态并打开地块报告。", en: "Review authorized field status and open field reports." },
  operationEntries: { zh: "作业报告条目", en: "Operation Report Entries" },
  operationEntriesLead: { zh: "查看近期客户可见作业报告。", en: "Review recent customer-visible operation reports." },
  noFieldEntries: { zh: "暂无地块报告条目", en: "No Field Report Entries" },
  noFieldEntriesLead: { zh: "当前摘要中没有可用的授权地块报告条目。", en: "No authorized field report entry is available for this overview." },
  noOperationEntries: { zh: "暂无作业报告", en: "No Operation Reports" },
  noOperationEntriesLead: { zh: "当前没有近期客户可见作业报告。", en: "No recent customer-visible operation report is available." },
  summaryUnavailable: { zh: "摘要暂不可用", en: "Summary Unavailable" },
  summaryUnavailableLead: { zh: "经营总览已生成，但当前没有可用摘要指标。", en: "The operating overview is present, but no summary metrics are currently available." },
} as const;

export const CUSTOMER_FIELDS_COPY = {
  eyebrow: { zh: "客户门户 / 地块报告", en: "Customer Portal / Field Reports" },
  title: { zh: "地块报告", en: "Field Reports" },
  lead: { zh: "查看授权地块及其客户可见报告。", en: "Review authorized fields and their customer-visible reports." },
  loading: { zh: "正在加载地块报告", en: "Loading Field Reports" },
  unavailable: { zh: "地块报告暂不可用", en: "Field Reports Unavailable" },
  nonclaim: { zh: "地块报告是客户只读报告界面，不是地块管理工具。", en: "Field reports are read-only Customer Portal surfaces, not field-management tools." },
  boundaryTitle: { zh: "授权地块报告", en: "Authorized Field Reports" },
  boundaryLead: { zh: "本页列出客户可见地块报告，不提供创建、编辑或命令控制。", en: "This page lists customer-visible field reports and provides no create, edit, or command controls." },
  scopeNote: { zh: "范围说明", en: "Scope Note" },
  entries: { zh: "地块报告条目", en: "Field Report Entries" },
  entriesLead: { zh: "打开地块以查看客户安全报告。", en: "Open a field to review its customer-safe report." },
  filterAria: { zh: "地块报告状态筛选", en: "Field report status filter" },
  caption: { zh: "客户地块报告条目", en: "Customer Field Report Entries" },
  mobileNote: { zh: "在窄屏中可横向滚动表格，或直接打开地块报告。", en: "On narrow screens, scroll the table horizontally or open each field report directly." },
  field: { zh: "地块", en: "Field" },
  cropStage: { zh: "作物阶段", en: "Crop Stage" },
  recentOperation: { zh: "近期作业", en: "Recent Operation" },
} as const;

export const CUSTOMER_OPERATIONS_COPY = {
  eyebrow: { zh: "客户门户 / 作业报告", en: "Customer Portal / Operation Reports" },
  title: { zh: "作业报告", en: "Operation Reports" },
  lead: { zh: "查看客户可见作业进展、验收状态和报告摘要。", en: "Review customer-visible operation progress, acceptance status, and report summaries." },
  loading: { zh: "正在加载作业报告", en: "Loading Operation Reports" },
  unavailable: { zh: "作业报告暂不可用", en: "Operation Reports Unavailable" },
  nonclaim: { zh: "作业报告是客户只读报告界面，不是执行工作台。", en: "Operation reports are read-only Customer Portal surfaces, not execution workboards." },
  boundaryTitle: { zh: "仅作业报告", en: "Operation Reporting Only" },
  boundaryLead: { zh: "本页报告作业状态和交付上下文，不提供执行、控制或评审写入流程。", en: "This page reports operation status and delivery context and provides no execution, control, or review-mutation workflow." },
  scopeNote: { zh: "范围说明", en: "Scope Note" },
  entries: { zh: "作业报告条目", en: "Operation Report Entries" },
  entriesLead: { zh: "打开作业以查看客户安全报告。", en: "Open an operation to review its customer-safe report." },
  filterAria: { zh: "作业报告状态筛选", en: "Operation report status filter" },
  caption: { zh: "客户作业报告条目", en: "Customer Operation Report Entries" },
  mobileNote: { zh: "在窄屏中可横向滚动表格，或直接打开作业报告。", en: "On narrow screens, scroll the table horizontally or open each operation report directly." },
  operation: { zh: "作业", en: "Operation" },
  evidenceSummary: { zh: "证据摘要", en: "Evidence Summary" },
  completed: { zh: "完成时间", en: "Completed" },
} as const;

export const CUSTOMER_REPORTS_COPY = {
  eyebrow: { zh: "客户门户 / 报告", en: "Customer Portal / Reports" },
  title: { zh: "报告中心", en: "Reports Center" },
  lead: { zh: "查看授权范围内的交付报告入口。", en: "Review deliverable report entries within the authorized scope." },
  loading: { zh: "正在加载报告中心", en: "Loading Reports Center" },
  unavailable: { zh: "报告中心暂不可用", en: "Reports Center Unavailable" },
  export: { zh: "导出经营总览报告", en: "Export Operating Overview Report" },
  nonclaim: { zh: "报告中心只连接客户报告和交付界面。", en: "The reports center links only to customer reporting and delivery surfaces." },
  boundaryTitle: { zh: "客户安全报告中心", en: "Customer-safe Reports Center" },
  boundaryLead: { zh: "本页组织地块、作业和导出报告，不暴露内部工具。", en: "This page organizes field, operation, and export reports without exposing internal tools." },
  categoriesAria: { zh: "客户报告类别", en: "Customer Report Categories" },
  noEntry: { zh: "暂无报告条目", en: "No Report Entry" },
  noEntryLead: { zh: "当前类别没有可用的客户报告条目。", en: "No customer report entry is currently available in this category." },
  groups: {
    OVERVIEW: { title: { zh: "总览报告", en: "Overview Reports" }, description: { zh: "经营总览、风险、作业和价值记录的交付入口。", en: "Delivery entries for operating overview, risk, operations, and value records." } },
    FIELD: { title: { zh: "地块报告", en: "Field Reports" }, description: { zh: "按地块查看范围、近期作业、风险和可交付摘要。", en: "Review scope, recent operations, risk, and deliverable summaries by field." } },
    OPERATION: { title: { zh: "作业报告", en: "Operation Reports" }, description: { zh: "按作业查看进展、执行结果、证据验收和交付摘要。", en: "Review progress, execution results, evidence acceptance, and delivery summaries by operation." } },
    EVIDENCE_VALUE: { title: { zh: "证据与价值报告", en: "Evidence and Value Reports" }, description: { zh: "证据包、价值记录和可信状态的报告入口。", en: "Report entries for evidence packages, value records, and trust status." } },
  },
} as const;

export const CUSTOMER_STATUS_COPY = {
  available: { zh: "可用", en: "Available" },
  review: { zh: "需要复核", en: "Requires Review" },
  blocked: { zh: "已阻断", en: "Blocked" },
  reportOnly: { zh: "仅报告", en: "Report Only" },
  viewable: { zh: "可查看", en: "Available to View" },
  exportable: { zh: "可导出", en: "Available to Export" },
  insufficient: { zh: "数据不足", en: "Insufficient Data" },
  pendingAcceptance: { zh: "待验收", en: "Awaiting Acceptance" },
  acceptancePassed: { zh: "验收通过", en: "Acceptance Passed" },
  acceptanceFailed: { zh: "验收未通过", en: "Acceptance Failed" },
  evidenceInsufficient: { zh: "证据不足", en: "Insufficient Evidence" },
} as const satisfies Record<string, LocalizedCopy>;

export function customerCopy(copy: LocalizedCopy, locale: LocaleCode): string {
  return localizedText(copy, locale);
}

export function customerStatusLabel(raw: unknown, locale: LocaleCode): string {
  const value = String(raw ?? "").trim().toUpperCase().replace(/[\s-]+/g, "_");
  if (["AVAILABLE", "GOOD", "PASS", "ACCEPTANCE_PASS", "可用", "可查看"].includes(value)) return customerCopy(CUSTOMER_STATUS_COPY.available, locale);
  if (["EXPORTABLE", "可导出"].includes(value)) return customerCopy(CUSTOMER_STATUS_COPY.exportable, locale);
  if (["BLOCKED", "DANGER", "已阻断"].includes(value)) return customerCopy(CUSTOMER_STATUS_COPY.blocked, locale);
  if (["WAIT_ACCEPTANCE", "PENDING_ACCEPTANCE", "待验收"].includes(value)) return customerCopy(CUSTOMER_STATUS_COPY.pendingAcceptance, locale);
  if (["ACCEPTANCE_FAIL", "验收未通过"].includes(value)) return customerCopy(CUSTOMER_STATUS_COPY.acceptanceFailed, locale);
  if (["EVIDENCE_INSUFFICIENT", "证据不足"].includes(value)) return customerCopy(CUSTOMER_STATUS_COPY.evidenceInsufficient, locale);
  if (["REQUIRES_REVIEW", "NEEDS_REVIEW", "需复核", "需要复核"].includes(value)) return customerCopy(CUSTOMER_STATUS_COPY.review, locale);
  if (["INSUFFICIENT", "UNAVAILABLE", "数据不足", "暂不可用"].includes(value)) return customerCopy(CUSTOMER_STATUS_COPY.insufficient, locale);
  return customerCopy(CUSTOMER_STATUS_COPY.reportOnly, locale);
}

export function customerFilterLabel(key: string, locale: LocaleCode): string {
  const normalized = String(key || "").toUpperCase();
  const filters: Record<string, LocalizedCopy> = {
    ALL: { zh: "全部", en: "All" },
    HIGH: { zh: "高风险", en: "High Risk" },
    MEDIUM: { zh: "中风险", en: "Medium Risk" },
    LOW: { zh: "低风险", en: "Low Risk" },
    NORMAL: { zh: "正常", en: "Normal" },
    ACCEPTANCE_PASS: { zh: "验收通过", en: "Acceptance Passed" },
    WAIT_ACCEPTANCE: { zh: "待验收", en: "Awaiting Acceptance" },
    ACCEPTANCE_FAIL: { zh: "验收未通过", en: "Acceptance Failed" },
    EVIDENCE_INSUFFICIENT: { zh: "证据不足", en: "Insufficient Evidence" },
  };
  return customerCopy(filters[normalized] ?? filters.ALL, locale);
}

export function customerProductFallback(raw: unknown, locale: LocaleCode, fallback: LocalizedCopy): string {
  const value = String(raw ?? "").trim();
  if (!value) return customerCopy(fallback, locale);
  const containsCjk = /[\u3400-\u9fff]/.test(value);
  const containsLatinWord = /[A-Za-z]{3,}/.test(value);
  if (locale === "en-US" && containsCjk) return customerCopy(fallback, locale);
  if (locale === "zh-CN" && containsLatinWord && !/\b(?:GEOX|API|URL|JSON|SHA-256|AO-ACT|ID|Token|ROI)\b/.test(value)) return customerCopy(fallback, locale);
  return value;
}
