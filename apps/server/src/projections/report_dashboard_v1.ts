import type { OperationReportRiskLevel, OperationReportV1 } from "./report_v1.js";
import type { OperationStateV1 } from "./operation_state_v1.js";

export type CustomerDashboardAggregateV1 = {
  fields: {
    total: number;
    healthy: number;
    at_risk: number;
  };
  top_risk_fields: Array<{
    field_id: string;
    field_name: string | null;
    risk_level: OperationReportRiskLevel;
    risk_reasons: string[];
    open_alerts_count: number;
    pending_acceptance_count: number;
    last_operation_at: string | null;
  }>;
  recent_operations: Array<{
    operation_id: string;
    operation_plan_id: string;
    field_id: string;
    field_name: string | null;
    title: string | null;
    customer_title: string | null;
    executed_at: string | null;
    final_status: string;
    acceptance_status: string | null;
    risk_level: OperationReportRiskLevel;
    risk_reasons: string[];
    estimated_total_cost: number;
    execution_duration_ms: number | null;
    scenario_type?: string;
    formal_chain_status?: string;
    evidence_status?: string;
    fail_safe_status?: string;
    manual_takeover_status?: string;
    zone_rollup_status?: string;
    customer_visible_eligible?: boolean;
    needs_review?: boolean;
    sampling_lab_result_status?: string;
    sampling_acceptance_status?: string;
  }>;
  risk_summary: {
    level: OperationReportRiskLevel;
    top_reasons: string[];
  };
  period_summary: {
    total_operations: number;
    estimated_total_cost: number;
    actual_total_cost: number;
    avg_sla_ms: number | null;
  };
  pending_actions_summary: {
    total_open_alerts: number;
    unassigned_alerts: number;
    in_progress_alerts: number;
    sla_breached_alerts: number;
    closed_today_alerts: number;
    pending_acceptance: number;
  };
  device_summary: {
    offline_fields: number;
    total_devices: number;
    offline_devices: number;
  };
  roi_summary: {
    total_roi_items: number;
    measured_items: number;
    estimated_items: number;
    assumption_based_items: number;
    insufficient_items: number;
    low_confidence_items: number;
    water_saved_items: number;
    labor_saved_items: number;
    early_warning_items: number;
    first_pass_acceptance_items: number;
    has_customer_visible_value: boolean;
    customer_value_text: string;
  };
};

export type FieldPortfolioSummaryV1 = Omit<CustomerDashboardAggregateV1, "top_risk_fields"> & {
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
  value_summary: {
    total_roi_items: number;
    measured_items: number;
    estimated_items: number;
    assumption_based_items: number;
    insufficient_items: number;
    low_confidence_items: number;
    water_saved_items: number;
    labor_saved_items: number;
    early_warning_items: number;
    first_pass_acceptance_items: number;
    has_customer_visible_value: boolean;
    customer_value_text: string;
  };
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

function toIsoFromMs(ms: number | null): string | null {
  if (ms == null || !Number.isFinite(ms) || ms <= 0) return null;
  return new Date(ms).toISOString();
}

function deriveStateRiskLevel(state: OperationStateV1): OperationReportRiskLevel {
  const finalStatus = String(state.final_status ?? "").toUpperCase();
  const acceptance = String(state.acceptance?.status ?? "").toUpperCase();
  if (finalStatus === "FAILED" || finalStatus === "INVALID_EXECUTION" || acceptance === "FAIL") return "HIGH";
  if (finalStatus === "PENDING_ACCEPTANCE" || finalStatus === "RUNNING" || finalStatus === "PENDING") return "MEDIUM";
  return "LOW";
}

function buildFieldValueSummary(reports: OperationReportV1[]): FieldReportDetailV1["value_summary"] {
  const items = reports.flatMap((r) => r.roi_ledger?.items ?? []);
  const total = items.length;
  const measured = items.filter((x) => x.value_kind === "MEASURED").length;
  const estimated = items.filter((x) => x.value_kind === "ESTIMATED").length;
  const assumptionBased = items.filter((x) => x.value_kind === "ASSUMPTION_BASED").length;
  const insufficient = items.filter((x) => x.value_kind === "INSUFFICIENT_EVIDENCE").length;
  const lowConfidence = items.filter((x) => String(x?.confidence?.level ?? "").toUpperCase() === "LOW").length;
  const waterSaved = items.filter((x) => x.roi_type === "WATER_SAVED").length;
  const laborSaved = items.filter((x) => x.roi_type === "LABOR_SAVED").length;
  const earlyWarning = items.filter((x) => x.roi_type === "EARLY_WARNING_LEAD_TIME").length;
  const firstPassAcceptance = items.filter((x) => x.roi_type === "FIRST_PASS_ACCEPTANCE_RATE").length;
  const hasValue = items.some((x) => x.estimated_money_value != null || String(x.customer_text ?? "").trim().length > 0);

  return {
    total_roi_items: total,
    measured_items: measured,
    estimated_items: estimated,
    assumption_based_items: assumptionBased,
    insufficient_items: insufficient,
    low_confidence_items: lowConfidence,
    water_saved_items: waterSaved,
    labor_saved_items: laborSaved,
    early_warning_items: earlyWarning,
    first_pass_acceptance_items: firstPassAcceptance,
    has_customer_visible_value: hasValue,
    customer_value_text: total ? `本地块已有 ${total} 条价值记录` : "暂无价值记录",
  };
}

function buildDashboardRoiSummary(reports: OperationReportV1[]): CustomerDashboardAggregateV1["roi_summary"] {
  const summary = buildFieldValueSummary(reports);
  return {
    ...summary,
    customer_value_text: summary.total_roi_items ? `当前共有 ${summary.total_roi_items} 条价值记录` : "暂无价值记录",
  };
}

function deriveStateRiskReasons(state: OperationStateV1): string[] {
  const reasons = new Set<string>();
  for (const code of state.reason_codes ?? []) {
    const text = String(code ?? "").trim();
    if (text) reasons.add(text);
  }
  const finalStatus = String(state.final_status ?? "").toUpperCase();
  const acceptance = String(state.acceptance?.status ?? "").toUpperCase();
  if (finalStatus === "INVALID_EXECUTION") reasons.add("INVALID_EXECUTION");
  if (finalStatus === "FAILED") reasons.add("EXECUTION_FAILED");
  if (finalStatus === "PENDING_ACCEPTANCE") reasons.add("PENDING_ACCEPTANCE");
  if (acceptance === "FAIL") reasons.add("ACCEPTANCE_FAIL");
  return [...reasons];
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
  const valueSummary = buildFieldValueSummary(params.reports);

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
    value_summary: valueSummary,
  };
}

export function projectCustomerDashboardAggregateV1(params: {
  reports: OperationReportV1[];
  field_name_by_id?: Map<string, string | null>;
  open_alerts_by_field?: Map<string, number>;
  pending_acceptance_by_field?: Map<string, number>;
  pending_actions_summary?: {
    total_open_alerts: number;
    unassigned_alerts: number;
    in_progress_alerts: number;
    sla_breached_alerts: number;
    closed_today_alerts: number;
    pending_acceptance?: number;
  };
  device_summary?: {
    offline_fields: number;
    total_devices: number;
    offline_devices: number;
  };
}): CustomerDashboardAggregateV1 {
  const reports = params.reports;
  const roiSummary = buildDashboardRoiSummary(reports);
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
      field_name: params.field_name_by_id?.get(resolveReportFieldId(report)) ?? null,
      title: report.operation_title ?? null,
      customer_title: report.customer_title ?? null,
      executed_at: executedAtMs == null ? null : report.execution.execution_finished_at,
      final_status: report.execution.final_status,
      acceptance_status: report.acceptance.status ?? null,
      risk_level: report.risk.level,
      risk_reasons: [...report.risk.reasons],
      estimated_total_cost: Number(report.cost.estimated_total ?? 0),
      execution_duration_ms: report.sla.execution_duration_ms ?? null,
      scenario_type: report.formal_scenario?.scenario_type ?? undefined,
      formal_chain_status: report.formal_scenario?.formal_chain_status ?? undefined,
      evidence_status: report.formal_scenario?.evidence_status ?? undefined,
      fail_safe_status: report.fail_safe?.status ?? undefined,
      manual_takeover_status: report.manual_takeover?.status ?? undefined,
      zone_rollup_status: report.zone_matrix?.length
        ? (report.zone_matrix.every((zone) => zone.zone_acceptance_result === "PASS") ? "PASS" : "NEEDS_REVIEW")
        : undefined,
      customer_visible_eligible: report.formal_scenario?.customer_visible_eligible ?? undefined,
      needs_review: report.formal_scenario?.needs_review ?? undefined,
      sampling_lab_result_status: report.sampling?.lab_result_status ?? undefined,
      sampling_acceptance_status: report.sampling?.acceptance_status ?? undefined,
    };
  });

  const reasonCount = new Map<string, number>();
  let globalRisk: OperationReportRiskLevel = "LOW";
  let estimatedTotalCost = 0;
  let actualTotalCost = 0;
  let slaSum = 0;
  let slaCount = 0;
  let healthy = 0;
  let atRisk = 0;
  let pendingAcceptanceCount = 0;
  const fieldAgg = new Map<string, {
    field_id: string;
    field_name: string | null;
    risk_level: OperationReportRiskLevel;
    risk_reasons: Set<string>;
    open_alerts_count: number;
    pending_acceptance_count: number;
    last_operation_at: string | null;
    last_operation_ms: number;
  }>();

  for (const report of reports) {
    globalRisk = maxRisk(globalRisk, report.risk.level);
    estimatedTotalCost += Number(report.cost.estimated_total ?? 0);
    actualTotalCost += Number(report.cost.actual_total ?? 0);
    if (report.risk.level === "LOW") healthy += 1;
    else atRisk += 1;
    if (String(report.execution.final_status ?? "").toUpperCase() === "PENDING_ACCEPTANCE") pendingAcceptanceCount += 1;

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

    const fieldId = resolveReportFieldId(report);
    if (!fieldId) continue;
    const current = fieldAgg.get(fieldId) ?? {
      field_id: fieldId,
      field_name: params.field_name_by_id?.get(fieldId) ?? null,
      risk_level: "LOW" as OperationReportRiskLevel,
      risk_reasons: new Set<string>(),
      open_alerts_count: Number(params.open_alerts_by_field?.get(fieldId) ?? 0),
      pending_acceptance_count: Number(params.pending_acceptance_by_field?.get(fieldId) ?? 0),
      last_operation_at: null,
      last_operation_ms: 0,
    };
    current.risk_level = maxRisk(current.risk_level, report.risk.level);
    for (const reasonRaw of report.risk.reasons) {
      const reason = String(reasonRaw ?? "").trim();
      if (reason) current.risk_reasons.add(reason);
    }
    const opMs = resolveOperationTimeMs(report);
    if (opMs >= current.last_operation_ms) {
      current.last_operation_ms = opMs;
      current.last_operation_at = report.execution.execution_finished_at ?? report.generated_at ?? null;
    }
    fieldAgg.set(fieldId, current);
  }

  const topReasons = [...reasonCount.entries()]
    .sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      return a[0].localeCompare(b[0]);
    })
    .slice(0, 5)
    .map(([reason]) => reason);

  const topRiskFields = [...fieldAgg.values()]
    .sort((a, b) => {
      const riskDiff = RISK_RANK[b.risk_level] - RISK_RANK[a.risk_level];
      if (riskDiff !== 0) return riskDiff;
      if (b.open_alerts_count !== a.open_alerts_count) return b.open_alerts_count - a.open_alerts_count;
      if (b.pending_acceptance_count !== a.pending_acceptance_count) return b.pending_acceptance_count - a.pending_acceptance_count;
      if (b.last_operation_ms !== a.last_operation_ms) return b.last_operation_ms - a.last_operation_ms;
      return a.field_id.localeCompare(b.field_id);
    })
    .slice(0, 5)
    .map((item) => ({
      field_id: item.field_id,
      field_name: item.field_name,
      risk_level: item.risk_level,
      risk_reasons: [...item.risk_reasons].slice(0, 3),
      open_alerts_count: item.open_alerts_count,
      pending_acceptance_count: item.pending_acceptance_count,
      last_operation_at: item.last_operation_at,
    }));

  return {
    fields: {
      total: reports.length,
      healthy,
      at_risk: atRisk,
    },
    top_risk_fields: topRiskFields,
    recent_operations: recentOperations,
    risk_summary: {
      level: globalRisk,
      top_reasons: topReasons,
    },
    period_summary: {
      total_operations: reports.length,
      estimated_total_cost: estimatedTotalCost,
      actual_total_cost: actualTotalCost,
      avg_sla_ms: slaCount > 0 ? slaSum / slaCount : null,
    },
    pending_actions_summary: {
      total_open_alerts: Number(params.pending_actions_summary?.total_open_alerts ?? 0),
      unassigned_alerts: Number(params.pending_actions_summary?.unassigned_alerts ?? 0),
      in_progress_alerts: Number(params.pending_actions_summary?.in_progress_alerts ?? 0),
      sla_breached_alerts: Number(params.pending_actions_summary?.sla_breached_alerts ?? 0),
      closed_today_alerts: Number(params.pending_actions_summary?.closed_today_alerts ?? 0),
      pending_acceptance: Number(params.pending_actions_summary?.pending_acceptance ?? pendingAcceptanceCount),
    },
    device_summary: {
      offline_fields: Number(params.device_summary?.offline_fields ?? 0),
      total_devices: Number(params.device_summary?.total_devices ?? 0),
      offline_devices: Number(params.device_summary?.offline_devices ?? 0),
    },
    roi_summary: roiSummary,
  };
}

export function projectCustomerDashboardAggregateFromStatesV1(params: {
  states: OperationStateV1[];
  field_ids: string[];
  field_name_by_id?: Map<string, string | null>;
  open_alerts_by_field?: Map<string, number>;
  pending_actions_summary?: {
    total_open_alerts: number;
    unassigned_alerts: number;
    in_progress_alerts: number;
    sla_breached_alerts: number;
    closed_today_alerts: number;
  };
  device_summary?: {
    offline_fields: number;
    total_devices: number;
    offline_devices: number;
  };
}): CustomerDashboardAggregateV1 {
  const sortedStates = [...params.states].sort((a, b) => Number(b.last_event_ts ?? 0) - Number(a.last_event_ts ?? 0));
  const reasonCount = new Map<string, number>();
  const perField = new Map<string, {
    field_id: string;
    risk_level: OperationReportRiskLevel;
    risk_reasons: Set<string>;
    pending_acceptance_count: number;
    last_operation_ms: number;
  }>();
  let pendingAcceptanceTotal = 0;

  for (const state of sortedStates) {
    const fieldId = String(state.field_id ?? "").trim();
    if (!fieldId) continue;
    const riskLevel = deriveStateRiskLevel(state);
    const riskReasons = deriveStateRiskReasons(state);
    for (const reason of riskReasons) reasonCount.set(reason, (reasonCount.get(reason) ?? 0) + 1);
    const finalStatus = String(state.final_status ?? "").toUpperCase();
    const lastMs = Number(state.last_event_ts ?? 0);
    const agg = perField.get(fieldId) ?? {
      field_id: fieldId,
      risk_level: "LOW",
      risk_reasons: new Set<string>(),
      pending_acceptance_count: 0,
      last_operation_ms: 0,
    };
    agg.risk_level = maxRisk(agg.risk_level, riskLevel);
    for (const reason of riskReasons) agg.risk_reasons.add(reason);
    if (finalStatus === "PENDING_ACCEPTANCE") {
      agg.pending_acceptance_count += 1;
      pendingAcceptanceTotal += 1;
    }
    if (Number.isFinite(lastMs) && lastMs > agg.last_operation_ms) agg.last_operation_ms = lastMs;
    perField.set(fieldId, agg);
  }

  const fieldIds = params.field_ids.length > 0 ? params.field_ids : [...perField.keys()];
  let healthy = 0;
  let atRisk = 0;
  for (const fieldId of fieldIds) {
    const risk = perField.get(fieldId)?.risk_level ?? "LOW";
    if (risk === "LOW") healthy += 1;
    else atRisk += 1;
  }

  const topReasons = [...reasonCount.entries()]
    .sort((a, b) => (b[1] - a[1]) || a[0].localeCompare(b[0]))
    .slice(0, 5)
    .map(([reason]) => reason);
  const riskSummaryLevel = [...perField.values()].reduce<OperationReportRiskLevel>((acc, item) => maxRisk(acc, item.risk_level), "LOW");

  return {
    fields: {
      total: fieldIds.length,
      healthy,
      at_risk: atRisk,
    },
    top_risk_fields: [...fieldIds]
      .map((fieldId) => {
        const agg = perField.get(fieldId);
        return {
          field_id: fieldId,
          field_name: params.field_name_by_id?.get(fieldId) ?? null,
          risk_level: agg?.risk_level ?? "LOW",
          risk_reasons: agg ? [...agg.risk_reasons] : [],
          open_alerts_count: Number(params.open_alerts_by_field?.get(fieldId) ?? 0),
          pending_acceptance_count: Number(agg?.pending_acceptance_count ?? 0),
          last_operation_at: toIsoFromMs(agg?.last_operation_ms ?? null),
        };
      })
      .sort((a, b) =>
        (RISK_RANK[b.risk_level] - RISK_RANK[a.risk_level])
        || (b.open_alerts_count - a.open_alerts_count)
        || (b.pending_acceptance_count - a.pending_acceptance_count)
        || ((toMs(b.last_operation_at) ?? 0) - (toMs(a.last_operation_at) ?? 0))
      )
      .slice(0, 5),
    recent_operations: sortedStates.slice(0, 5).map((state) => {
      const fieldId = String(state.field_id ?? "").trim();
      const riskReasons = deriveStateRiskReasons(state);
      const formalScenario = (state as any).formal_scenario ?? null;
      const failSafe = (state as any).fail_safe ?? null;
      const manualTakeover = (state as any).manual_takeover ?? null;
      const zoneMatrix = Array.isArray((state as any).zone_matrix) ? (state as any).zone_matrix : [];
      return {
        operation_id: String(state.operation_id ?? "").trim(),
        operation_plan_id: String(state.operation_plan_id ?? state.operation_id ?? "").trim(),
        field_id: fieldId,
        field_name: params.field_name_by_id?.get(fieldId) ?? null,
        title: null,
        customer_title: null,
        executed_at: toIsoFromMs(Number(state.last_event_ts ?? 0)),
        final_status: String(state.final_status ?? "UNKNOWN"),
        acceptance_status: state.acceptance?.status ?? null,
        risk_level: deriveStateRiskLevel(state),
        risk_reasons: riskReasons,
        estimated_total_cost: 0,
        execution_duration_ms: null,
        scenario_type: typeof formalScenario?.scenario_type === "string" ? formalScenario.scenario_type : undefined,
        formal_chain_status: typeof formalScenario?.formal_chain_status === "string" ? formalScenario.formal_chain_status : undefined,
        evidence_status: typeof formalScenario?.evidence_status === "string" ? formalScenario.evidence_status : undefined,
        fail_safe_status: typeof failSafe?.status === "string" ? failSafe.status : undefined,
        manual_takeover_status: typeof manualTakeover?.status === "string" ? manualTakeover.status : undefined,
        zone_rollup_status: zoneMatrix.length
          ? (zoneMatrix.every((zone: any) => String(zone?.zone_acceptance_result ?? "").toUpperCase() === "PASS") ? "PASS" : "NEEDS_REVIEW")
          : undefined,
        customer_visible_eligible: typeof formalScenario?.customer_visible_eligible === "boolean" ? formalScenario.customer_visible_eligible : undefined,
        needs_review: typeof formalScenario?.needs_review === "boolean" ? formalScenario.needs_review : undefined,
      };
    }),
    risk_summary: {
      level: riskSummaryLevel,
      top_reasons: topReasons,
    },
    period_summary: {
      total_operations: sortedStates.length,
      estimated_total_cost: 0,
      actual_total_cost: 0,
      avg_sla_ms: null,
    },
    pending_actions_summary: {
      total_open_alerts: Number(params.pending_actions_summary?.total_open_alerts ?? 0),
      unassigned_alerts: Number(params.pending_actions_summary?.unassigned_alerts ?? 0),
      in_progress_alerts: Number(params.pending_actions_summary?.in_progress_alerts ?? 0),
      sla_breached_alerts: Number(params.pending_actions_summary?.sla_breached_alerts ?? 0),
      closed_today_alerts: Number(params.pending_actions_summary?.closed_today_alerts ?? 0),
      pending_acceptance: pendingAcceptanceTotal,
    },
    device_summary: {
      offline_fields: Number(params.device_summary?.offline_fields ?? 0),
      total_devices: Number(params.device_summary?.total_devices ?? 0),
      offline_devices: Number(params.device_summary?.offline_devices ?? 0),
    },
    roi_summary: {
      total_roi_items: 0,
      measured_items: 0,
      estimated_items: 0,
      assumption_based_items: 0,
      insufficient_items: 0,
      low_confidence_items: 0,
      water_saved_items: 0,
      labor_saved_items: 0,
      early_warning_items: 0,
      first_pass_acceptance_items: 0,
      has_customer_visible_value: false,
      customer_value_text: "暂无价值记录",
    },
  };
}


export function projectFieldPortfolioSummaryV1(reports: OperationReportV1[]): FieldPortfolioSummaryV1 {
  const aggregate = projectCustomerDashboardAggregateV1({ reports });
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
