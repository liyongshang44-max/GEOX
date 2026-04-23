import type { CustomerDashboardAggregateV1 } from "../api/reports";

const numberFmt = new Intl.NumberFormat("zh-CN");
const currencyFmt = new Intl.NumberFormat("zh-CN", { style: "currency", currency: "CNY", maximumFractionDigits: 2 });

export type CustomerDashboardVm = {
  header: {
    title: string;
    description: string;
  };
  fieldStatus: {
    totalFieldsText: string;
    atRiskText: string;
    highRiskText: string;
    offlineFieldsText: string;
  };
  businessSummary: {
    totalOpenAlertsText: string;
    pendingAcceptanceText: string;
    estimatedCostText: string;
    actualCostText: string;
  };
  pendingActions: {
    totalOpenAlertsText: string;
    unassignedAlertsText: string;
    inProgressAlertsText: string;
    slaBreachedAlertsText: string;
    closedTodayAlertsText: string;
  };
  topRiskFields: Array<{
    fieldId: string;
    fieldName: string;
    riskLevelText: string;
    openAlertsText: string;
    pendingAcceptanceText: string;
    lastOperationText: string;
  }>;
  recentOperations: Array<{
    operationId: string;
    title: string;
    fieldName: string;
    statusText: string;
    executedAtText: string;
  }>;
  periodSummary: {
    estimatedCostText: string;
    actualCostText: string;
  };
};

export function buildCustomerDashboardVm(aggregate: CustomerDashboardAggregateV1): CustomerDashboardVm {
  const highRisk = (aggregate.top_risk_fields || []).filter(
    (x) => String(x.risk_level ?? "").toUpperCase() === "HIGH"
  ).length;

  return {
    header: {
      title: "客户看板",
      description: "经营结果、风险与行动摘要",
    },
    fieldStatus: {
      totalFieldsText: numberFmt.format(Number(aggregate.fields?.total ?? 0)),
      atRiskText: numberFmt.format(Number(aggregate.fields?.at_risk ?? 0)),
      highRiskText: numberFmt.format(highRisk),
      offlineFieldsText: numberFmt.format(Number(aggregate.device_summary?.offline_fields ?? 0)),
    },
    businessSummary: {
      totalOpenAlertsText: numberFmt.format(Number(aggregate.pending_actions_summary?.total_open_alerts ?? 0)),
      pendingAcceptanceText: numberFmt.format(Number(aggregate.pending_actions_summary?.pending_acceptance ?? 0)),
      estimatedCostText: currencyFmt.format(Number(aggregate?.period_summary?.estimated_total_cost ?? 0)),
      actualCostText: currencyFmt.format(Number(aggregate?.period_summary?.actual_total_cost ?? 0)),
    },
    pendingActions: {
      totalOpenAlertsText: numberFmt.format(Number(aggregate.pending_actions_summary?.total_open_alerts ?? 0)),
      unassignedAlertsText: numberFmt.format(Number(aggregate.pending_actions_summary?.unassigned_alerts ?? 0)),
      inProgressAlertsText: numberFmt.format(Number(aggregate.pending_actions_summary?.in_progress_alerts ?? 0)),
      slaBreachedAlertsText: numberFmt.format(Number(aggregate.pending_actions_summary?.sla_breached_alerts ?? 0)),
      closedTodayAlertsText: numberFmt.format(Number(aggregate.pending_actions_summary?.closed_today_alerts ?? 0)),
    },
    topRiskFields: (aggregate.top_risk_fields ?? []).map((item) => ({
      fieldId: String(item.field_id ?? ""),
      fieldName: String(item.field_name ?? item.field_id ?? "未知地块"),
      riskLevelText: String(item.risk_level ?? "UNKNOWN"),
      openAlertsText: numberFmt.format(Number(item.open_alerts_count ?? 0)),
      pendingAcceptanceText: numberFmt.format(Number(item.pending_acceptance_count ?? 0)),
      lastOperationText: item.last_operation_at ? new Date(item.last_operation_at).toLocaleString("zh-CN", { hour12: false }) : "时间未知",
    })),
    recentOperations: (aggregate.recent_operations ?? []).map((item) => ({
      operationId: String(item.operation_id ?? item.operation_plan_id ?? ""),
      title: String(item.customer_title ?? item.title ?? item.operation_id ?? "作业"),
      fieldName: String(item.field_name ?? item.field_id ?? "未知地块"),
      statusText: String(item.final_status ?? item.acceptance_status ?? "UNKNOWN"),
      executedAtText: item.executed_at ? new Date(item.executed_at).toLocaleString("zh-CN", { hour12: false }) : "时间未知",
    })),
    periodSummary: {
      estimatedCostText: currencyFmt.format(Number(aggregate?.period_summary?.estimated_total_cost ?? 0)),
      actualCostText: currencyFmt.format(Number(aggregate?.period_summary?.actual_total_cost ?? 0)),
    },
  };
}
