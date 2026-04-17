import type { OperationReportRiskLevel, OperationReportV1 } from "./report_v1.js";

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

export type FieldPortfolioSummaryV1 = CustomerDashboardAggregateV1 & {
  top_risk_fields: Array<{
    field_id: string;
    risk_level: OperationReportRiskLevel;
    risk_reasons: string[];
    operation_count: number;
    total_estimated_cost: number;
    last_executed_at: string | null;
  }>;
};

const RISK_RANK: Record<OperationReportRiskLevel, number> = {
  LOW: 0,
  MEDIUM: 1,
  HIGH: 2,
};

function resolveReportFieldId(report: OperationReportV1): string {
  return String(report.identifiers.field_id ?? "").trim();
}

function toMs(v: string | null | undefined): number | null {
  if (!v) return null;
  const ms = Date.parse(v);
  return Number.isFinite(ms) ? ms : null;
}

function resolveOperationTimeMs(report: OperationReportV1): number {
  return toMs(report.execution.execution_finished_at) ?? toMs(report.generated_at) ?? 0;
}

function maxRisk(a: OperationReportRiskLevel, b: OperationReportRiskLevel): OperationReportRiskLevel {
  return RISK_RANK[a] >= RISK_RANK[b] ? a : b;
}

export function projectCustomerDashboardAggregateV1(reports: OperationReportV1[]): CustomerDashboardAggregateV1 {
  const sortedReports = [...reports].sort((a, b) => {
    const bMs = resolveOperationTimeMs(b);
    const aMs = resolveOperationTimeMs(a);
    return bMs - aMs;
  });

  const recentOperations = sortedReports.slice(0, 5).map((report) => {
    const executedAtMs = toMs(report.execution.execution_finished_at);
    return {
      operation_id: report.identifiers.operation_id,
      operation_plan_id: report.identifiers.operation_plan_id,
      field_id: resolveReportFieldId(report),
      executed_at: executedAtMs == null ? null : report.execution.execution_finished_at,
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
  let healthy = 0;
  let atRisk = 0;

  for (const report of reports) {
    globalRisk = maxRisk(globalRisk, report.risk.level);
    totalCost += Number(report.cost.estimated_total ?? 0);
    if (report.risk.level === "LOW") healthy += 1;
    else atRisk += 1;

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
      total: reports.length,
      healthy,
      at_risk: atRisk,
    },
    recent_operations: recentOperations,
    risk_summary: {
      level: globalRisk,
      top_reasons: topReasons,
    },
    period_summary: {
      total_operations: reports.length,
      total_cost: totalCost,
      avg_sla_ms: slaCount > 0 ? slaSum / slaCount : null,
    },
  };
}


export function projectFieldPortfolioSummaryV1(reports: OperationReportV1[]): FieldPortfolioSummaryV1 {
  const aggregate = projectCustomerDashboardAggregateV1(reports);
  const byField = new Map<string, {
    field_id: string;
    risk_level: OperationReportRiskLevel;
    risk_reasons: Set<string>;
    operation_count: number;
    total_estimated_cost: number;
    last_executed_at: string | null;
    last_executed_ms: number;
  }>();

  for (const report of reports) {
    const fieldId = resolveReportFieldId(report);
    if (!fieldId) continue;
    const current = byField.get(fieldId) ?? {
      field_id: fieldId,
      risk_level: "LOW" as OperationReportRiskLevel,
      risk_reasons: new Set<string>(),
      operation_count: 0,
      total_estimated_cost: 0,
      last_executed_at: null,
      last_executed_ms: 0,
    };

    current.risk_level = maxRisk(current.risk_level, report.risk.level);
    for (const reasonRaw of report.risk.reasons) {
      const reason = String(reasonRaw ?? "").trim();
      if (reason) current.risk_reasons.add(reason);
    }
    current.operation_count += 1;
    current.total_estimated_cost += Number(report.cost.estimated_total ?? 0);

    const executedAtMs = toMs(report.execution.execution_finished_at) ?? toMs(report.generated_at) ?? 0;
    if (executedAtMs >= current.last_executed_ms) {
      current.last_executed_ms = executedAtMs;
      current.last_executed_at = report.execution.execution_finished_at ?? report.generated_at ?? null;
    }

    byField.set(fieldId, current);
  }

  const topRiskFields = [...byField.values()]
    .sort((a, b) => {
      const riskDiff = RISK_RANK[b.risk_level] - RISK_RANK[a.risk_level];
      if (riskDiff !== 0) return riskDiff;
      if (b.operation_count !== a.operation_count) return b.operation_count - a.operation_count;
      if (b.total_estimated_cost !== a.total_estimated_cost) return b.total_estimated_cost - a.total_estimated_cost;
      if (b.last_executed_ms !== a.last_executed_ms) return b.last_executed_ms - a.last_executed_ms;
      return a.field_id.localeCompare(b.field_id);
    })
    .slice(0, 5)
    .map((item) => ({
      field_id: item.field_id,
      risk_level: item.risk_level,
      risk_reasons: [...item.risk_reasons].slice(0, 3),
      operation_count: item.operation_count,
      total_estimated_cost: item.total_estimated_cost,
      last_executed_at: item.last_executed_at,
    }));

  return {
    ...aggregate,
    top_risk_fields: topRiskFields,
  };
}
