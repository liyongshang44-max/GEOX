import type { CustomerDashboardAggregateV1 } from "../api/customerReports";
import { CUSTOMER_LABELS, labelAcceptanceStatus, labelFinalStatus, labelRiskLevel, sanitizeCustomerText } from "../lib/customerLabels";
import { getCustomerEmptyState } from "../lib/customerEmptyStates";

const numberFmt = new Intl.NumberFormat("zh-CN");

function toDateTimeText(raw: string | null | undefined): string {
  return raw ? new Date(raw).toLocaleString("zh-CN", { hour12: false }) : "时间未知";
}

export type CustomerKpiVm = {
  key: "OPEN_ACTIONS" | "RISK_FIELDS" | "PENDING_ACCEPTANCE" | "OFFLINE_DEVICES" | "RECENT_OPERATIONS" | "VALUE_RECORDS";
  label: string;
  value: string;
  unit?: string;
  tone: "neutral" | "good" | "warning" | "danger";
  sourceNote: string;
  href?: string;
  disabledReason?: string;
};

export type CustomerRiskFieldVm = {
  fieldId: string;
  fieldName: string;
  riskLabel: string;
  riskTone: "neutral" | "warning" | "danger";
  reasons: string[];
  href: string;
};

export type CustomerDashboardVm = {
  generatedAtText: string;
  context: { title: string; subtitle: string; actorRoleText: string; scopeText: string };
  header: {
    eyebrow: string;
    title: string;
    subtitle: string;
    exportAction: { label: string; href: string };
  };
  kpis: CustomerKpiVm[];
  topRiskFields: CustomerRiskFieldVm[];
  pendingItems: Array<{
    id: string;
    sentence: string;
    href: string;
  }>;
  recentOperations: Array<{
    operationId: string;
    operationName: string;
    fieldName: string;
    stateText: string;
    acceptanceText: string;
    evidenceText: string;
    updatedAtText: string;
    href: string;
  }>;
  actionItems: CustomerActionItemVm[];
  deviceHealth: {
    onlineDevices?: number;
    offlineDevices?: number;
    alertDevices?: number;
    updatedAtText?: string;
    empty: boolean;
  };
  roiSummary: {
    totalRoiItems: number;
    waterSavedItems: number;
    customerValueText: string;
    confidenceText?: string;
    assumptionText?: string;
    emptyState?: { title: string; description: string; severity: "neutral" | "info" | "warning" };
  };
  emptyStates: Record<string, { title: string; description: string; severity: "neutral" | "info" | "warning" }>;
};
export type CustomerActionItemVm = {
  id: string;
  source: "RECOMMENDATION" | "APPROVAL_REQUIRED" | "PENDING_ACCEPTANCE" | "DEVICE_OFFLINE" | "EVIDENCE_MISSING" | "INVALID_EXECUTION" | "GENERAL";
  title: string;
  fieldName?: string;
  fieldId?: string;
  operationId?: string;
  riskLabel: string;
  riskTone: "neutral" | "warning" | "danger";
  primaryAction: { label: string; href?: string; disabledReason?: string };
  summary: string;
};
export type CustomerDashboardPageVm = CustomerDashboardVm;

export function normalizeDashboardAggregate(input: any): CustomerDashboardAggregateV1 {
  if (!input || typeof input !== "object") return {} as CustomerDashboardAggregateV1;

  if ("aggregate" in input && input.aggregate) {
    return normalizeDashboardAggregate(input.aggregate);
  }

  if ("customer_dashboard_aggregate_v1" in input && input.customer_dashboard_aggregate_v1) {
    return normalizeDashboardAggregate(input.customer_dashboard_aggregate_v1);
  }

  if ("data" in input && input.data) {
    return normalizeDashboardAggregate(input.data);
  }

  return input as CustomerDashboardAggregateV1;
}

export function buildCustomerDashboardVm(input: CustomerDashboardAggregateV1 | { aggregate?: CustomerDashboardAggregateV1; customer_dashboard_aggregate_v1?: CustomerDashboardAggregateV1; data?: CustomerDashboardAggregateV1 }): CustomerDashboardVm {
  const aggregate = normalizeDashboardAggregate(input);
  const highRisk = Number(aggregate.fields?.at_risk ?? 0);
  const pendingAcceptance = Number(aggregate.pending_actions_summary?.pending_acceptance ?? 0);
  const pendingActions = Number(aggregate.pending_actions_summary?.total_open_alerts ?? 0);
  const valueRecords = Number(aggregate.roi_summary?.total_roi_items ?? 0);
  const offlineDevices = Number(aggregate.device_summary?.offline_devices ?? 0);
  const recentOpsCount = Number((aggregate.recent_operations ?? []).length);
  const generatedAtText = toDateTimeText((aggregate as any).generated_at ?? new Date().toISOString());
  const emptyStates = {
    NO_KPI_SUMMARY: getCustomerEmptyState("NO_KPI_SUMMARY"),
    NO_ROI: getCustomerEmptyState("NO_ROI"),
    NO_RISK_FIELDS: getCustomerEmptyState("NO_RISK_FIELDS"),
    NO_PENDING_ACTIONS: getCustomerEmptyState("NO_PENDING_ACTIONS"),
    NO_DEVICE_HEALTH: getCustomerEmptyState("NO_DEVICE_HEALTH"),
    NO_RECENT_OPERATIONS: getCustomerEmptyState("NO_RECENT_OPERATIONS"),
    MAP_UNAVAILABLE: getCustomerEmptyState("MAP_UNAVAILABLE"),
    WEATHER_UNAVAILABLE: getCustomerEmptyState("WEATHER_UNAVAILABLE"),
  };
  const kpis: CustomerKpiVm[] = [
    { key: "OPEN_ACTIONS", label: "待处理事项", value: numberFmt.format(pendingActions), unit: "条", tone: pendingActions > 0 ? "warning" : "good", sourceNote: "pending_actions_summary.total_open_alerts", href: "/customer/dashboard" },
    { key: "RISK_FIELDS", label: "风险地块", value: numberFmt.format(highRisk), unit: "块", tone: highRisk > 0 ? "danger" : "good", sourceNote: "fields.at_risk" },
    { key: "PENDING_ACCEPTANCE", label: "待验收作业", value: numberFmt.format(pendingAcceptance), unit: "条", tone: pendingAcceptance > 0 ? "warning" : "good", sourceNote: "pending_actions_summary.pending_acceptance" },
    { key: "OFFLINE_DEVICES", label: "离线设备", value: numberFmt.format(offlineDevices), unit: "台", tone: offlineDevices > 0 ? "warning" : "good", sourceNote: "device_summary.offline_devices" },
    { key: "VALUE_RECORDS", label: "价值记录", value: numberFmt.format(valueRecords), unit: "条", tone: valueRecords > 0 ? "good" : "neutral", sourceNote: "roi_summary.total_roi_items" },
    { key: "RECENT_OPERATIONS", label: "近期作业", value: numberFmt.format(recentOpsCount), unit: "条", tone: "neutral", sourceNote: "recent_operations.length", disabledReason: "顶部 KPI 仅展示 5 项，近期作业在列表区展示。" },
  ];
  const topRiskFields: CustomerRiskFieldVm[] = (aggregate.top_risk_fields ?? []).slice(0, 5).map((item) => {
    const fieldId = String(item.field_id ?? "");
    const riskTone = item.risk_level === "HIGH" ? "danger" : item.risk_level === "MEDIUM" ? "warning" : "neutral";
    return {
      fieldId,
      fieldName: sanitizeCustomerText(item.field_name ?? "地块"),
      riskLabel: labelRiskLevel(item.risk_level),
      riskTone,
      reasons: (item.risk_reasons ?? []).map((reason) => sanitizeCustomerText(reason)).filter(Boolean),
      href: fieldId ? `/customer/fields/${encodeURIComponent(fieldId)}` : "/customer/dashboard",
    };
  });
  const recentOperations: CustomerDashboardVm["recentOperations"] = (aggregate.recent_operations ?? []).slice(0, 5).map((item) => {
    const operationId = String(item.operation_id ?? item.operation_plan_id ?? "");
    return {
      operationId,
      operationName: sanitizeCustomerText(item.customer_title ?? item.title ?? "作业"),
      fieldName: sanitizeCustomerText(item.field_name ?? "地块"),
      stateText: sanitizeCustomerText((item as any).operation_state ?? labelFinalStatus(item.final_status)),
      acceptanceText: labelAcceptanceStatus(item.acceptance_status),
      evidenceText: sanitizeCustomerText((item as any).evidence_status ?? "证据待补充"),
      updatedAtText: toDateTimeText((item as any).updated_at ?? item.executed_at),
      href: operationId ? `/customer/operations/${encodeURIComponent(operationId)}` : "/customer/dashboard",
    };
  });
  const actionItems: CustomerActionItemVm[] = [
    { id: "risk", source: "RECOMMENDATION", title: "集中处理高风险地块", riskLabel: "高风险", riskTone: "danger", fieldId: String((aggregate.top_risk_fields ?? [])[0]?.field_id ?? ""), primaryAction: { label: "查看地块", href: (aggregate.top_risk_fields ?? [])[0]?.field_id ? `/customer/fields/${encodeURIComponent(String((aggregate.top_risk_fields ?? [])[0]?.field_id) )}` : undefined, disabledReason: (aggregate.top_risk_fields ?? [])[0]?.field_id ? undefined : "暂无可跳转地块" }, summary: "按风险等级推进复核，避免问题扩大。" },
    { id: "accept", source: "PENDING_ACCEPTANCE", title: "完成待验收作业并回写结果", riskLabel: pendingAcceptance > 0 ? "待验收" : "已完成", riskTone: pendingAcceptance > 0 ? "warning" : "neutral", operationId: String((aggregate.recent_operations ?? [])[0]?.operation_id ?? (aggregate.recent_operations ?? [])[0]?.operation_plan_id ?? ""), primaryAction: { label: "查看作业", href: ((aggregate.recent_operations ?? [])[0]?.operation_id ?? (aggregate.recent_operations ?? [])[0]?.operation_plan_id) ? `/customer/operations/${encodeURIComponent(String((aggregate.recent_operations ?? [])[0]?.operation_id ?? (aggregate.recent_operations ?? [])[0]?.operation_plan_id))}` : undefined, disabledReason: ((aggregate.recent_operations ?? [])[0]?.operation_id ?? (aggregate.recent_operations ?? [])[0]?.operation_plan_id) ? undefined : "暂无可跳转作业" }, summary: "确保作业闭环，提升验收及时率。" },
    { id: "device", source: "DEVICE_OFFLINE", title: "排查离线设备并恢复数据", riskLabel: offlineDevices > 0 ? "需复核" : "稳定", riskTone: offlineDevices > 0 ? "warning" : "neutral", primaryAction: { label: "暂不支持跳转", disabledReason: "P0 不开放设备列表路由" }, summary: "优先恢复离线地块数据采集能力。" },
    { id: "general", source: "GENERAL", title: "处理待办事项", riskLabel: pendingActions > 0 ? "待处理" : "已清空", riskTone: pendingActions > 0 ? "warning" : "neutral", primaryAction: { label: "返回看板", href: "/customer/dashboard" }, summary: "优先关闭待处理事项，保障关键风险先处置。" },
  ];
  const roiSummary = {
    totalRoiItems: Number(aggregate.roi_summary?.total_roi_items ?? 0),
    waterSavedItems: Number(aggregate.roi_summary?.water_saved_items ?? 0),
    customerValueText: sanitizeCustomerText(aggregate.roi_summary?.customer_value_text ?? "暂无收益摘要"),
    confidenceText: sanitizeCustomerText((aggregate.roi_summary as any)?.confidence_text ?? ""),
    assumptionText: sanitizeCustomerText((aggregate.roi_summary as any)?.assumption_text ?? ""),
    emptyState: emptyStates.NO_ROI,
  };

  return {
    generatedAtText,
    context: { title: CUSTOMER_LABELS.dashboardTitle, subtitle: "经营结果、风险与行动摘要", actorRoleText: "客户", scopeText: "当前经营范围" },
    header: {
      eyebrow: "GEOX / 客户看板",
      title: CUSTOMER_LABELS.dashboardTitle,
      subtitle: "经营结果、风险与行动摘要",
      exportAction: { label: "总览导出", href: "/customer/export" },
    },
    kpis,
    topRiskFields,
    pendingItems: [
      {
        id: "alerts",
        sentence: `处理 ${numberFmt.format(pendingActions)} 条待办事项`,
        href: "/customer/dashboard",
      },
      {
        id: "risks",
        sentence: `查看 ${numberFmt.format(highRisk)} 个高风险地块`,
        href: "#top-risk-fields",
      },
    ],
    recentOperations,
    actionItems,
    deviceHealth: {
      onlineDevices: typeof (aggregate.device_summary as any)?.online_devices === "number" ? Number((aggregate.device_summary as any).online_devices) : undefined,
      offlineDevices: typeof aggregate.device_summary?.offline_devices === "number" ? Number(aggregate.device_summary?.offline_devices) : undefined,
      alertDevices: typeof (aggregate.device_summary as any)?.alert_devices === "number" ? Number((aggregate.device_summary as any).alert_devices) : undefined,
      updatedAtText: (aggregate.device_summary as any)?.updated_at ? toDateTimeText((aggregate.device_summary as any).updated_at) : undefined,
      empty: !aggregate.device_summary,
    },
    roiSummary,
    emptyStates,
  };
}
