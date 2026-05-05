import type { CustomerDashboardAggregateV1 } from "../api/customerReports";
import {
  CUSTOMER_LABELS,
  labelAcceptanceStatus,
  labelEmptyFallback,
  labelFinalStatus,
  labelRiskLevel,
} from "../lib/customerLabels";

const numberFmt = new Intl.NumberFormat("zh-CN");
const currencyFmt = new Intl.NumberFormat("zh-CN", { style: "currency", currency: "CNY", maximumFractionDigits: 2 });

function toDateTimeText(raw: string | null | undefined): string {
  return raw ? new Date(raw).toLocaleString("zh-CN", { hour12: false }) : "时间未知";
}

export type CustomerDashboardPageVm = {
  header: {
    title: string;
    subtitle: string;
    primaryAction: { label: "立即审批"; href: string };
    secondaryAction: { label: "检查设备"; href: string };
  };
  kpis: Array<{
    key: "pendingApproval" | "highRiskFields" | "earlyWarnings" | "pendingAcceptance" | "weeklyWaterSaved" | "managedFields";
    label: string;
    valueText: string;
  }>;
  topRiskFields: Array<{
    id: string;
    title: string;
    summary: string;
    meta: string;
    href: string;
  }>;
  pendingItems: Array<{
    id: string;
    title: string;
    summary: string;
    actionLabel: "立即审批" | "查看风险" | "开始验收" | "检查设备";
    href: string;
  }>;
  recentOperations: Array<{
    operationId: string;
    title: string;
    summary: string;
    href: string;
  }>;
  nextActions: Array<{ id: string; title: string; href: string }>;
  roiSummary: {
    valueText: string;
    confidenceText: string;
  };
};

export function buildCustomerDashboardVm(aggregate: CustomerDashboardAggregateV1): CustomerDashboardPageVm {
  const highRisk = (aggregate.top_risk_fields || []).filter((x) => String(x.risk_level ?? "").toUpperCase() === "HIGH").length;
  const earlyWarnings = Number(aggregate.roi_summary?.early_warning_items ?? 0);
  const pendingAcceptance = Number(aggregate.pending_actions_summary?.pending_acceptance ?? 0);
  const pendingApproval = Number(aggregate.pending_actions_summary?.total_open_alerts ?? 0);

  return {
    header: {
      title: CUSTOMER_LABELS.dashboardTitle,
      subtitle: "经营结果、风险与行动摘要",
      primaryAction: { label: "立即审批", href: "/customer/approvals" },
      secondaryAction: { label: "检查设备", href: "/customer/devices" },
    },
    kpis: [
      { key: "pendingApproval", label: "待审批处方", valueText: numberFmt.format(pendingApproval) },
      { key: "highRiskFields", label: "高风险地块", valueText: numberFmt.format(highRisk) },
      { key: "earlyWarnings", label: "提前发现异常", valueText: numberFmt.format(earlyWarnings) },
      { key: "pendingAcceptance", label: "待验收作业", valueText: numberFmt.format(pendingAcceptance) },
      { key: "weeklyWaterSaved", label: "本周节水", valueText: numberFmt.format(Number(aggregate.roi_summary?.water_saved_items ?? 0)) },
      { key: "managedFields", label: "管理地块", valueText: numberFmt.format(Number(aggregate.fields?.total ?? 0)) },
    ],
    topRiskFields: (aggregate.top_risk_fields ?? []).map((item) => ({
      id: String(item.field_id ?? ""),
      title: String(item.field_name ?? item.field_id ?? "未知地块"),
      summary: `风险 ${labelRiskLevel(item.risk_level)} · ${((item.risk_reasons ?? []).map((reason) => labelEmptyFallback(reason)).join("、") || "-")}`,
      meta: `告警 ${numberFmt.format(Number(item.open_alerts_count ?? 0))} · 待验收 ${numberFmt.format(Number(item.pending_acceptance_count ?? 0))} · 最近作业 ${toDateTimeText(item.last_operation_at)}`,
      href: `/customer/fields/${encodeURIComponent(String(item.field_id ?? ""))}`,
    })),
    pendingItems: [
      {
        id: "alerts",
        title: "待审批处方",
        summary: `当前有 ${numberFmt.format(pendingApproval)} 条待处理告警。`,
        actionLabel: "立即审批",
        href: "/customer/approvals",
      },
      {
        id: "risks",
        title: "高风险地块",
        summary: `共 ${numberFmt.format(highRisk)} 个高风险地块需要跟进。`,
        actionLabel: "查看风险",
        href: "#top-risk-fields",
      },
      {
        id: "acceptance",
        title: "待验收作业",
        summary: `待验收作业 ${numberFmt.format(pendingAcceptance)} 条。`,
        actionLabel: "开始验收",
        href: "/customer/acceptance",
      },
      {
        id: "devices",
        title: "设备离线巡检",
        summary: `离线地块 ${numberFmt.format(Number(aggregate.device_summary?.offline_fields ?? 0))} 个。`,
        actionLabel: "检查设备",
        href: "/customer/devices",
      },
    ],
    recentOperations: (aggregate.recent_operations ?? []).map((item) => ({
      operationId: String(item.operation_id ?? item.operation_plan_id ?? ""),
      title: String(item.customer_title ?? item.title ?? item.operation_id ?? "作业"),
      summary: `地块 ${String(item.field_name ?? item.field_id ?? "未知地块")} · ${labelFinalStatus(item.final_status)} · ${labelAcceptanceStatus(item.acceptance_status)} · ${toDateTimeText(item.executed_at)}`,
      href: `/customer/operations/${encodeURIComponent(String(item.operation_plan_id ?? item.operation_id ?? ""))}`,
    })),
    nextActions: [
      { id: "approve", title: "优先完成今日待审批处方", href: "/customer/approvals" },
      { id: "risk", title: "集中处理高风险地块", href: "#top-risk-fields" },
      { id: "accept", title: "完成待验收作业并回写结果", href: "/customer/acceptance" },
      { id: "device", title: "排查离线设备并恢复数据", href: "/customer/devices" },
    ],
    roiSummary: {
      valueText: String(aggregate.roi_summary?.customer_value_text ?? "暂无价值记录"),
      confidenceText: `价值记录 ${numberFmt.format(Number(aggregate.roi_summary?.total_roi_items ?? 0))} 条，低置信度 ${numberFmt.format(Number(aggregate.roi_summary?.low_confidence_items ?? 0))} 条。`,
    },
  };
}
