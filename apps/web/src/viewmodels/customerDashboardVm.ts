import type { CustomerDashboardAggregateV1 } from "../api/reports";

const numberFmt = new Intl.NumberFormat("zh-CN");
const currencyFmt = new Intl.NumberFormat("zh-CN", { style: "currency", currency: "CNY", maximumFractionDigits: 2 });

const RISK_TEXT: Record<string, string> = {
  LOW: "低",
  MEDIUM: "中",
  HIGH: "高",
  CRITICAL: "严重",
};

const FINAL_STATUS_TEXT: Record<string, string> = {
  SUCCESS: "已完成",
  SUCCEEDED: "已完成",
  PENDING_ACCEPTANCE: "待验收",
  INVALID_EXECUTION: "执行异常",
  FAILED: "执行失败",
  ERROR: "错误",
  NOT_EXECUTED: "未执行",
  RUNNING: "执行中",
  PENDING: "待处理",
};

const ACCEPTANCE_STATUS_TEXT: Record<string, string> = {
  PASS: "通过",
  FAIL: "未通过",
  PENDING: "待验收",
  NOT_AVAILABLE: "不适用",
};

export type CustomerDashboardPageVm = {
  header: {
    title: string;
    subtitle: string;
  };
  fieldStatus: {
    totalFieldsText: string;
    atRiskText: string;
    criticalText: string;
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

function fmtDateTime(v: string | null | undefined): string {
  if (!v) return "时间未知";
  const ms = Date.parse(v);
  if (!Number.isFinite(ms)) return "时间未知";
  return new Date(ms).toLocaleString("zh-CN", { hour12: false });
}

function toRiskText(raw: unknown): string {
  const key = String(raw ?? "").trim().toUpperCase();
  return RISK_TEXT[key] ?? "未知";
}

function toFinalStatusText(raw: unknown): string {
  const key = String(raw ?? "").trim().toUpperCase();
  return FINAL_STATUS_TEXT[key] ?? (key || "未知");
}

function toAcceptanceStatusText(raw: unknown): string {
  const key = String(raw ?? "").trim().toUpperCase();
  if (!key) return "待确认";
  return ACCEPTANCE_STATUS_TEXT[key] ?? key;
}

export function buildCustomerDashboardVm(aggregate: CustomerDashboardAggregateV1): CustomerDashboardPageVm {
  const totalFields = Number(aggregate?.fields?.total ?? 0);
  const atRisk = Number(aggregate?.fields?.at_risk ?? 0);
  const critical = aggregate.top_risk_fields.filter((x) => String(x.risk_level ?? "").toUpperCase() === "HIGH").length;
  const offlineFields = Number(aggregate?.device_summary?.offline_fields ?? 0);

  return {
    header: {
      title: "客户看板",
      subtitle: "围绕经营结果、风险、成本与行动建议展示",
    },
    fieldStatus: {
      totalFieldsText: numberFmt.format(totalFields),
      atRiskText: numberFmt.format(atRisk),
      criticalText: numberFmt.format(critical),
      offlineFieldsText: numberFmt.format(offlineFields),
    },
    businessSummary: {
      openAlertsText: numberFmt.format(Number(aggregate?.pending_actions_summary?.total_open_alerts ?? 0)),
      pendingAcceptanceText: numberFmt.format(Number(aggregate?.pending_actions_summary?.pending_acceptance ?? 0)),
      estimatedCostText: currencyFmt.format(Number(aggregate?.period_summary?.total_cost ?? 0)),
      actualCostText: currencyFmt.format(Number(aggregate?.period_summary?.total_cost ?? 0)),
    },
    pendingActions: {
      totalAlertsText: numberFmt.format(Number(aggregate?.pending_actions_summary?.total_open_alerts ?? 0)),
      unassignedText: numberFmt.format(Number(aggregate?.pending_actions_summary?.unassigned_alerts ?? 0)),
      inProgressText: numberFmt.format(Number(aggregate?.pending_actions_summary?.in_progress_alerts ?? 0)),
      slaBreachedText: numberFmt.format(Number(aggregate?.pending_actions_summary?.sla_breached_alerts ?? 0)),
      closedTodayText: numberFmt.format(Number(aggregate?.pending_actions_summary?.closed_today_alerts ?? 0)),
    },
    topRiskFields: (aggregate?.top_risk_fields || []).map((item) => ({
      fieldId: item.field_id,
      title: item.field_name || item.field_id,
      riskText: toRiskText(item.risk_level),
      reasonText: item.risk_reasons.length ? item.risk_reasons.join("、") : "暂无",
      openAlertsText: numberFmt.format(Number(item.open_alerts_count ?? 0)),
      pendingAcceptanceText: numberFmt.format(Number(item.pending_acceptance_count ?? 0)),
      lastOperationText: fmtDateTime(item.last_operation_at),
      href: `/fields/${encodeURIComponent(item.field_id)}/report`,
    })),
    recentOperations: (aggregate?.recent_operations || []).map((item) => ({
      operationId: item.operation_id,
      title: item.customer_title || item.title || item.operation_id,
      fieldTitle: item.field_name || item.field_id,
      statusText: toFinalStatusText(item.final_status),
      acceptanceText: toAcceptanceStatusText(item.acceptance_status),
      executedAtText: fmtDateTime(item.executed_at),
      href: `/operations/${encodeURIComponent(item.operation_plan_id)}/report`,
    })),
  };
}
