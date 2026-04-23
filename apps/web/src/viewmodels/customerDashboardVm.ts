import type { CustomerDashboardAggregateV1 } from "../api/reports";
import {
  CUSTOMER_LABELS,
  labelAcceptanceStatus,
  labelEmptyFallback,
  labelFinalStatus,
  labelRiskLevel,
} from "../lib/customerLabels";

const numberFmt = new Intl.NumberFormat("zh-CN");
const currencyFmt = new Intl.NumberFormat("zh-CN", { style: "currency", currency: "CNY", maximumFractionDigits: 2 });

export type CustomerDashboardPageVm = {
  header: {
    title: string;
    subtitle: string;
  };
  fieldStatus: {
    totalFieldsText: string;
    atRiskText: string;
    highRiskText: string;
    offlineFieldsText: string;
  };
  businessSummary: {
    openAlertsText: string;
    pendingAcceptanceText: string;
    estimatedCostText: string;
    actualCostText: string;
  };
  pendingActions: {
    totalAlertsText: string;
    unassignedText: string;
    inProgressText: string;
    slaBreachedText: string;
    closedTodayText: string;
  };
  topRiskFields: Array<{
    fieldId: string;
    title: string;
    riskText: string;
    reasonText: string;
    openAlertsText: string;
    pendingAcceptanceText: string;
    lastOperationText: string;
    href: string;
  }>;
  recentOperations: Array<{
    operationId: string;
    title: string;
    fieldTitle: string;
    statusText: string;
    acceptanceText: string;
    executedAtText: string;
    href: string;
  }>;
};

export function buildCustomerDashboardVm(aggregate: CustomerDashboardAggregateV1): CustomerDashboardPageVm {
  const highRisk = (aggregate.top_risk_fields || []).filter(
    (x) => String(x.risk_level ?? "").toUpperCase() === "HIGH"
  ).length;

  return {
    header: {
      title: CUSTOMER_LABELS.dashboardTitle,
      subtitle: "经营结果、风险与行动摘要",
    },
    fieldStatus: {
      totalFieldsText: numberFmt.format(Number(aggregate.fields?.total ?? 0)),
      atRiskText: numberFmt.format(Number(aggregate.fields?.at_risk ?? 0)),
      highRiskText: numberFmt.format(highRisk),
      offlineFieldsText: numberFmt.format(Number(aggregate.device_summary?.offline_fields ?? 0)),
    },
    businessSummary: {
      openAlertsText: numberFmt.format(Number(aggregate.pending_actions_summary?.total_open_alerts ?? 0)),
      pendingAcceptanceText: numberFmt.format(Number(aggregate.pending_actions_summary?.pending_acceptance ?? 0)),
      estimatedCostText: currencyFmt.format(Number(aggregate?.period_summary?.estimated_total_cost ?? 0)),
      actualCostText: currencyFmt.format(Number(aggregate?.period_summary?.actual_total_cost ?? 0)),
    },
    pendingActions: {
      totalAlertsText: numberFmt.format(Number(aggregate.pending_actions_summary?.total_open_alerts ?? 0)),
      unassignedText: numberFmt.format(Number(aggregate.pending_actions_summary?.unassigned_alerts ?? 0)),
      inProgressText: numberFmt.format(Number(aggregate.pending_actions_summary?.in_progress_alerts ?? 0)),
      slaBreachedText: numberFmt.format(Number(aggregate.pending_actions_summary?.sla_breached_alerts ?? 0)),
      closedTodayText: numberFmt.format(Number(aggregate.pending_actions_summary?.closed_today_alerts ?? 0)),
    },
    topRiskFields: (aggregate.top_risk_fields ?? []).map((item) => ({
      fieldId: String(item.field_id ?? ""),
      title: String(item.field_name ?? item.field_id ?? "未知地块"),
      riskText: labelRiskLevel(item.risk_level),
      reasonText: (item.risk_reasons ?? []).map((reason) => labelEmptyFallback(reason)).join("、") || "-",
      openAlertsText: numberFmt.format(Number(item.open_alerts_count ?? 0)),
      pendingAcceptanceText: numberFmt.format(Number(item.pending_acceptance_count ?? 0)),
      lastOperationText: item.last_operation_at ? new Date(item.last_operation_at).toLocaleString("zh-CN", { hour12: false }) : "时间未知",
      href: `/fields/${encodeURIComponent(String(item.field_id ?? ""))}`,
    })),
    recentOperations: (aggregate.recent_operations ?? []).map((item) => ({
      operationId: String(item.operation_id ?? item.operation_plan_id ?? ""),
      title: String(item.customer_title ?? item.title ?? item.operation_id ?? "作业"),
      fieldTitle: String(item.field_name ?? item.field_id ?? "未知地块"),
      statusText: labelFinalStatus(item.final_status),
      acceptanceText: labelAcceptanceStatus(item.acceptance_status),
      executedAtText: item.executed_at ? new Date(item.executed_at).toLocaleString("zh-CN", { hour12: false }) : "时间未知",
      href: `/operations?operation_plan_id=${encodeURIComponent(String(item.operation_plan_id ?? item.operation_id ?? ""))}`,
    })),
  };
}
