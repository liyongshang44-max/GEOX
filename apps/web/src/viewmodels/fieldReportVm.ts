import type { FieldReportDetailV1 } from "../api/reports";
import { toAcceptanceStatusLabel, toOperationStatusLabel, toRiskLabel } from "../lib/customerLabels";

export type FieldReportPageVm = {
  header: {
    title: string;
    subtitle: string;
    fieldId: string;
  };
  overview: {
    riskText: string;
    openAlertsText: string;
    pendingAcceptanceText: string;
    totalOperationsText: string;
    latestOperationText: string;
    estimatedCostText: string;
    actualCostText: string;
  };
  explain: {
    human: string;
    topReasonsText: string[];
  };
  recentOperations: Array<{
    id: string;
    title: string;
    statusText: string;
    acceptanceText: string;
    generatedAtText: string;
    href: string;
  }>;
  deviceSummary: {
    totalText: string;
    onlineText: string;
    offlineText: string;
    lastTelemetryText: string;
  };
  nextAction: {
    title: string;
    explainText: string;
    objectiveText: string;
    priorityText: string;
  } | null;
};

function mapRiskText(raw: unknown): string {
  return toRiskLabel(raw);
}

function mapStatusText(raw: unknown): string {
  return toOperationStatusLabel(raw);
}

function mapAcceptanceText(raw: unknown): string {
  return toAcceptanceStatusLabel(raw);
}

function formatDateTime(value: string | null | undefined, fallback = "--"): string {
  if (!value) return fallback;
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) return fallback;
  return new Date(ms).toLocaleString("zh-CN", { hour12: false });
}

function formatCurrency(value: number | null | undefined): string {
  const num = Number(value ?? 0);
  return new Intl.NumberFormat("zh-CN", { style: "currency", currency: "CNY", maximumFractionDigits: 2 }).format(Number.isFinite(num) ? num : 0);
}

function formatCount(value: number | null | undefined): string {
  const num = Number(value ?? 0);
  return Number.isFinite(num) ? String(num) : "0";
}

export function buildFieldReportVm(report: FieldReportDetailV1): FieldReportPageVm {
  const fieldId = report.field.field_id;
  const fieldName = String(report.field.field_name ?? "").trim();
  const title = fieldName || fieldId || "地块报告";

  return {
    header: {
      title,
      subtitle: `地块ID：${fieldId}`,
      fieldId,
    },
    overview: {
      riskText: mapRiskText(report.overview.current_risk_level),
      openAlertsText: formatCount(report.overview.open_alerts_count),
      pendingAcceptanceText: formatCount(report.overview.pending_acceptance_count),
      totalOperationsText: formatCount(report.overview.total_operations_count),
      latestOperationText: formatDateTime(report.overview.latest_operation_at),
      estimatedCostText: formatCurrency(report.overview.estimated_total_cost),
      actualCostText: formatCurrency(report.overview.actual_total_cost),
    },
    explain: {
      human: String(report.explain.human || "暂无状态解释"),
      topReasonsText: report.explain.top_reasons.length ? report.explain.top_reasons : ["暂无主要原因"],
    },
    recentOperations: report.recent_operations.map((item) => {
      const operationId = String(item.operation_plan_id || item.operation_id || "").trim();
      return {
        id: operationId || "--",
        title: String(item.customer_title || item.title || operationId || "未命名作业"),
        statusText: mapStatusText(item.final_status),
        acceptanceText: mapAcceptanceText(item.acceptance_status),
        generatedAtText: formatDateTime(item.generated_at),
        href: operationId ? `/operations/${encodeURIComponent(operationId)}/report` : "#",
      };
    }),
    deviceSummary: {
      totalText: formatCount(report.device_summary.total_devices),
      onlineText: formatCount(report.device_summary.online_devices),
      offlineText: formatCount(report.device_summary.offline_devices),
      lastTelemetryText: formatDateTime(report.device_summary.last_telemetry_at),
    },
    nextAction: report.next_action ? {
      title: String(report.next_action.action_type || "建议执行下一步动作"),
      explainText: String(report.next_action.explain_human || "暂无建议说明"),
      objectiveText: String(report.next_action.objective_text || "暂无目标"),
      priorityText: String(report.next_action.priority || "普通"),
    } : null,
  };
}
