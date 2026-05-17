import type { CustomerDashboardAggregateV1 } from "../api/customerReports";
import { CUSTOMER_LABELS, labelRiskLevel, sanitizeCustomerText } from "../lib/customerLabels";
import { getCustomerEmptyState } from "../lib/customerEmptyStates";
import { customerDisplayName, customerSemanticLabel } from "../lib/customerSemanticLabels";
import { customerGuardedAcceptanceText, customerGuardedEvidenceText, customerGuardedStatusText, customerTrustScopeText, customerValueSummaryText, isTrustedDashboardValueSummary } from "../lib/customerTrustGate";
import { buildFormalScenarioVm } from "../lib/formalScenarioViewModel";

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

function optionalNum(raw: unknown): number | null {
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

function fieldBoundaryAvailable(raw: unknown): boolean {
  const item = raw as Record<string, unknown> | null | undefined;
  return Boolean(item?.geometry || item?.geometry_id);
}

function roiCustomerText(summary: CustomerDashboardAggregateV1["roi_summary"] | undefined): string {
  const total = num(summary?.total_roi_items);
  return customerValueSummaryText(summary, total, (n) => numberFmt.format(n));
}

export type CustomerKpiVm = {
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
  header: { eyebrow: string; title: string; subtitle: string; exportAction: { label: string; href: string } };
  summaryScopeText: string;
  kpis: CustomerKpiVm[];
  topRiskFields: CustomerRiskFieldVm[];
  pendingItems: Array<{ id: string; sentence: string; href: string }>;
  recentOperations: Array<{ operationId: string; operationName: string; fieldName: string; stateText: string; acceptanceText: string; evidenceText: string; scenarioSummaryText: string; updatedAtText: string; href: string }>;
  actionItems: CustomerActionItemVm[];
  deviceHealth: {
    totalDevices?: number;
    visibleDevices?: number;
    onlineDevices?: number;
    offlineDevices?: number;
    alertDevices?: number;
    alertEvents?: number;
    offlineFields?: number;
    updatedAtText?: string;
    scopeText: string;
    globalText: string;
    authorizedText: string;
    fieldText: string;
    offlineText: string;
    alertText: string;
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
  if ("aggregate" in input && input.aggregate) return normalizeDashboardAggregate(input.aggregate);
  if ("customer_dashboard_aggregate_v1" in input && input.customer_dashboard_aggregate_v1) return normalizeDashboardAggregate(input.customer_dashboard_aggregate_v1);
  if ("data" in input && input.data) return normalizeDashboardAggregate(input.data);
  return input as CustomerDashboardAggregateV1;
}

export function buildCustomerDashboardVm(input: CustomerDashboardAggregateV1 | { aggregate?: CustomerDashboardAggregateV1; customer_dashboard_aggregate_v1?: CustomerDashboardAggregateV1; data?: CustomerDashboardAggregateV1 }): CustomerDashboardVm {
  const aggregate = normalizeDashboardAggregate(input);
  const deviceSummary = (aggregate.device_summary ?? {}) as any;
  const highRisk = num(aggregate.fields?.at_risk);
  const pendingAcceptance = num(aggregate.pending_actions_summary?.pending_acceptance);
  const pendingActions = num(aggregate.pending_actions_summary?.total_open_alerts);
  const alertEvents = num((aggregate.pending_actions_summary as any)?.alert_events_count ?? (aggregate.pending_actions_summary as any)?.alert_events ?? pendingActions);
  const valueRecords = num(aggregate.roi_summary?.total_roi_items);
  const trustedValueSummary = isTrustedDashboardValueSummary(aggregate.roi_summary);
  const totalOperations = num(aggregate.period_summary?.total_operations || (aggregate.recent_operations ?? []).length);
  const globalDevices = optionalNum(deviceSummary.global_devices_count ?? deviceSummary.globalDevicesCount ?? deviceSummary.total_devices);
  const visibleDevices = num(deviceSummary.visible_devices_count ?? deviceSummary.visibleDevicesCount ?? deviceSummary.total_devices);
  const totalDevices = visibleDevices;
  const offlineDevices = num(deviceSummary.offline_devices_count ?? deviceSummary.offlineDevicesCount ?? deviceSummary.offline_devices);
  const onlineDevices = Math.max(0, totalDevices - offlineDevices);
  const offlineFields = num(deviceSummary.offline_fields);
  const generatedAtText = toDateTimeText((aggregate as any).generated_at ?? new Date().toISOString());
  const globalDeviceText = globalDevices === null ? "全域设备：后端未返回；客户页不推断全域设备总量。" : `全域设备：共 ${numberFmt.format(globalDevices)} 台。`;
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
    { key: "PENDING_ACCEPTANCE", label: "待验收作业", value: numberFmt.format(pendingAcceptance), unit: "条", tone: pendingAcceptance > 0 ? "warning" : "good", sourceNote: "customer_dashboard_aggregate_v1.pending_actions_summary.pending_acceptance", customerHint: `${DASHBOARD_SUMMARY_SOURCE} 与作业列表使用同一客户摘要来源。` },
    { key: "OFFLINE_DEVICES", label: "离线设备", value: numberFmt.format(offlineDevices), unit: "台", tone: offlineDevices > 0 ? "warning" : "good", sourceNote: "customer_dashboard_aggregate_v1.device_summary.offline_devices_count/offline_devices", customerHint: `统计范围：可见授权设备 visible_devices_count=${numberFmt.format(visibleDevices)}；offline_devices_count=${numberFmt.format(offlineDevices)}。当前地块设备请进入地块报告查看。` },
    { key: "VALUE_RECORDS", label: trustedValueSummary ? "可信价值记录" : "价值线索", value: numberFmt.format(valueRecords), unit: "条", tone: trustedValueSummary && valueRecords > 0 ? "good" : "neutral", sourceNote: "customer_dashboard_aggregate_v1.roi_summary.total_roi_items + trust gate", customerHint: `${DASHBOARD_SUMMARY_SOURCE} ${customerTrustScopeText()}` },
    { key: "RECENT_OPERATIONS", label: "作业记录", value: numberFmt.format(totalOperations), unit: "条", tone: "neutral", sourceNote: "customer_dashboard_aggregate_v1.period_summary.total_operations", customerHint: `${DASHBOARD_SUMMARY_SOURCE} 下方仅展示最近 5 条作业。`, disabledReason: "顶部指标仅展示 5 项，近期作业在列表区展示。" },
  ];
  const topRiskFields: CustomerRiskFieldVm[] = (aggregate.top_risk_fields ?? []).slice(0, 5).map((item, index) => {
    const fieldId = String(item.field_id ?? "");
    const riskTone = item.risk_level === "HIGH" ? "danger" : item.risk_level === "MEDIUM" ? "warning" : "neutral";
    const boundaryAvailable = fieldBoundaryAvailable(item);
    const fieldName = customerDisplayName(item.field_name, `未命名地块 ${index + 1}`);
    return { fieldId, fieldName, secondaryText: item.field_name ? "授权地块" : "名称待补充，按授权地块序号显示", riskLabel: labelRiskLevel(item.risk_level), riskTone, reasons: (item.risk_reasons ?? []).map((reason) => customerSemanticLabel(reason)).filter(Boolean), boundaryAvailable, boundaryText: boundaryAvailable ? "地块边界已接入" : "暂无地块边界", href: fieldId ? `/customer/fields/${encodeURIComponent(fieldId)}` : "/customer/dashboard" };
  });
  const recentOperations: CustomerDashboardVm["recentOperations"] = (aggregate.recent_operations ?? []).slice(0, 5).map((item) => {
    const operationId = String(item.operation_id ?? item.operation_plan_id ?? "");
    const formalVm = buildFormalScenarioVm(item);
    return {
      operationId,
      operationName: customerDisplayName(item.customer_title ?? item.title, "未命名作业"),
      fieldName: customerDisplayName(item.field_name, "未命名地块"),
      stateText: customerGuardedStatusText(item),
      acceptanceText: customerGuardedAcceptanceText(item),
      evidenceText: customerGuardedEvidenceText(item),
      scenarioSummaryText: [formalVm.scenarioLabel, formalVm.chainText, formalVm.evidenceText].filter(Boolean).join("｜"),
      updatedAtText: toDateTimeText((item as any).updated_at ?? item.executed_at),
      href: operationId ? `/customer/operations/${encodeURIComponent(operationId)}` : "/customer/dashboard",
    };
  });
  const actionItems: CustomerActionItemVm[] = [
    { id: "risk", source: "RECOMMENDATION", title: "集中处理高风险地块", riskLabel: "高风险", riskTone: "danger", fieldId: String((aggregate.top_risk_fields ?? [])[0]?.field_id ?? ""), primaryAction: { label: "查看地块", href: (aggregate.top_risk_fields ?? [])[0]?.field_id ? `/customer/fields/${encodeURIComponent(String((aggregate.top_risk_fields ?? [])[0]?.field_id))}` : undefined, disabledReason: (aggregate.top_risk_fields ?? [])[0]?.field_id ? undefined : "暂无可跳转地块" }, summary: `${DASHBOARD_SUMMARY_SOURCE} 按风险等级推进复核，避免问题扩大。` },
    { id: "accept", source: "PENDING_ACCEPTANCE", title: "完成待验收作业并回写结果", riskLabel: pendingAcceptance > 0 ? "待验收" : "已完成", riskTone: pendingAcceptance > 0 ? "warning" : "neutral", operationId: String((aggregate.recent_operations ?? [])[0]?.operation_id ?? (aggregate.recent_operations ?? [])[0]?.operation_plan_id ?? ""), primaryAction: { label: "查看作业", href: ((aggregate.recent_operations ?? [])[0]?.operation_id ?? (aggregate.recent_operations ?? [])[0]?.operation_plan_id) ? `/customer/operations/${encodeURIComponent(String((aggregate.recent_operations ?? [])[0]?.operation_id ?? (aggregate.recent_operations ?? [])[0]?.operation_plan_id))}` : undefined, disabledReason: ((aggregate.recent_operations ?? [])[0]?.operation_id ?? (aggregate.recent_operations ?? [])[0]?.operation_plan_id) ? undefined : "暂无可跳转作业" }, summary: `${DASHBOARD_SUMMARY_SOURCE} 确保作业闭环，提升验收及时率。` },
    { id: "device", source: "DEVICE_OFFLINE", title: "排查离线设备并恢复数据", riskLabel: offlineDevices > 0 ? "需复核" : "稳定", riskTone: offlineDevices > 0 ? "warning" : "neutral", primaryAction: { label: "设备中心暂未开放", disabledReason: "设备中心暂未开放" }, summary: `统计范围：可见授权设备。visible_devices_count=${numberFmt.format(visibleDevices)}，offline_devices_count=${numberFmt.format(offlineDevices)}；当前地块设备请进入地块报告查看。` },
    { id: "general", source: "GENERAL", title: "处理待办事项", riskLabel: pendingActions > 0 ? "待处理" : "已清空", riskTone: pendingActions > 0 ? "warning" : "neutral", primaryAction: { label: "当前页查看", disabledReason: "请在当前看板处理待办事项" }, summary: `${DASHBOARD_SUMMARY_SOURCE} 优先关闭待处理事项，保障关键风险先处置。` },
  ];
  const roiSummary = {
    totalRoiItems: valueRecords,
    waterSavedItems: num(aggregate.roi_summary?.water_saved_items),
    customerValueText: roiCustomerText(aggregate.roi_summary),
    confidenceText: sanitizeCustomerText((aggregate.roi_summary as any)?.confidence_text ?? (trustedValueSummary ? "已通过正式价值门禁" : "未通过正式价值门禁，不形成可信收益结论")),
    assumptionText: sanitizeCustomerText((aggregate.roi_summary as any)?.assumption_text ?? `假设型/估算型记录 ${numberFmt.format(num(aggregate.roi_summary?.assumption_based_items) + num(aggregate.roi_summary?.estimated_items))} 条`),
    scopeText: `${DASHBOARD_SUMMARY_SOURCE} ${customerTrustScopeText()}`,
    emptyState: emptyStates.NO_ROI,
  };

  return {
    generatedAtText,
    context: { title: CUSTOMER_LABELS.dashboardTitle, subtitle: "经营结果、风险与行动摘要", actorRoleText: "客户", scopeText: "当前可见授权经营范围" },
    header: { eyebrow: "GEOX / 客户看板", title: CUSTOMER_LABELS.dashboardTitle, subtitle: "经营结果、风险与行动摘要", exportAction: { label: "总览导出", href: "/customer/export" } },
    summaryScopeText: `${DASHBOARD_SUMMARY_SOURCE} ${customerTrustScopeText()}`,
    kpis,
    topRiskFields,
    pendingItems: [
      { id: "alerts", sentence: `处理 ${numberFmt.format(pendingActions)} 条待办事项（当前可见授权经营范围）`, href: "/customer/dashboard" },
      { id: "risks", sentence: `查看 ${numberFmt.format(highRisk)} 个高风险地块（当前可见授权经营范围）`, href: "#top-risk-fields" },
    ],
    recentOperations,
    actionItems,
    deviceHealth: {
      totalDevices,
      visibleDevices,
      onlineDevices,
      offlineDevices,
      alertDevices: undefined,
      alertEvents,
      offlineFields,
      updatedAtText: deviceSummary.updated_at ? toDateTimeText(deviceSummary.updated_at) : generatedAtText,
      scopeText: "设备 scope：global_devices_count=全域设备，visible_devices_count=可见授权设备，field_devices_count=当前地块设备，offline_devices_count=离线设备，alert_events_count=告警事件。当前页展示客户可见授权设备，不推断当前地块设备。",
      globalText: globalDeviceText,
      authorizedText: `可见授权设备：visible_devices_count=${numberFmt.format(visibleDevices)} 台；在线 ${numberFmt.format(onlineDevices)} 台。`,
      fieldText: "当前地块设备：field_devices_count 需进入地块报告查看。",
      offlineText: `离线设备：offline_devices_count=${numberFmt.format(offlineDevices)} 台；离线地块 ${numberFmt.format(offlineFields)} 块。`,
      alertText: `告警事件：alert_events_count=${numberFmt.format(alertEvents)} 条。`,
      empty: !aggregate.device_summary,
    },
    roiSummary,
    emptyStates,
  };
}
