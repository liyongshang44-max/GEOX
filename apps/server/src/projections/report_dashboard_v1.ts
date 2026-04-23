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

export type FieldReportDetailV1 = {
  type: "field_report_v1";
  version: "v1";
  generated_at: string;
  field: {
    field_id: string;
    field_name: string | null;
  };
  overview: {
    current_risk_level: "LOW" | "MEDIUM" | "HIGH" | "UNKNOWN";
    open_alerts_count: number;
    pending_acceptance_count: number;
    total_operations_count: number;
    latest_operation_at: string | null;
    estimated_total_cost: number;
    actual_total_cost: number;
  };
  explain: {
    human: string | null;
    top_reasons: string[];
  };
  recent_operations: Array<{
    operation_plan_id: string;
    operation_id: string;
    title: string | null;
    customer_title: string | null;
    final_status: string;
    acceptance_status: string | null;
    generated_at: string | null;
  }>;
  device_summary: {
    total_devices: number;
    online_devices: number;
    offline_devices: number;
    last_telemetry_at: string | null;
  };
  next_action: {
    recommendation_id: string | null;
    explain_human: string | null;
    objective_text: string | null;
    action_type: string | null;
    priority: string | null;
  } | null;
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

function fallbackExplainByRisk(params: {
  current_risk_level: "LOW" | "MEDIUM" | "HIGH" | "UNKNOWN";
  top_reasons: string[];
}): string {
  const reasonsText = params.top_reasons.length > 0 ? `，主要原因：${params.top_reasons.join("、")}` : "";
  if (params.current_risk_level === "HIGH") return `该地块当前风险较高，建议优先处理${reasonsText}`.replace("，建议优先处理，", "，建议优先处理");
  if (params.current_risk_level === "MEDIUM") return `该地块存在中等风险，建议尽快跟进${reasonsText}`.replace("，建议尽快跟进，", "，建议尽快跟进");
  if (params.current_risk_level === "LOW") return `该地块总体风险较低，建议保持常规巡检${reasonsText}`.replace("，建议保持常规巡检，", "，建议保持常规巡检");
  return `该地块暂无作业报告，建议补充最新执行与监测数据${reasonsText}`.replace("，建议补充最新执行与监测数据，", "，建议补充最新执行与监测数据");
}

function inferActionType(report: OperationReportV1): string | null {
  const title = String(report.operation_title ?? report.customer_title ?? "").trim();
  if (!title) return null;
  if (title.includes("灌溉")) return "IRRIGATE";
  if (title.includes("施肥")) return "FERTILIZE";
  if (title.includes("喷药") || title.includes("喷施")) return "SPRAY";
  if (title.includes("巡检")) return "INSPECT";
  return null;
}

export function projectFieldReportDetailV1(params: {
  field_id: string;
  field_name?: string | null;
  reports: OperationReportV1[];
  open_alerts_count: number;
  device_summary: {
    total_devices: number;
    online_devices: number;
    offline_devices: number;
    last_telemetry_at: string | null;
  };
}): FieldReportDetailV1 {
  const reportsSorted = [...params.reports].sort((a, b) => resolveOperationTimeMs(b) - resolveOperationTimeMs(a));
  const latestReport = reportsSorted[0] ?? null;
  const totalOperations = params.reports.length;
  const pendingAcceptanceCount = params.reports.filter((r) => String(r.execution.final_status ?? "").toUpperCase() === "PENDING_ACCEPTANCE").length;
  const estimatedTotalCost = params.reports.reduce((sum, report) => sum + Number(report.cost.estimated_total ?? 0), 0);
  const actualTotalCost = params.reports.reduce((sum, report) => sum + Number(report.cost.actual_total ?? 0), 0);

  const reasonCount = new Map<string, number>();
  let currentRiskLevel: "LOW" | "MEDIUM" | "HIGH" | "UNKNOWN" = "UNKNOWN";
  for (const report of params.reports) {
    currentRiskLevel = currentRiskLevel === "UNKNOWN" ? report.risk.level : maxRisk(currentRiskLevel, report.risk.level);
    for (const reasonRaw of report.risk.reasons) {
      const reason = String(reasonRaw ?? "").trim();
      if (!reason) continue;
      reasonCount.set(reason, (reasonCount.get(reason) ?? 0) + 1);
    }
  }
  const topReasons = [...reasonCount.entries()]
    .sort((a, b) => (b[1] - a[1]) || a[0].localeCompare(b[0]))
    .slice(0, 5)
    .map(([reason]) => reason);

  const explainHuman = latestReport?.why?.explain_human ?? fallbackExplainByRisk({
    current_risk_level: currentRiskLevel,
    top_reasons: topReasons,
  });
  const nextActionSource = reportsSorted.find((report) => Boolean(report.why?.explain_human) || Boolean(report.identifiers.recommendation_id)) ?? null;

  return {
    type: "field_report_v1",
    version: "v1",
    generated_at: new Date().toISOString(),
    field: {
      field_id: params.field_id,
      field_name: params.field_name ?? null,
    },
    overview: {
      current_risk_level: currentRiskLevel,
      open_alerts_count: Number(params.open_alerts_count ?? 0),
      pending_acceptance_count: pendingAcceptanceCount,
      total_operations_count: totalOperations,
      latest_operation_at: latestReport ? (latestReport.execution.execution_finished_at ?? latestReport.generated_at ?? null) : null,
      estimated_total_cost: estimatedTotalCost,
      actual_total_cost: actualTotalCost,
    },
    explain: {
      human: explainHuman,
      top_reasons: topReasons,
    },
    recent_operations: reportsSorted.slice(0, 5).map((report) => ({
      operation_plan_id: report.identifiers.operation_plan_id,
      operation_id: report.identifiers.operation_id,
      title: report.operation_title ?? null,
      customer_title: report.customer_title ?? null,
      final_status: report.execution.final_status,
      acceptance_status: report.acceptance.status ?? null,
      generated_at: report.generated_at ?? null,
    })),
    device_summary: {
      total_devices: Number(params.device_summary.total_devices ?? 0),
      online_devices: Number(params.device_summary.online_devices ?? 0),
      offline_devices: Number(params.device_summary.offline_devices ?? 0),
      last_telemetry_at: params.device_summary.last_telemetry_at ?? null,
    },
    next_action: nextActionSource ? {
      recommendation_id: nextActionSource.identifiers.recommendation_id ?? null,
      explain_human: nextActionSource.why.explain_human ?? null,
      objective_text: nextActionSource.why.objective_text ?? null,
      action_type: inferActionType(nextActionSource),
      priority: null,
    } : null,
  };
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
