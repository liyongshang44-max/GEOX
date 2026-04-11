import type { OperationReportRiskLevel, OperationReportV1 } from "./report_v1";

export type CustomerDashboardAggregateV1 = {
  fields: {
    total: number;
    healthy: number;
    at_risk: number;
  };
  recent_operations: Array<{
    operation_id: string;
    operation_plan_id: string;
    field_id: string;
    executed_at: string | null;
    risk_level: OperationReportRiskLevel;
    risk_reasons: string[];
    estimated_total_cost: number;
    execution_duration_ms: number | null;
  }>;
  risk_summary: {
    level: OperationReportRiskLevel;
    top_reasons: string[];
  };
  period_summary: {
    total_operations: number;
    total_cost: number;
    avg_sla_ms: number | null;
  };
};

const RISK_RANK: Record<OperationReportRiskLevel, number> = {
  LOW: 0,
  MEDIUM: 1,
  HIGH: 2,
};

function resolveReportFieldId(report: OperationReportV1): string {
  return String(report.identifiers.group_id ?? "").trim();
}

function toMs(v: string | null | undefined): number | null {
  if (!v) return null;
  const ms = Date.parse(v);
  return Number.isFinite(ms) ? ms : null;
}

function resolveExecutedAtMs(report: OperationReportV1): number | null {
  return (
    toMs(report.execution.execution_finished_at) ??
    toMs(report.execution.execution_started_at) ??
    toMs(report.execution.dispatched_at) ??
    toMs(report.generated_at)
  );
}

function timeRangeLowerBoundMs(range: "7d" | "30d" | "season", nowMs: number): number {
  if (range === "7d") return nowMs - 7 * 24 * 60 * 60 * 1000;
  if (range === "30d") return nowMs - 30 * 24 * 60 * 60 * 1000;
  return Number.NEGATIVE_INFINITY;
}

function maxRisk(a: OperationReportRiskLevel, b: OperationReportRiskLevel): OperationReportRiskLevel {
  return RISK_RANK[a] >= RISK_RANK[b] ? a : b;
}

export function projectCustomerDashboardAggregateV1(params: {
  reports: OperationReportV1[];
  allowedFieldIds: string[];
  requestedFieldIds?: string[];
  timeRange?: "7d" | "30d" | "season";
  nowMs?: number;
}): CustomerDashboardAggregateV1 {
  const nowMs = Number.isFinite(params.nowMs) ? Number(params.nowMs) : Date.now();
  const allowed = new Set(params.allowedFieldIds.map((x) => String(x ?? "").trim()).filter(Boolean));
  const requested = params.requestedFieldIds?.map((x) => String(x ?? "").trim()).filter(Boolean) ?? null;

  const effectiveFieldIds = requested
    ? requested.filter((fieldId) => allowed.has(fieldId))
    : Array.from(allowed.values());
  const effectiveFieldSet = new Set(effectiveFieldIds);

  const lowerBoundMs = timeRangeLowerBoundMs(params.timeRange ?? "season", nowMs);

  const filteredReports = params.reports.filter((report) => {
    const fieldId = resolveReportFieldId(report);
    if (!effectiveFieldSet.has(fieldId)) return false;
    const executedAtMs = resolveExecutedAtMs(report);
    if (executedAtMs == null) return false;
    if (executedAtMs < lowerBoundMs || executedAtMs > nowMs) return false;
    return true;
  });

  const fieldRiskLevel = new Map<string, OperationReportRiskLevel>();
  for (const report of filteredReports) {
    const fieldId = resolveReportFieldId(report);
    const prev = fieldRiskLevel.get(fieldId) ?? "LOW";
    fieldRiskLevel.set(fieldId, maxRisk(prev, report.risk.level));
  }

  let atRiskCount = 0;
  for (const fieldId of effectiveFieldIds) {
    const level = fieldRiskLevel.get(fieldId) ?? "LOW";
    if (level === "MEDIUM" || level === "HIGH") atRiskCount += 1;
  }

  const sortedReports = [...filteredReports].sort((a, b) => {
    const bMs = resolveExecutedAtMs(b) ?? 0;
    const aMs = resolveExecutedAtMs(a) ?? 0;
    return bMs - aMs;
  });

  const recentOperations = sortedReports.slice(0, 5).map((report) => {
    const executedAtMs = resolveExecutedAtMs(report);
    return {
      operation_id: report.identifiers.operation_id,
      operation_plan_id: report.identifiers.operation_plan_id,
      field_id: resolveReportFieldId(report),
      executed_at: executedAtMs == null ? null : new Date(executedAtMs).toISOString(),
      risk_level: report.risk.level,
      risk_reasons: [...report.risk.reasons],
      estimated_total_cost: Number(report.cost.estimated_total ?? 0),
      execution_duration_ms: report.sla.execution_duration_ms ?? null,
    };
  });

  const reasonCount = new Map<string, number>();
  let globalRisk: OperationReportRiskLevel = "LOW";
  let totalCost = 0;
  let slaSum = 0;
  let slaCount = 0;

  for (const report of filteredReports) {
    globalRisk = maxRisk(globalRisk, report.risk.level);
    totalCost += Number(report.cost.estimated_total ?? 0);

    const duration = report.sla.execution_duration_ms;
    if (typeof duration === "number" && Number.isFinite(duration)) {
      slaSum += duration;
      slaCount += 1;
    }

    for (const reasonRaw of report.risk.reasons) {
      const reason = String(reasonRaw ?? "").trim();
      if (!reason) continue;
      reasonCount.set(reason, (reasonCount.get(reason) ?? 0) + 1);
    }
  }

  const topReasons = [...reasonCount.entries()]
    .sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      return a[0].localeCompare(b[0]);
    })
    .slice(0, 5)
    .map(([reason]) => reason);

  return {
    fields: {
      total: effectiveFieldIds.length,
      healthy: Math.max(0, effectiveFieldIds.length - atRiskCount),
      at_risk: atRiskCount,
    },
    recent_operations: recentOperations,
    risk_summary: {
      level: globalRisk,
      top_reasons: topReasons,
    },
    period_summary: {
      total_operations: filteredReports.length,
      total_cost: totalCost,
      avg_sla_ms: slaCount > 0 ? slaSum / slaCount : null,
    },
  };
}
