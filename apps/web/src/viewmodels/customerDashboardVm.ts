import type { CustomerDashboardAggregateV1 } from "../api/customerReports";
import { CUSTOMER_LABELS, labelRiskLevel, sanitizeCustomerText } from "../lib/customerLabels";
import { getCustomerEmptyState } from "../lib/customerEmptyStates";
import { customerDisplayName, customerSemanticLabel } from "../lib/customerSemanticLabels";
import { customerEvidenceStateText, customerFormalChainText, customerNeedsReviewText } from "../lib/customerSafeText";
import { customerGuardedAcceptanceText, customerGuardedEvidenceText, customerGuardedStatusText, customerTrustScopeText, customerValueSummaryText, isTrustedDashboardValueSummary } from "../lib/customerTrustGate";
import { buildFormalScenarioVm } from "../lib/formalScenarioViewModel";
import { resolveUnifiedOperationFinalStatus } from "../lib/operationStatusUnified";

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


function withUnifiedOperationState<T extends Record<string, any>>(item: T): T {
  const finalStatus = resolveUnifiedOperationFinalStatus({
    final_status: item.final_status ?? null,
    operation_state_v1: item.operation_state_v1 ?? null,
    operation: item.operation ?? null,
  });
  if (finalStatus === "UNKNOWN") return item;
  return { ...item, final_status: finalStatus };
}

function roiCustomerText(summary: CustomerDashboardAggregateV1["roi_summary"] | undefined): string {
  const total = num(summary?.total_roi_items);
  return customerValueSummaryText(summary, total, (n) => numberFmt.format(n));
}

function deviceVisibilityText(visibleDevices: number, offlineDevices: number): string {
  return `当前可见授权设备共 ${numberFmt.format(visibleDevices)} 台，其中 ${numberFmt.format(offlineDevices)} 台离线。`;
}

function deviceAlertText(alertEvents: number): string {
  return alertEvents > 0 ? `当前发现 ${numberFmt.format(alertEvents)} 条告警事件。` : "当前未发现告警事件。";
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

export type CustomerUsagePathVm = {
  title: string;
  statusText: string;
  orderTitle: string;
  steps: string[];
  actions: Array<{ label: string; href: string }>;
  formalityNote: string;
};

export type CustomerGuidanceCardVm = {
  id: "risk" | "device" | "operations" | "export";
  title: string;
  currentStatus: string;
  why: string;
  nextStep: string;
  formality: string;
  action: { label: string; href: string };
};

export type CustomerDashboardVm = {
  generatedAtText: string;
  context: { title: string; subtitle: string; actorRoleText: string; scopeText: string };
  header: { eyebrow: string; title: string; subtitle: string; exportAction: { label: string; href: string } };
  summaryScopeText: string;
  usagePath: CustomerUsagePathVm;
  guidanceCards: CustomerGuidanceCardVm[];
  kpis: CustomerKpiVm[];
  topRiskFields: CustomerRiskFieldVm[];
  pendingItems: Array<{ id: string; sentence: string; href: string }>;
  recentOperations: Array<{ operationId: string; operationName: string; fieldName: string; stateText: string; acceptanceText: string; evidenceText: string; scenarioSummaryText: string; scenarioTypeText: string; formalChainStatusText: string; evidenceStatusText: string; needsReviewText: string; updatedAtText: string; href: string }>;
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
    whyText: string;
    nextStepText: string;
    formalityText: string;
    empty: boolean;
  };
  roiSummary: {
    totalRoiItems: number;
    waterSavedItems: number;
    customerValueText: string;
    confidenceText?: string;
    assumptionText?: string;
    scopeText: string;
    currentStatus: string;
    whyText: string;
    nextStepText: string;
    formalityText: string;
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
  currentStatus: string;
  why: string;
  nextStep: string;
  formality: string;
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
  const globalDeviceText = globalDevices === null ? "当前未返回全域设备摘要，客户页不推断未授权设备。" : `当前设备摘要仅用于授权范围展示；全域设备共 ${numberFmt.format(globalDevices)} 台。`;
  const visibleDeviceText = deviceVisibilityText(visibleDevices, offlineDevices);
  const alertText = deviceAlertText(alertEvents);
  const deviceScopeText = "当前页仅展示客户可见授权设备，不推断未授权设备或当前地块设备。";
  const firstRiskFieldId = String((aggregate.top_risk_fields ?? [])[0]?.field_id ?? "");
  const firstRiskFieldHref = firstRiskFieldId ? `/customer/fields/${encodeURIComponent(firstRiskFieldId)}` : "/customer/dashboard";
  const firstOperationId = String((aggregate.recent_operations ?? [])[0]?.operation_id ?? (aggregate.recent_operations ?? [])[0]?.operation_plan_id ?? "");
  const firstOperationHref = firstOperationId ? `/customer/operations/${encodeURIComponent(firstOperationId)}` : "/customer/dashboard";
  const trustedValueStatus = trustedValueSummary && valueRecords > 0 ? "已有可信价值记录" : "暂无可信价值记录";
  const operatingStatusText = `有 ${numberFmt.format(highRisk)} 块地块需要关注，${numberFmt.format(offlineDevices)} 台设备离线，${trustedValueStatus}。`;
  const exportFormalityNote = "导出报告可直接用于客户或管理层复盘；待复核结论会在附注中标明，不能当作正式收益或验收结论。";
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
    { key: "OPEN_ACTIONS", label: "待处理事项", value: numberFmt.format(pendingActions), unit: "条", tone: pendingActions > 0 ? "warning" : "good", sourceNote: "客户看板统一摘要中的待处理事项", customerHint: `${DASHBOARD_SUMMARY_SOURCE} 建议优先处理高风险相关待办。` },
    { key: "RISK_FIELDS", label: "风险地块", value: numberFmt.format(highRisk), unit: "块", tone: highRisk > 0 ? "danger" : "good", sourceNote: "客户看板统一摘要中的风险地块", customerHint: `${DASHBOARD_SUMMARY_SOURCE} 点击中部风险面板可查看地块详情。` },
    { key: "PENDING_ACCEPTANCE", label: "待验收作业", value: numberFmt.format(pendingAcceptance), unit: "条", tone: pendingAcceptance > 0 ? "warning" : "good", sourceNote: "客户看板统一摘要中的待验收作业", customerHint: `${DASHBOARD_SUMMARY_SOURCE} 与作业列表使用同一客户摘要来源。` },
    { key: "OFFLINE_DEVICES", label: "离线设备", value: numberFmt.format(offlineDevices), unit: "台", tone: offlineDevices > 0 ? "warning" : "good", sourceNote: "客户看板统一摘要中的离线设备", customerHint: `${visibleDeviceText} ${deviceScopeText}` },
    { key: "VALUE_RECORDS", label: trustedValueSummary ? "可信价值记录" : "价值线索", value: numberFmt.format(valueRecords), unit: "条", tone: trustedValueSummary && valueRecords > 0 ? "good" : "neutral", sourceNote: "客户看板统一摘要中的价值记录", customerHint: `${DASHBOARD_SUMMARY_SOURCE} ${customerTrustScopeText()}` },
    { key: "RECENT_OPERATIONS", label: "作业记录", value: numberFmt.format(totalOperations), unit: "条", tone: "neutral", sourceNote: "客户看板统一摘要中的作业记录", customerHint: `${DASHBOARD_SUMMARY_SOURCE} 下方仅展示最近 5 条作业。`, disabledReason: "顶部指标仅展示 5 项，近期作业在列表区展示。" },
  ];
  const topRiskFields: CustomerRiskFieldVm[] = (aggregate.top_risk_fields ?? []).slice(0, 5).map((item, index) => {
    const fieldId = String(item.field_id ?? "");
    const riskTone = item.risk_level === "HIGH" ? "danger" : item.risk_level === "MEDIUM" ? "warning" : "neutral";
    const boundaryAvailable = fieldBoundaryAvailable(item);
    const fieldName = customerDisplayName(item.field_name, `未命名地块 ${index + 1}`);
    return { fieldId, fieldName, secondaryText: item.field_name ? "授权地块" : "名称待补充，按授权地块序号显示", riskLabel: labelRiskLevel(item.risk_level), riskTone, reasons: (item.risk_reasons ?? []).map((reason) => customerSemanticLabel(reason)).filter(Boolean), boundaryAvailable, boundaryText: boundaryAvailable ? "地块边界：已接入" : "地块边界：暂未接入", href: fieldId ? `/customer/fields/${encodeURIComponent(fieldId)}` : "/customer/dashboard" };
  });
  const recentOperations: CustomerDashboardVm["recentOperations"] = (aggregate.recent_operations ?? []).slice(0, 5).map((item) => {
    const operationId = String(item.operation_id ?? item.operation_plan_id ?? "");
    const statusItem = withUnifiedOperationState(item as any);
    const formalVm = buildFormalScenarioVm(statusItem);
    return {
      operationId,
      operationName: customerDisplayName(item.customer_title ?? item.title, "未命名作业"),
      fieldName: customerDisplayName(item.field_name, "未命名地块"),
      stateText: customerGuardedStatusText(statusItem),
      acceptanceText: customerGuardedAcceptanceText(statusItem),
      evidenceText: customerGuardedEvidenceText(statusItem),
      scenarioSummaryText: [formalVm.scenarioLabel, formalVm.chainText, formalVm.evidenceText].filter(Boolean).join("｜"),
      scenarioTypeText: formalVm.scenarioLabel,
      formalChainStatusText: customerFormalChainText(formalVm.formalChainStatus),
      evidenceStatusText: customerEvidenceStateText(formalVm.rawEvidenceStatus),
      needsReviewText: customerNeedsReviewText(formalVm.needsReview),
      updatedAtText: toDateTimeText((item as any).updated_at ?? item.executed_at),
      href: operationId ? `/customer/operations/${encodeURIComponent(operationId)}` : "/customer/dashboard",
    };
  });
  const actionItems: CustomerActionItemVm[] = [
    { id: "risk", source: "RECOMMENDATION", title: "集中处理高风险地块", riskLabel: "高风险", riskTone: "danger", fieldId: firstRiskFieldId, primaryAction: { label: "查看地块", href: firstRiskFieldHref }, summary: `${DASHBOARD_SUMMARY_SOURCE} 按风险等级推进复核，避免问题扩大。`, currentStatus: `${numberFmt.format(highRisk)} 块地块需要关注。`, why: "风险来自地块状态、作业证据或设备数据的综合判断。", nextStep: "先打开高风险地块，查看风险原因和最近作业证据。", formality: "风险提示用于排查优先级，不等同于正式验收或收益结论。" },
    { id: "accept", source: "PENDING_ACCEPTANCE", title: "完成待验收作业并回写结果", riskLabel: pendingAcceptance > 0 ? "待验收" : "已完成", riskTone: pendingAcceptance > 0 ? "warning" : "neutral", operationId: firstOperationId, primaryAction: { label: "查看作业", href: firstOperationHref }, summary: `${DASHBOARD_SUMMARY_SOURCE} 确保作业闭环，提升验收及时率。`, currentStatus: `${numberFmt.format(pendingAcceptance)} 条作业等待验收或复核。`, why: "未完成验收会影响客户对作业结果、证据完整性和价值结论的判断。", nextStep: "查看最近作业证据，确认是否具备正式验收条件。", formality: "证据不足或未验收前，不生成正式客户价值结论。" },
    { id: "device", source: "DEVICE_OFFLINE", title: "排查离线设备并恢复数据", riskLabel: offlineDevices > 0 ? "需复核" : "稳定", riskTone: offlineDevices > 0 ? "warning" : "neutral", primaryAction: { label: offlineDevices > 0 ? "查看受影响地块" : "查看设备状态", href: firstRiskFieldHref }, summary: "离线设备需由运营人员复核最近心跳、遥测和绑定地块。客户侧先查看受影响地块与作业证据；未完成复核前不展示执行成功或价值结论。", currentStatus: `${numberFmt.format(offlineDevices)} 台设备离线。`, why: "设备最近心跳或遥测未返回，可能影响地块状态判断和作业证据可信度。", nextStep: "查看受影响地块，等待运营人员复核设备状态。", formality: "设备恢复和人工复核前，不展示执行成功或价值结论。" },
    { id: "general", source: "GENERAL", title: "处理待办事项", riskLabel: pendingActions > 0 ? "待处理" : "已清空", riskTone: pendingActions > 0 ? "warning" : "neutral", primaryAction: { label: "当前页查看", href: "/customer/dashboard" }, summary: `${DASHBOARD_SUMMARY_SOURCE} 优先关闭待处理事项，保障关键风险先处置。`, currentStatus: `${numberFmt.format(pendingActions)} 条待处理事项。`, why: "待办事项是客户需要继续追踪的风险、审批、验收或证据问题。", nextStep: "按建议处理顺序逐项进入地块、设备和作业报告。", formality: "待办关闭前，相关结论仍需保留复核提示。" },
  ];
  const roiSummary = {
    totalRoiItems: valueRecords,
    waterSavedItems: num(aggregate.roi_summary?.water_saved_items),
    customerValueText: roiCustomerText(aggregate.roi_summary),
    confidenceText: sanitizeCustomerText((aggregate.roi_summary as any)?.confidence_text ?? (trustedValueSummary ? "已通过正式价值门禁" : "未通过正式价值门禁，不形成可信收益结论")),
    assumptionText: sanitizeCustomerText((aggregate.roi_summary as any)?.assumption_text ?? `假设型/估算型记录 ${numberFmt.format(num(aggregate.roi_summary?.assumption_based_items) + num(aggregate.roi_summary?.estimated_items))} 条`),
    scopeText: `${DASHBOARD_SUMMARY_SOURCE} ${customerTrustScopeText()}`,
    currentStatus: trustedValueSummary && valueRecords > 0 ? `已有 ${numberFmt.format(valueRecords)} 条可信价值记录。` : "暂无可正式使用的可信价值记录。",
    whyText: "价值记录必须来自正式链路和可解释证据，不能只凭估算或设备异常期间的数据形成。",
    nextStepText: "查看价值记录明细；若缺少基线、证据或验收，先补齐复核。",
    formalityText: "未通过正式价值门禁的记录只能作为线索，不能直接给客户或管理层作为 ROI 结论。",
    emptyState: emptyStates.NO_ROI,
  };
  const usagePath: CustomerUsagePathVm = {
    title: "当前经营状态",
    statusText: operatingStatusText,
    orderTitle: "建议处理顺序：",
    steps: ["查看高风险地块", "排查离线设备", "查看最近作业证据", "导出客户报告"],
    actions: [
      { label: "查看高风险地块", href: "#top-risk-fields" },
      { label: "排查离线设备", href: "#device-health" },
      { label: "查看最近作业", href: "#recent-operations" },
      { label: "导出报告", href: "/customer/export" },
    ],
    formalityNote: exportFormalityNote,
  };
  const guidanceCards: CustomerGuidanceCardVm[] = [
    { id: "risk", title: "风险地块", currentStatus: `${numberFmt.format(highRisk)} 块地块需要关注。`, why: "风险来自地块状态、近期作业和证据完整性的综合判断。", nextStep: "先查看高风险地块，确认风险原因和可用证据。", formality: "风险提示用于处理优先级，不替代正式验收结论。", action: { label: "查看高风险地块", href: "#top-risk-fields" } },
    { id: "device", title: "离线设备", currentStatus: `${numberFmt.format(offlineDevices)} 台离线。`, why: "设备最近心跳或遥测未返回，可能影响地块状态判断。", nextStep: "查看受影响地块，等待运营人员复核设备状态。", formality: "设备恢复和人工复核前，不展示执行成功或价值结论。", action: { label: "排查离线设备", href: "#device-health" } },
    { id: "operations", title: "最近作业证据", currentStatus: `最近展示 ${numberFmt.format(recentOperations.length)} 条作业记录。`, why: "作业证据决定能否形成正式验收、客户报告和后续田块记忆。", nextStep: "打开最近作业，查看证据状态、验收状态和复核提示。", formality: "证据不足或待复核作业不能生成正式价值结论。", action: { label: "查看最近作业", href: "#recent-operations" } },
    { id: "export", title: "客户报告", currentStatus: exportFormalityNote, why: "报告需要把风险、待办、作业、设备、证据和价值记录放在同一客户语境下。", nextStep: "导出报告前确认附注中的待复核结论。", formality: "报告可以用于客户沟通；待复核结论必须按附注说明使用。", action: { label: "导出报告", href: "/customer/export" } },
  ];

  return {
    generatedAtText,
    context: { title: CUSTOMER_LABELS.dashboardTitle, subtitle: "经营结果、风险与行动摘要", actorRoleText: "客户", scopeText: "当前可见授权经营范围" },
    header: { eyebrow: "GEOX / 客户看板", title: CUSTOMER_LABELS.dashboardTitle, subtitle: "经营结果、风险与行动摘要", exportAction: { label: "总览导出", href: "/customer/export" } },
    summaryScopeText: `${DASHBOARD_SUMMARY_SOURCE} ${customerTrustScopeText()}`,
    usagePath,
    guidanceCards,
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
      scopeText: deviceScopeText,
      globalText: globalDeviceText,
      authorizedText: visibleDeviceText,
      fieldText: "当前地块设备请进入地块报告查看。",
      offlineText: offlineDevices > 0 ? `需优先复核 ${numberFmt.format(offlineDevices)} 台离线设备。` : "当前没有离线设备。",
      alertText,
      whyText: "设备最近心跳或遥测未返回，可能影响地块状态判断和作业证据可信度。",
      nextStepText: "由运营人员复核设备状态；客户侧先查看受影响地块和最近作业证据。",
      formalityText: "设备恢复和人工复核前，不展示执行成功、客户 ROI 或 Field Memory 结论。",
      empty: !aggregate.device_summary,
    },
    roiSummary,
    emptyStates,
  };
}
