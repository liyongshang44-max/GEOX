import type { CustomerDashboardAggregateV1 } from "../api/customerReports";
import { CUSTOMER_LABELS, labelAcceptanceStatus, labelFinalStatus, labelRiskLevel, sanitizeCustomerText } from "../lib/customerLabels";
import { getCustomerEmptyState } from "../lib/customerEmptyStates";
import { customerDisplayName, customerSemanticLabel } from "../lib/customerSemanticLabels";

const numberFmt = new Intl.NumberFormat("zh-CN");
const DASHBOARD_SUMMARY_SOURCE = "统计范围：当前可见授权经营范围；来源：客户看板统一摘要。";

function toDateTimeText(raw: string | null | undefined): string {
  if (!raw) return "暂无更新时间";
  const ms = Date.parse(raw);
  if (!Number.isFinite(ms) || ms <= 0) return "暂无更新时间";
  const d = new Date(ms);
  if (d.getUTCFullYear() <= 1970) return "暂无更新时间";
  return d.toLocaleString("zh-CN", { hour12: false });
}

function num(raw: unknown): number {
  const value = Number(raw ?? 0);
  return Number.isFinite(value) ? value : 0;
}

function fieldBoundaryAvailable(raw: unknown): boolean {
  const item = raw as Record<string, unknown> | null | undefined;
  return Boolean(item?.geometry || item?.geometry_id);
}

function roiCustomerText(summary: CustomerDashboardAggregateV1["roi_summary"] | undefined): string {
  const total = num(summary?.total_roi_items);
  if (!total) return "暂无价值记录；缺少基线时不形成可信收益结论。";
  const hypothesisLike = num(summary?.assumption_based_items) + num(summary?.estimated_items) + num(summary?.insufficient_items) + num(summary?.low_confidence_items);
  const qualifier = hypothesisLike > 0 ? "多数为价值假设或执行成本记录" : "包含已记录的经营价值线索";
  return `已有 ${numberFmt.format(total)} 条价值记录；${qualifier}，缺少基线时不形成可信收益结论。`;
}

export type CustomerKpiVm = {
  // no-raw-enum-customer-allow: internal KPI key identifiers, mapped to customer labels before render
  key: "OPEN_ACTIONS" | "RISK_FIELDS" | "PENDING_ACCEPTANCE" | "OFFLINE_DEVICES" | "RECENT_OPERATIONS" | "VALUE_RECORDS";
  label: string;
  value: string;
  unit?: string;
  tone: "neutral" | "good" | "warning" | "danger";
  sourceNote: string;
  customerHint?: string;
  href?: string;
  disabledReason?: string;
};

export type CustomerRiskFieldVm = {
  fieldId: string;
  fieldName: string;
  secondaryText: string;
  riskLabel: string;
  riskTone: "neutral" | "warning" | "danger";
  reasons: string[];
  boundaryAvailable: boolean;
  boundaryText: string;
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
  summaryScopeText: string;
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
    totalDevices?: number;
    onlineDevices?: number;
    offlineDevices?: number;
    alertDevices?: number;
    offlineFields?: number;
    updatedAtText?: string;
    scopeText: string;
    globalText: string;
    authorizedText: string;
    fieldText: string;
    empty: boolean;
  };
  roiSummary: {
    totalRoiItems: number;
    waterSavedItems: number;
    customerValueText: string;
    confidenceText?: string;
    assumptionText?: string;
    scopeText: string;
    emptyState?: { title: string; description: string; severity: "neutral" | "info" | "warning" };
  };
  emptyStates: Record<string, { title: string; description: string; severity: "neutral" | "info" | "warning" }>;
};
export type CustomerActionItemVm = {
  id: string;
  // no-raw-enum-customer-allow: internal action source taxonomy, not directly rendered as customer copy
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
  const highRisk = num(aggregate.fields?.at_risk);
  const pendingAcceptance = num(aggregate.pending_actions_summary?.pending_acceptance);
  const pendingActions = num(aggregate.pending_actions_summary?.total_open_alerts);
  const valueRecords = num(aggregate.roi_summary?.total_roi_items);
  const totalOperations = num(aggregate.period_summary?.total_operations || (aggregate.recent_operations ?? []).length);
  const totalDevices = num(aggregate.device_summary?.total_devices);
  const offlineDevices = num(aggregate.device_summary?.offline_devices);
  const onlineDevices = Math.max(0, totalDevices - offlineDevices);
  const offlineFields = num(aggregate.device_summary?.offline_fields);
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
    { key: "OPEN_ACTIONS", label: "待处理事项", value: numberFmt.format(pendingActions), unit: "条", tone: pendingActions > 0 ? "warning" : "good", sourceNote: "customer_dashboard_aggregate_v1.pending_actions_summary.total_open_alerts", customerHint: `${DASHBOARD_SUMMARY_SOURCE} 建议优先处理高风险相关待办。` },
    { key: "RISK_FIELDS", label: "风险地块", value: numberFmt.format(highRisk), unit: "块", tone: highRisk > 0 ? "danger" : "good", sourceNote: "customer_dashboard_aggregate_v1.fields.at_risk", customerHint: `${DASHBOARD_SUMMARY_SOURCE} 点击中部风险面板可查看地块详情。` },
    // no-raw-enum-customer-allow: KPI key constant for stable ordering and analytics mapping
    { key: "PENDING_ACCEPTANCE", label: "待验收作业", value: numberFmt.format(pendingAcceptance), unit: "条", tone: pendingAcceptance > 0 ? "warning" : "good", sourceNote: "customer_dashboard_aggregate_v1.pending_actions_summary.pending_acceptance", customerHint: `${DASHBOARD_SUMMARY_SOURCE} 与作业列表使用同一客户摘要来源。` },
    { key: "OFFLINE_DEVICES", label: "离线设备", value: numberFmt.format(offlineDevices), unit: "台", tone: offlineDevices > 0 ? "warning" : "good", sourceNote: "customer_dashboard_aggregate_v1.device_summary.offline_devices", customerHint: `统计范围：可见授权设备；全域设备 ${numberFmt.format(totalDevices)} 台，离线 ${numberFmt.format(offlineDevices)} 台。当前地块设备请进入地块报告查看。` },
    { key: "VALUE_RECORDS", label: "价值记录", value: numberFmt.format(valueRecords), unit: "条", tone: valueRecords > 0 ? "good" : "neutral", sourceNote: "customer_dashboard_aggregate_v1.roi_summary.total_roi_items", customerHint: `${DASHBOARD_SUMMARY_SOURCE} 缺少基线时不形成可信收益结论。` },
    { key: "RECENT_OPERATIONS", label: "作业记录", value: numberFmt.format(totalOperations), unit: "条", tone: "neutral", sourceNote: "customer_dashboard_aggregate_v1.period_summary.total_operations", customerHint: `${DASHBOARD_SUMMARY_SOURCE} 下方仅展示最近 5 条作业。`, disabledReason: "顶部指标仅展示 5 项，近期作业在列表区展示。" },
  ];
  const topRiskFields: CustomerRiskFieldVm[] = (aggregate.top_risk_fields ?? []).slice(0, 5).map((item, index) => {
    const fieldId = String(item.field_id ?? "");
    const riskTone = item.risk_level === "HIGH" ? "danger" : item.risk_level === "MEDIUM" ? "warning" : "neutral";
    const boundaryAvailable = fieldBoundaryAvailable(item);
    const fieldName = customerDisplayName(item.field_name, `未命名地块 ${index + 1}`);
    return {
      fieldId,
      fieldName,
      secondaryText: item.field_name ? "授权地块" : "名称待补充，按授权地块序号显示",
      riskLabel: labelRiskLevel(item.risk_level),
      riskTone,
      reasons: (item.risk_reasons ?? []).map((reason) => customerSemanticLabel(reason)).filter(Boolean),
      boundaryAvailable,
      boundaryText: boundaryAvailable ? "地块边界已接入" : "暂无地块边界",
      href: fieldId ? `/customer/fields/${encodeURIComponent(fieldId)}` : "/customer/dashboard",
    };
  });
  const recentOperations: CustomerDashboardVm["recentOperations"] = (aggregate.recent_operations ?? []).slice(0, 5).map((item) => {
    // customer-boundary-allow: 兼容旧聚合字段 operation_plan_id，优先使用 operation_id
    const operationId = String(item.operation_id ?? item.operation_plan_id ?? "");
    return {
      operationId,
      operationName: customerDisplayName(item.customer_title ?? item.title, "未命名作业"),
      fieldName: customerDisplayName(item.field_name, "未命名地块"),
      stateText: customerSemanticLabel((item as any).operation_state ?? labelFinalStatus(item.final_status), "待确认"),
      acceptanceText: labelAcceptanceStatus(item.acceptance_status),
      evidenceText: customerSemanticLabel((item as any).evidence_status ?? "证据待补充", "证据待补充"),
      updatedAtText: toDateTimeText((item as any).updated_at ?? item.executed_at),
      href: operationId ? `/customer/operations/${encodeURIComponent(operationId)}` : "/customer/dashboard",
    };
  });
  const actionItems: CustomerActionItemVm[] = [
    { id: "risk", source: "RECOMMENDATION", title: "集中处理高风险地块", riskLabel: "高风险", riskTone: "danger", fieldId: String((aggregate.top_risk_fields ?? [])[0]?.field_id ?? ""), primaryAction: { label: "查看地块", href: (aggregate.top_risk_fields ?? [])[0]?.field_id ? `/customer/fields/${encodeURIComponent(String((aggregate.top_risk_fields ?? [])[0]?.field_id) )}` : undefined, disabledReason: (aggregate.top_risk_fields ?? [])[0]?.field_id ? undefined : "暂无可跳转地块" }, summary: `${DASHBOARD_SUMMARY_SOURCE} 按风险等级推进复核，避免问题扩大。` },
    // customer-boundary-allow: 兼容旧 recent_operations.operation_plan_id 字段用于客户跳转
    // customer-boundary-allow: accept action 兼容旧 operation_plan_id，保持历史数据可跳转
    // no-raw-enum-customer-allow: internal source code, rendered title/summary are customer-facing
    {
      id: "accept",
      // no-raw-enum-customer-allow: internal source enum for action routing, not customer-facing copy
      source: "PENDING_ACCEPTANCE",
      title: "完成待验收作业并回写结果",
      riskLabel: pendingAcceptance > 0 ? "待验收" : "已完成",
      riskTone: pendingAcceptance > 0 ? "warning" : "neutral",
      // customer-boundary-allow: 兼容旧 recent_operations.operation_plan_id，保障历史作业跳转
      operationId: String((aggregate.recent_operations ?? [])[0]?.operation_id ?? (aggregate.recent_operations ?? [])[0]?.operation_plan_id ?? ""),
      primaryAction: {
        label: "查看作业",
        // customer-boundary-allow: 跳转链接兼容旧 recent_operations.operation_plan_id
        href: ((aggregate.recent_operations ?? [])[0]?.operation_id ?? (aggregate.recent_operations ?? [])[0]?.operation_plan_id)
          ? `/customer/operations/${encodeURIComponent(String((aggregate.recent_operations ?? [])[0]?.operation_id ?? (aggregate.recent_operations ?? [])[0]?.operation_plan_id))}`
          : undefined,
        disabledReason: ((aggregate.recent_operations ?? [])[0]?.operation_id ?? (aggregate.recent_operations ?? [])[0]?.operation_plan_id)
          ? undefined
          : "暂无可跳转作业"
      },
      summary: `${DASHBOARD_SUMMARY_SOURCE} 确保作业闭环，提升验收及时率。`
    },
    { id: "device", source: "DEVICE_OFFLINE", title: "排查离线设备并恢复数据", riskLabel: offlineDevices > 0 ? "需复核" : "稳定", riskTone: offlineDevices > 0 ? "warning" : "neutral", primaryAction: { label: "设备中心暂未开放", disabledReason: "设备中心暂未开放" }, summary: `统计范围：可见授权设备。全域设备 ${numberFmt.format(totalDevices)} 台，离线 ${numberFmt.format(offlineDevices)} 台；当前地块设备请进入地块报告查看。` },
    { id: "general", source: "GENERAL", title: "处理待办事项", riskLabel: pendingActions > 0 ? "待处理" : "已清空", riskTone: pendingActions > 0 ? "warning" : "neutral", primaryAction: { label: "当前页查看", disabledReason: "请在当前看板处理待办事项" }, summary: `${DASHBOARD_SUMMARY_SOURCE} 优先关闭待处理事项，保障关键风险先处置。` },
  ];
  const roiSummary = {
    totalRoiItems: valueRecords,
    waterSavedItems: num(aggregate.roi_summary?.water_saved_items),
    customerValueText: roiCustomerText(aggregate.roi_summary),
    confidenceText: sanitizeCustomerText((aggregate.roi_summary as any)?.confidence_text ?? "缺少基线时不形成可信收益结论"),
    assumptionText: sanitizeCustomerText((aggregate.roi_summary as any)?.assumption_text ?? `假设型/估算型记录 ${numberFmt.format(num(aggregate.roi_summary?.assumption_based_items) + num(aggregate.roi_summary?.estimated_items))} 条`),
    scopeText: `${DASHBOARD_SUMMARY_SOURCE} 价值记录来自统一 ROI 摘要。`,
    emptyState: emptyStates.NO_ROI,
  };

  return {
    generatedAtText,
    context: { title: CUSTOMER_LABELS.dashboardTitle, subtitle: "经营结果、风险与行动摘要", actorRoleText: "客户", scopeText: "当前可见授权经营范围" },
    header: {
      eyebrow: "GEOX / 客户看板",
      title: CUSTOMER_LABELS.dashboardTitle,
      subtitle: "经营结果、风险与行动摘要",
      exportAction: { label: "总览导出", href: "/customer/export" },
    },
    summaryScopeText: DASHBOARD_SUMMARY_SOURCE,
    kpis,
    topRiskFields,
    pendingItems: [
      {
        id: "alerts",
        sentence: `处理 ${numberFmt.format(pendingActions)} 条待办事项（当前可见授权经营范围）`,
        href: "/customer/dashboard",
      },
      {
        id: "risks",
        sentence: `查看 ${numberFmt.format(highRisk)} 个高风险地块（当前可见授权经营范围）`,
        href: "#top-risk-fields",
      },
    ],
    recentOperations,
    actionItems,
    deviceHealth: {
      totalDevices,
      onlineDevices,
      offlineDevices,
      alertDevices: undefined,
      offlineFields,
      updatedAtText: (aggregate.device_summary as any)?.updated_at ? toDateTimeText((aggregate.device_summary as any).updated_at) : generatedAtText,
      scopeText: "统计范围：可见授权设备；当前地块设备请进入地块报告查看。",
      globalText: `全域设备：共 ${numberFmt.format(totalDevices)} 台，离线 ${numberFmt.format(offlineDevices)} 台。`,
      authorizedText: `可见授权设备：离线 ${numberFmt.format(offlineDevices)} 台；离线地块 ${numberFmt.format(offlineFields)} 块。`,
      fieldText: "当前地块设备请进入地块报告查看。",
      empty: !aggregate.device_summary,
    },
    roiSummary,
    emptyStates,
  };
}
