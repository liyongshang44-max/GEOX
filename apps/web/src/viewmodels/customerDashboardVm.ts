import type { CustomerDashboardAggregateV1 } from "../api/customerReports";
import {
  CUSTOMER_LABELS,
  labelAcceptanceStatus,
  labelFinalStatus,
  labelRiskLevel,
  sanitizeCustomerText,
} from "../lib/customerLabels";

const numberFmt = new Intl.NumberFormat("zh-CN");

function toDateTimeText(raw: string | null | undefined): string {
  return raw ? new Date(raw).toLocaleString("zh-CN", { hour12: false }) : "时间未知";
}

export type CustomerDashboardPageVm = {
  header: {
    eyebrow: string;
    title: string;
    subtitle: string;
    exportAction: { label: string; href: string };
  };
  kpis: Array<{
    key: "pendingApproval" | "highRiskFields" | "earlyWarnings" | "pendingAcceptance" | "weeklyWaterSaved" | "managedFields";
    label: string;
    valueText: string;
    detailText: string;
  }>;
  topRiskFields: Array<{
    id: string;
    rowText: string;
    href: string;
  }>;
  pendingItems: Array<{
    id: string;
    sentence: string;
    href: string;
  }>;
  recentOperations: Array<{
    operationId: string;
    rowText: string;
    href: string;
  }>;
  nextActions: Array<{ id: string; title: string; summary: string; href: string }>;
  roiSummary: {
    totalRoiItems: number;
    waterSavedItems: number;
    customerValueText: string;
  };
};

export function normalizeDashboardAggregate(input: any): CustomerDashboardAggregateV1 {
  if (!input || typeof input !== "object") return (input ?? {}) as CustomerDashboardAggregateV1;
  if ("aggregate" in input) return normalizeDashboardAggregate(input.aggregate);
  if ("customer_dashboard_aggregate_v1" in input) return normalizeDashboardAggregate(input.customer_dashboard_aggregate_v1);
  if ("data" in input) return normalizeDashboardAggregate(input.data);
  return input as CustomerDashboardAggregateV1;
}

export function buildCustomerDashboardVm(input: CustomerDashboardAggregateV1 | { aggregate?: CustomerDashboardAggregateV1; customer_dashboard_aggregate_v1?: CustomerDashboardAggregateV1; data?: CustomerDashboardAggregateV1 }): CustomerDashboardPageVm {
  const aggregate = normalizeDashboardAggregate(input);
  const highRisk = Number(aggregate.fields?.at_risk ?? 0);
  const earlyWarnings = Number(aggregate.roi_summary?.early_warning_items ?? 0);
  const pendingAcceptance = Number(aggregate.pending_actions_summary?.pending_acceptance ?? 0);
  const pendingApproval = Number(aggregate.pending_actions_summary?.total_open_alerts ?? 0);
  const weeklyWaterSaved = Number(aggregate.roi_summary?.water_saved_items ?? 0);
  const managedFields = Number(aggregate.fields?.total ?? 0);

  return {
    header: {
      eyebrow: "GEOX / 客户看板",
      title: CUSTOMER_LABELS.dashboardTitle,
      subtitle: "经营结果、风险与行动摘要",
      exportAction: { label: "打印导出", href: "/customer/reports" },
    },
    kpis: [
      { key: "pendingApproval", label: "待审批处方", valueText: numberFmt.format(pendingApproval), detailText: "条待处理告警" },
      { key: "highRiskFields", label: "高风险地块", valueText: numberFmt.format(highRisk), detailText: "块需重点跟进" },
      { key: "earlyWarnings", label: "提前发现异常", valueText: numberFmt.format(earlyWarnings), detailText: "项异常提示" },
      { key: "pendingAcceptance", label: "待验收作业", valueText: numberFmt.format(pendingAcceptance), detailText: "条待回写结果" },
      { key: "weeklyWaterSaved", label: "本周节水", valueText: numberFmt.format(weeklyWaterSaved), detailText: "次节水建议" },
      { key: "managedFields", label: "管理地块", valueText: numberFmt.format(managedFields), detailText: "块在管地块" },
    ],
    topRiskFields: (aggregate.top_risk_fields ?? []).slice(0, 5).map((item) => ({
      id: String(item.field_id ?? ""),
      rowText: `${String(item.field_name ?? "C8-03 地块")} · ${labelRiskLevel(item.risk_level)} · ${((item.risk_reasons ?? []).map((reason) => sanitizeCustomerText(reason)).join("、") || "-")}`,
      href: `/customer/fields/${encodeURIComponent(String(item.field_id ?? ""))}`,
    })),
    pendingItems: [
      {
        id: "alerts",
        sentence: `审批 ${numberFmt.format(pendingApproval)} 条灌溉处方`,
        href: "/customer/approvals",
      },
      {
        id: "risks",
        sentence: `查看 ${numberFmt.format(highRisk)} 个高风险地块`,
        href: "#top-risk-fields",
      },
      {
        id: "acceptance",
        sentence: `验收 ${numberFmt.format(pendingAcceptance)} 个已完成作业`,
        href: "/customer/acceptance",
      },
      {
        id: "devices",
        sentence: `复核 ${numberFmt.format(Number(aggregate.device_summary?.offline_devices ?? 0))} 台离线设备`,
        href: "/customer/devices",
      },
    ],
    recentOperations: (aggregate.recent_operations ?? []).slice(0, 5).map((item) => ({
      operationId: String(item.operation_id ?? item.operation_plan_id ?? ""),
      rowText: `${sanitizeCustomerText(item.customer_title ?? item.title ?? "作业")} · ${String(item.field_name ?? "C8-03 地块")} · ${toDateTimeText(item.executed_at)} · ${(item.acceptance_status === null || item.acceptance_status === undefined || item.acceptance_status === "") ? labelFinalStatus(item.final_status) : labelAcceptanceStatus(item.acceptance_status)}`,
      href: `/customer/operations/${encodeURIComponent(String(item.operation_plan_id ?? item.operation_id ?? ""))}`,
    })),
    nextActions: [
      { id: "approve", title: "优先完成今日待审批处方", summary: "降低处方积压，保障关键风险先处置。", href: "/customer/approvals" },
      { id: "risk", title: "集中处理高风险地块", summary: "按风险等级推进复核，避免问题扩大。", href: "#top-risk-fields" },
      { id: "accept", title: "完成待验收作业并回写结果", summary: "确保作业闭环，提升验收及时率。", href: "/customer/acceptance" },
      { id: "device", title: "排查离线设备并恢复数据", summary: "优先恢复离线地块数据采集能力。", href: "/customer/devices" },
    ],
    roiSummary: {
      totalRoiItems: Number(aggregate.roi_summary?.total_roi_items ?? 0),
      waterSavedItems: Number(aggregate.roi_summary?.water_saved_items ?? 0),
      customerValueText: sanitizeCustomerText(aggregate.roi_summary?.customer_value_text ?? "暂无收益摘要"),
    },
  };
}
