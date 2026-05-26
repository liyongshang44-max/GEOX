import { isFormalCustomerValueItem } from "./guarded_report_v1.js";
import type { OperationStateV1 } from "./operation_state_v1.js";
import type { OperationReportRiskLevel, OperationReportV1 } from "./report_v1.js";

export type DashboardProjectionSourceV1 = "GUARDED_REPORT" | "STATE_FALLBACK_LIMITED";

export type DashboardProjectionTrustV1 = {
  projection_source: DashboardProjectionSourceV1;
  fallback_limited: boolean;
  customer_visible_eligible: boolean;
  blocking_reasons: string[];
};

type RoiSummaryTrustV1 = {
  total_roi_items: number;
  trusted_value_items: number;
  hypothesis_items: number;
  measured_items: number;
  estimated_items: number;
  assumption_based_items: number;
  insufficient_items: number;
  insufficient_evidence_items: number;
  simulated_or_technical_items: number;
  low_confidence_items: number;
  water_saved_items: number;
  labor_saved_items: number;
  early_warning_items: number;
  first_pass_acceptance_items: number;
  has_customer_visible_value: boolean;
  customer_value_text: string;
};

type DashboardRecentOperationV1 = DashboardProjectionTrustV1 & {
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
  blocking_reasons?: string[];
  sampling_lab_result_status?: string;
  sampling_acceptance_status?: string;
};

export type CustomerDashboardAggregateV1 = DashboardProjectionTrustV1 & {
  fields: { total: number; healthy: number; at_risk: number };
  top_risk_fields: Array<{ field_id: string; field_name: string | null; risk_level: OperationReportRiskLevel; risk_reasons: string[]; open_alerts_count: number; pending_acceptance_count: number; last_operation_at: string | null }>;
  recent_operations: DashboardRecentOperationV1[];
  risk_summary: { level: OperationReportRiskLevel; top_reasons: string[] };
  period_summary: { total_operations: number; estimated_total_cost: number; actual_total_cost: number; avg_sla_ms: number | null };
  pending_actions_summary: { total_open_alerts: number; unassigned_alerts: number; in_progress_alerts: number; sla_breached_alerts: number; closed_today_alerts: number; pending_acceptance: number };
  device_summary: { offline_fields: number; total_devices: number; offline_devices: number };
  roi_summary: RoiSummaryTrustV1;
};

export type FieldPortfolioSummaryV1 = Omit<CustomerDashboardAggregateV1, "top_risk_fields"> & {
  top_risk_fields: Array<{ field_id: string; risk_level: OperationReportRiskLevel; risk_reasons: string[]; operation_count: number; total_estimated_cost: number; last_executed_at: string | null }>;
};

export type FieldReportDetailV1 = DashboardProjectionTrustV1 & {
  type: "field_report_v1";
  version: "v1";
  generated_at: string;
  field: { field_id: string; field_name: string | null };
  overview: { current_risk_level: "LOW" | "MEDIUM" | "HIGH" | "UNKNOWN"; open_alerts_count: number; pending_acceptance_count: number; total_operations_count: number; latest_operation_at: string | null; estimated_total_cost: number; actual_total_cost: number };
  explain: { human: string | null; top_reasons: string[] };
  recent_operations: Array<DashboardProjectionTrustV1 & { operation_plan_id: string; operation_id: string; title: string | null; customer_title: string | null; final_status: string; acceptance_status: string | null; generated_at: string | null }>;
  device_summary: { total_devices: number; online_devices: number; offline_devices: number; last_telemetry_at: string | null };
  next_action: { recommendation_id: string | null; explain_human: string | null; objective_text: string | null; action_type: string | null; priority: string | null } | null;
  value_summary: RoiSummaryTrustV1;
};

const RISK_RANK: Record<OperationReportRiskLevel, number> = { LOW: 0, MEDIUM: 1, HIGH: 2 };
const LIMITED_BLOCKING_REASON = "state_fallback_limited_not_customer_official";
const WEAK_REPORT_BLOCKING_REASON = "report_without_guarded_chain_validation";

function upper(value: unknown): string { return String(value ?? "").trim().toUpperCase(); }
function unique(values: unknown[]): string[] { return Array.from(new Set(values.map((x) => String(x ?? "").trim()).filter(Boolean))); }
function toMs(value: unknown): number | null { if (!value) return null; const ms = Date.parse(String(value)); return Number.isFinite(ms) ? ms : null; }
function toIsoFromMs(ms: number | null): string | null { return ms && Number.isFinite(ms) && ms > 0 ? new Date(ms).toISOString() : null; }
function maxRisk(a: OperationReportRiskLevel, b: OperationReportRiskLevel): OperationReportRiskLevel { return RISK_RANK[a] >= RISK_RANK[b] ? a : b; }
function resolveReportFieldId(report: OperationReportV1): string { return String((report as any).identifiers?.field_id ?? "").trim(); }
function resolveOperationTimeMs(report: OperationReportV1): number { return toMs((report as any).execution?.execution_finished_at) ?? toMs((report as any).generated_at) ?? 0; }

function fallbackExplainByRisk(params: { current_risk_level: "LOW" | "MEDIUM" | "HIGH" | "UNKNOWN"; top_reasons: string[] }): string {
  const reasonsText = params.top_reasons.length > 0 ? `，主要原因：${params.top_reasons.join("、")}` : "";
  if (params.current_risk_level === "HIGH") return `该地块当前风险较高，建议优先处理${reasonsText}`.replace("，建议优先处理，", "，建议优先处理");
  if (params.current_risk_level === "MEDIUM") return `该地块存在中等风险，建议尽快跟进${reasonsText}`.replace("，建议尽快跟进，", "，建议尽快跟进");
  if (params.current_risk_level === "LOW") return `该地块总体风险较低，建议保持常规巡检${reasonsText}`.replace("，建议保持常规巡检，", "，建议保持常规巡检");
  return `该地块暂无作业报告，建议补充最新执行与监测数据${reasonsText}`.replace("，建议补充最新执行与监测数据，", "，建议补充最新执行与监测数据");
}

function inferActionType(report: OperationReportV1): string | null {
  const title = String((report as any).operation_title ?? (report as any).customer_title ?? "").trim();
  if (title.includes("灌溉")) return "IRRIGATE";
  if (title.includes("施肥")) return "FERTILIZE";
  if (title.includes("喷药") || title.includes("喷施")) return "SPRAY";
  if (title.includes("巡检")) return "INSPECT";
  return null;
}

function deriveStateRiskLevel(state: OperationStateV1): OperationReportRiskLevel {
  const finalStatus = upper((state as any).final_status);
  const acceptance = upper((state as any).acceptance?.status);
  if (finalStatus === "FAILED" || finalStatus === "INVALID_EXECUTION" || acceptance === "FAIL") return "HIGH";
  if (finalStatus === "PENDING_ACCEPTANCE" || finalStatus === "RUNNING" || finalStatus === "PENDING") return "MEDIUM";
  return "LOW";
}

function deriveStateRiskReasons(state: OperationStateV1): string[] {
  const reasons = new Set<string>();
  for (const code of (state as any).reason_codes ?? []) {
    const value = String(code ?? "").trim();
    if (value) reasons.add(value);
  }
  const finalStatus = upper((state as any).final_status);
  const acceptance = upper((state as any).acceptance?.status);
  if (finalStatus === "INVALID_EXECUTION") reasons.add("INVALID_EXECUTION");
  if (finalStatus === "FAILED") reasons.add("EXECUTION_FAILED");
  if (finalStatus === "PENDING_ACCEPTANCE") reasons.add("PENDING_ACCEPTANCE_REQUIRES_FORMAL_REVIEW");
  if (acceptance === "FAIL") reasons.add("ACCEPTANCE_FAIL_REQUIRES_FORMAL_REVIEW");
  return [...reasons];
}

export function dashboardTrustFromStateFallbackV1(reasons: string[] = []): DashboardProjectionTrustV1 {
  return {
    projection_source: "STATE_FALLBACK_LIMITED",
    fallback_limited: true,
    customer_visible_eligible: false,
    blocking_reasons: unique([LIMITED_BLOCKING_REASON, ...reasons]),
  };
}

function reportTrust(report: OperationReportV1): DashboardProjectionTrustV1 {
  const r: any = report as any;
  const chainValidationPresent = r.chain_validation != null || Array.isArray(r.status_chain);
  const chainPassed = r.chain_validation?.passed === true || r.customer_visible_eligible === true;
  const fallbackLimited = r.fallback_limited === true || !chainValidationPresent || !chainPassed;
  return {
    projection_source: fallbackLimited ? "STATE_FALLBACK_LIMITED" : "GUARDED_REPORT",
    fallback_limited: fallbackLimited,
    customer_visible_eligible: !fallbackLimited,
    blocking_reasons: unique([...(Array.isArray(r.blocking_reasons) ? r.blocking_reasons : []), ...(fallbackLimited ? [WEAK_REPORT_BLOCKING_REASON] : [])]),
  };
}

export function customerOperationListTrustFromGuardedReportV1(report: OperationReportV1): DashboardProjectionTrustV1 { return reportTrust(report); }
export function isCustomerVisibleGuardedOperationReportV1(report: OperationReportV1): boolean { const trust = reportTrust(report); return trust.projection_source === "GUARDED_REPORT" && trust.customer_visible_eligible === true && trust.fallback_limited === false; }

function safeReportFinalStatus(report: OperationReportV1): string { const trust = reportTrust(report); return trust.customer_visible_eligible ? String((report as any).execution?.final_status ?? "UNKNOWN") : "LIMITED_STATE"; }
function safeReportAcceptanceStatus(report: OperationReportV1): string | null { const trust = reportTrust(report); return trust.customer_visible_eligible ? ((report as any).acceptance?.status ?? null) : "NEEDS_REVIEW"; }
function safeStateFinalStatus(): string { return "LIMITED_STATE"; }
function safeStateAcceptanceStatus(state: OperationStateV1): string | null { return state ? "NEEDS_REVIEW" : null; }
function dashboardNeedsReview(trust: DashboardProjectionTrustV1, report: OperationReportV1): boolean { return !trust.customer_visible_eligible || Boolean((report as any).formal_scenario?.needs_review); }
function isTrustedRoiItem(item: any): boolean { return isFormalCustomerValueItem(item); }

function isSimulatedOrTechnicalRoiItem(item: any): boolean {
  const valueKind = upper(item?.value_kind);
  const sourceLane = upper(item?.source_lane ?? item?.trust_level ?? item?.memory_lane);
  return item?.is_simulated === true
    || sourceLane.includes("SIMULATED")
    || sourceLane.includes("TECHNICAL")
    || sourceLane === "AS_EXECUTED_SIGNAL"
    || sourceLane === "FLIGHT_TABLE_DEV"
    || valueKind === "SIMULATED"
    || valueKind === "TECHNICAL_SIGNAL";
}

function allRoiItems(report: OperationReportV1): any[] {
  const ledger: any = (report as any).roi_ledger ?? {};
  return [
    ...(Array.isArray(ledger.items) ? ledger.items : []),
    ...(Array.isArray(ledger.water_saved) ? ledger.water_saved : []),
    ...(Array.isArray(ledger.labor_saved) ? ledger.labor_saved : []),
    ...(Array.isArray(ledger.early_warning_lead_time) ? ledger.early_warning_lead_time : []),
    ...(Array.isArray(ledger.first_pass_acceptance_rate) ? ledger.first_pass_acceptance_rate : []),
    ...(Array.isArray(ledger.low_confidence_items) ? ledger.low_confidence_items : []),
  ];
}

function buildFieldValueSummary(reports: OperationReportV1[]): RoiSummaryTrustV1 {
  const items = reports.flatMap((r) => allRoiItems(r).map((item: any) => ({ ...item, __report_trust: reportTrust(r) })));
  const trustedItems = items.filter((x: any) => x.__report_trust.customer_visible_eligible && isTrustedRoiItem(x));
  const estimated = items.filter((x: any) => upper(x.value_kind) === "ESTIMATED").length;
  const assumptionBased = items.filter((x: any) => upper(x.value_kind) === "ASSUMPTION_BASED" || upper(x.baseline_type) === "DEFAULT_ASSUMPTION" || upper(x.trust_level) === "HYPOTHESIS_ONLY").length;
  const insufficient = items.filter((x: any) => upper(x.value_kind) === "INSUFFICIENT_EVIDENCE" || upper(x.trust_level) === "INSUFFICIENT_FORMAL_EVIDENCE").length;
  const simulatedOrTechnical = items.filter((x: any) => !x.__report_trust.customer_visible_eligible || isSimulatedOrTechnicalRoiItem(x)).length;
  const lowConfidence = items.filter((x: any) => upper(x?.confidence?.level ?? x?.confidence_level) === "LOW").length;
  const waterSaved = trustedItems.filter((x: any) => x.roi_type === "WATER_SAVED").length;
  const laborSaved = trustedItems.filter((x: any) => x.roi_type === "LABOR_SAVED").length;
  const earlyWarning = trustedItems.filter((x: any) => x.roi_type === "EARLY_WARNING_LEAD_TIME").length;
  const firstPassAcceptance = trustedItems.filter((x: any) => x.roi_type === "FIRST_PASS_ACCEPTANCE_RATE").length;
  const hasValue = trustedItems.length > 0;
  return {
    total_roi_items: items.length,
    trusted_value_items: trustedItems.length,
    hypothesis_items: assumptionBased,
    measured_items: items.filter((x: any) => upper(x.value_kind) === "MEASURED").length,
    estimated_items: estimated,
    assumption_based_items: assumptionBased,
    insufficient_items: insufficient,
    insufficient_evidence_items: insufficient,
    simulated_or_technical_items: simulatedOrTechnical,
    low_confidence_items: lowConfidence,
    water_saved_items: waterSaved,
    labor_saved_items: laborSaved,
    early_warning_items: earlyWarning,
    first_pass_acceptance_items: firstPassAcceptance,
    has_customer_visible_value: hasValue,
    customer_value_text: hasValue ? `本地块已有 ${trustedItems.length} 条可信价值记录` : "暂无可作为客户正式价值结论的记录",
  };
}

function buildDashboardRoiSummary(reports: OperationReportV1[]): RoiSummaryTrustV1 {
  const summary = buildFieldValueSummary(reports);
  return { ...summary, customer_value_text: summary.has_customer_visible_value ? `当前共有 ${summary.trusted_value_items} 条可信价值记录` : "暂无可作为客户正式价值结论的记录" };
}

function limitedRoiSummary(simulatedOrTechnicalItems = 0): RoiSummaryTrustV1 {
  return { total_roi_items: 0, trusted_value_items: 0, hypothesis_items: 0, measured_items: 0, estimated_items: 0, assumption_based_items: 0, insufficient_items: 0, insufficient_evidence_items: 0, simulated_or_technical_items: simulatedOrTechnicalItems, low_confidence_items: 0, water_saved_items: 0, labor_saved_items: 0, early_warning_items: 0, first_pass_acceptance_items: 0, has_customer_visible_value: false, customer_value_text: "暂无可作为客户正式价值结论的记录" };
}

export function projectFieldReportDetailV1(params: { field_id: string; field_name?: string | null; reports: OperationReportV1[]; open_alerts_count: number; device_summary: { total_devices: number; online_devices: number; offline_devices: number; last_telemetry_at: string | null } }): FieldReportDetailV1 {
  const reportsSorted = [...params.reports].sort((a, b) => resolveOperationTimeMs(b) - resolveOperationTimeMs(a));
  const latestReport = reportsSorted[0] ?? null;
  const trusts = reportsSorted.map(reportTrust);
  const aggregateTrust: DashboardProjectionTrustV1 = trusts.length && trusts.every((t) => t.customer_visible_eligible)
    ? { projection_source: "GUARDED_REPORT", fallback_limited: false, customer_visible_eligible: true, blocking_reasons: [] }
    : { projection_source: "STATE_FALLBACK_LIMITED", fallback_limited: true, customer_visible_eligible: false, blocking_reasons: unique(trusts.flatMap((t) => t.blocking_reasons).concat(trusts.length ? [] : [WEAK_REPORT_BLOCKING_REASON])) };

  const reasonCount = new Map<string, number>();
  let currentRiskLevel: "LOW" | "MEDIUM" | "HIGH" | "UNKNOWN" = "UNKNOWN";
  for (const report of params.reports) {
    currentRiskLevel = currentRiskLevel === "UNKNOWN" ? report.risk.level : maxRisk(currentRiskLevel, report.risk.level);
    for (const reasonRaw of report.risk.reasons) {
      const reason = String(reasonRaw ?? "").trim();
      if (reason) reasonCount.set(reason, (reasonCount.get(reason) ?? 0) + 1);
    }
  }
  const topReasons = [...reasonCount.entries()].sort((a, b) => (b[1] - a[1]) || a[0].localeCompare(b[0])).slice(0, 5).map(([reason]) => reason);
  const nextActionSource = reportsSorted.find((report) => Boolean((report as any).why?.explain_human) || Boolean((report as any).identifiers?.recommendation_id)) ?? null;

  return {
    ...aggregateTrust,
    type: "field_report_v1",
    version: "v1",
    generated_at: new Date().toISOString(),
    field: { field_id: params.field_id, field_name: params.field_name ?? null },
    overview: {
      current_risk_level: currentRiskLevel,
      open_alerts_count: Number(params.open_alerts_count ?? 0),
      pending_acceptance_count: params.reports.filter((r) => reportTrust(r).customer_visible_eligible && upper((r as any).execution?.final_status) === "PENDING_ACCEPTANCE").length,
      total_operations_count: params.reports.length,
      latest_operation_at: latestReport ? ((latestReport as any).execution?.execution_finished_at ?? latestReport.generated_at ?? null) : null,
      estimated_total_cost: params.reports.reduce((sum, report) => sum + Number((report as any).cost?.estimated_total ?? 0), 0),
      actual_total_cost: params.reports.reduce((sum, report) => sum + Number((report as any).cost?.actual_total ?? 0), 0),
    },
    explain: { human: (latestReport as any)?.why?.explain_human ?? fallbackExplainByRisk({ current_risk_level: currentRiskLevel, top_reasons: topReasons }), top_reasons: topReasons },
    recent_operations: reportsSorted.slice(0, 5).map((report) => ({ ...reportTrust(report), operation_plan_id: (report as any).identifiers?.operation_plan_id, operation_id: (report as any).identifiers?.operation_id, title: (report as any).operation_title ?? null, customer_title: (report as any).customer_title ?? null, final_status: safeReportFinalStatus(report), acceptance_status: safeReportAcceptanceStatus(report), generated_at: (report as any).generated_at ?? null })),
    device_summary: { total_devices: Number(params.device_summary.total_devices ?? 0), online_devices: Number(params.device_summary.online_devices ?? 0), offline_devices: Number(params.device_summary.offline_devices ?? 0), last_telemetry_at: params.device_summary.last_telemetry_at ?? null },
    next_action: nextActionSource ? { recommendation_id: (nextActionSource as any).identifiers?.recommendation_id ?? null, explain_human: (nextActionSource as any).why?.explain_human ?? null, objective_text: (nextActionSource as any).why?.objective_text ?? null, action_type: inferActionType(nextActionSource), priority: null } : null,
    value_summary: buildFieldValueSummary(params.reports),
  };
}

export function projectCustomerDashboardAggregateV1(params: { reports: OperationReportV1[]; field_name_by_id?: Map<string, string | null>; open_alerts_by_field?: Map<string, number>; pending_acceptance_by_field?: Map<string, number>; pending_actions_summary?: { total_open_alerts: number; unassigned_alerts: number; in_progress_alerts: number; sla_breached_alerts: number; closed_today_alerts: number; pending_acceptance?: number }; device_summary?: { offline_fields: number; total_devices: number; offline_devices: number } }): CustomerDashboardAggregateV1 {
  const reports = params.reports;
  const trusts = reports.map(reportTrust);
  const aggregateTrust: DashboardProjectionTrustV1 = trusts.length && trusts.every((t) => t.customer_visible_eligible)
    ? { projection_source: "GUARDED_REPORT", fallback_limited: false, customer_visible_eligible: true, blocking_reasons: [] }
    : { projection_source: "STATE_FALLBACK_LIMITED", fallback_limited: true, customer_visible_eligible: false, blocking_reasons: unique(trusts.flatMap((t) => t.blocking_reasons).concat(trusts.length ? [] : [WEAK_REPORT_BLOCKING_REASON])) };
  const sortedReports = [...reports].sort((a, b) => resolveOperationTimeMs(b) - resolveOperationTimeMs(a));
  const recentOperations: DashboardRecentOperationV1[] = sortedReports.slice(0, 5).map((report) => {
    const trust = reportTrust(report);
    const fieldId = resolveReportFieldId(report);
    return {
      ...trust,
      operation_id: String((report as any).identifiers?.operation_id ?? ""),
      operation_plan_id: String((report as any).identifiers?.operation_plan_id ?? ""),
      field_id: fieldId,
      field_name: params.field_name_by_id?.get(fieldId) ?? null,
      title: (report as any).operation_title ?? null,
      customer_title: (report as any).customer_title ?? null,
      executed_at: toMs((report as any).execution?.execution_finished_at) == null ? null : (report as any).execution?.execution_finished_at,
      final_status: (((report as any).device_anomaly || report.formal_scenario?.scenario_type === "DEVICE_ANOMALY") ? "NEEDS_REVIEW" : safeReportFinalStatus(report)),
      acceptance_status: (((report as any).device_anomaly || report.formal_scenario?.scenario_type === "DEVICE_ANOMALY") ? "NEEDS_REVIEW" : safeReportAcceptanceStatus(report)),
      risk_level: report.risk.level,
      risk_reasons: [...report.risk.reasons],
      estimated_total_cost: Number((report as any).cost?.estimated_total ?? 0),
      execution_duration_ms: (report as any).sla?.execution_duration_ms ?? null,
      scenario_type: (((report as any).device_anomaly || report.formal_scenario?.scenario_type === "DEVICE_ANOMALY") ? "DEVICE_ANOMALY" : (report.formal_scenario?.scenario_type ?? undefined)),
      formal_chain_status: report.formal_scenario?.formal_chain_status ?? undefined,
      evidence_status: report.formal_scenario?.evidence_status ?? undefined,
      fail_safe_status: (report as any).device_anomaly?.fail_safe_status ?? (report as any).fail_safe?.status ?? undefined,
      manual_takeover_status: (report as any).device_anomaly?.manual_takeover_status ?? (report as any).manual_takeover?.status ?? undefined,
      zone_rollup_status: (report as any).zone_matrix?.length ? ((report as any).zone_matrix.every((zone: any) => zone.zone_acceptance_result === "PASS") ? "PASS" : "NEEDS_REVIEW") : undefined,
      customer_visible_eligible: ((report as any).device_anomaly || report.formal_scenario?.scenario_type === "DEVICE_ANOMALY") ? false : trust.customer_visible_eligible,
      needs_review: ((report as any).device_anomaly || report.formal_scenario?.scenario_type === "DEVICE_ANOMALY") ? true : dashboardNeedsReview(trust, report),
      blocking_reasons: unique([...(Array.isArray((report as any).device_anomaly?.missing_evidence) ? (report as any).device_anomaly.missing_evidence : []), (report as any).device_anomaly?.system_block_reason, ...trust.blocking_reasons]),
      sampling_lab_result_status: (report as any).sampling?.lab_result_status ?? undefined,
      sampling_acceptance_status: (report as any).sampling?.acceptance_status ?? undefined,
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
  const fieldAgg = new Map<string, { field_id: string; field_name: string | null; risk_level: OperationReportRiskLevel; risk_reasons: Set<string>; open_alerts_count: number; pending_acceptance_count: number; last_operation_at: string | null; last_operation_ms: number }>();

  for (const report of reports) {
    const trust = reportTrust(report);
    globalRisk = maxRisk(globalRisk, report.risk.level);
    estimatedTotalCost += Number((report as any).cost?.estimated_total ?? 0);
    actualTotalCost += Number((report as any).cost?.actual_total ?? 0);
    if (report.risk.level === "LOW") healthy += 1; else atRisk += 1;
    if (trust.customer_visible_eligible && upper((report as any).execution?.final_status) === "PENDING_ACCEPTANCE") pendingAcceptanceCount += 1;
    const duration = (report as any).sla?.execution_duration_ms;
    if (typeof duration === "number" && Number.isFinite(duration)) { slaSum += duration; slaCount += 1; }
    for (const reasonRaw of report.risk.reasons) {
      const reason = String(reasonRaw ?? "").trim();
      if (reason) reasonCount.set(reason, (reasonCount.get(reason) ?? 0) + 1);
    }
    const fieldId = resolveReportFieldId(report);
    if (!fieldId) continue;
    const current = fieldAgg.get(fieldId) ?? { field_id: fieldId, field_name: params.field_name_by_id?.get(fieldId) ?? null, risk_level: "LOW" as OperationReportRiskLevel, risk_reasons: new Set<string>(), open_alerts_count: Number(params.open_alerts_by_field?.get(fieldId) ?? 0), pending_acceptance_count: Number(params.pending_acceptance_by_field?.get(fieldId) ?? 0), last_operation_at: null, last_operation_ms: 0 };
    current.risk_level = maxRisk(current.risk_level, report.risk.level);
    for (const reasonRaw of report.risk.reasons) {
      const reason = String(reasonRaw ?? "").trim();
      if (reason) current.risk_reasons.add(reason);
    }
    const opMs = resolveOperationTimeMs(report);
    if (opMs >= current.last_operation_ms) {
      current.last_operation_ms = opMs;
      current.last_operation_at = (report as any).execution?.execution_finished_at ?? report.generated_at ?? null;
    }
    fieldAgg.set(fieldId, current);
  }

  const topReasons = [...reasonCount.entries()].sort((a, b) => (b[1] - a[1]) || a[0].localeCompare(b[0])).slice(0, 5).map(([reason]) => reason);
  const topRiskFields = [...fieldAgg.values()].sort((a, b) => (RISK_RANK[b.risk_level] - RISK_RANK[a.risk_level]) || (b.open_alerts_count - a.open_alerts_count) || (b.pending_acceptance_count - a.pending_acceptance_count) || (b.last_operation_ms - a.last_operation_ms) || a.field_id.localeCompare(b.field_id)).slice(0, 5).map((item) => ({ field_id: item.field_id, field_name: item.field_name, risk_level: item.risk_level, risk_reasons: [...item.risk_reasons].slice(0, 3), open_alerts_count: item.open_alerts_count, pending_acceptance_count: item.pending_acceptance_count, last_operation_at: item.last_operation_at }));

  return {
    ...aggregateTrust,
    fields: { total: reports.length, healthy, at_risk: atRisk },
    top_risk_fields: topRiskFields,
    recent_operations: recentOperations,
    risk_summary: { level: globalRisk, top_reasons: topReasons },
    period_summary: { total_operations: reports.length, estimated_total_cost: estimatedTotalCost, actual_total_cost: actualTotalCost, avg_sla_ms: slaCount > 0 ? slaSum / slaCount : null },
    pending_actions_summary: { total_open_alerts: Number(params.pending_actions_summary?.total_open_alerts ?? 0), unassigned_alerts: Number(params.pending_actions_summary?.unassigned_alerts ?? 0), in_progress_alerts: Number(params.pending_actions_summary?.in_progress_alerts ?? 0), sla_breached_alerts: Number(params.pending_actions_summary?.sla_breached_alerts ?? 0), closed_today_alerts: Number(params.pending_actions_summary?.closed_today_alerts ?? 0), pending_acceptance: Number(params.pending_actions_summary?.pending_acceptance ?? pendingAcceptanceCount) },
    device_summary: { offline_fields: Number(params.device_summary?.offline_fields ?? 0), total_devices: Number(params.device_summary?.total_devices ?? 0), offline_devices: Number(params.device_summary?.offline_devices ?? 0) },
    roi_summary: buildDashboardRoiSummary(reports),
  };
}

export function projectCustomerDashboardAggregateFromStatesV1(params: { states: OperationStateV1[]; field_ids: string[]; field_name_by_id?: Map<string, string | null>; open_alerts_by_field?: Map<string, number>; pending_actions_summary?: { total_open_alerts: number; unassigned_alerts: number; in_progress_alerts: number; sla_breached_alerts: number; closed_today_alerts: number }; device_summary?: { offline_fields: number; total_devices: number; offline_devices: number } }): CustomerDashboardAggregateV1 {
  const sortedStates = [...params.states].sort((a, b) => Number((b as any).last_event_ts ?? 0) - Number((a as any).last_event_ts ?? 0));
  const trust = dashboardTrustFromStateFallbackV1();
  const reasonCount = new Map<string, number>();
  const perField = new Map<string, { field_id: string; risk_level: OperationReportRiskLevel; risk_reasons: Set<string>; last_operation_ms: number }>();
  for (const state of sortedStates) {
    const fieldId = String((state as any).field_id ?? "").trim();
    if (!fieldId) continue;
    const riskLevel = deriveStateRiskLevel(state);
    const riskReasons = deriveStateRiskReasons(state);
    for (const reason of riskReasons) reasonCount.set(reason, (reasonCount.get(reason) ?? 0) + 1);
    const agg = perField.get(fieldId) ?? { field_id: fieldId, risk_level: "LOW" as OperationReportRiskLevel, risk_reasons: new Set<string>(), last_operation_ms: 0 };
    agg.risk_level = maxRisk(agg.risk_level, riskLevel);
    for (const reason of riskReasons) agg.risk_reasons.add(reason);
    const lastMs = Number((state as any).last_event_ts ?? 0);
    if (Number.isFinite(lastMs) && lastMs > agg.last_operation_ms) agg.last_operation_ms = lastMs;
    perField.set(fieldId, agg);
  }
  const fieldIds = params.field_ids.length > 0 ? params.field_ids : [...perField.keys()];
  let healthy = 0;
  let atRisk = 0;
  for (const fieldId of fieldIds) {
    const risk = perField.get(fieldId)?.risk_level ?? "LOW";
    if (risk === "LOW") healthy += 1; else atRisk += 1;
  }
  const topReasons = [...reasonCount.entries()].sort((a, b) => (b[1] - a[1]) || a[0].localeCompare(b[0])).slice(0, 5).map(([reason]) => reason);
  const riskSummaryLevel = [...perField.values()].reduce<OperationReportRiskLevel>((acc, item) => maxRisk(acc, item.risk_level), "LOW");
  const recent_operations: DashboardRecentOperationV1[] = sortedStates.slice(0, 5).map((state) => {
    const fieldId = String((state as any).field_id ?? "").trim();
    const riskReasons = deriveStateRiskReasons(state);
    return {
      ...trust,
      operation_id: String((state as any).operation_id ?? "").trim(),
      operation_plan_id: String((state as any).operation_plan_id ?? (state as any).operation_id ?? "").trim(),
      field_id: fieldId,
      field_name: params.field_name_by_id?.get(fieldId) ?? null,
      title: null,
      customer_title: null,
      executed_at: toIsoFromMs(Number((state as any).last_event_ts ?? 0)),
      final_status: safeStateFinalStatus(),
      acceptance_status: safeStateAcceptanceStatus(state),
      risk_level: deriveStateRiskLevel(state),
      risk_reasons: riskReasons,
      estimated_total_cost: 0,
      execution_duration_ms: null,
      scenario_type: "UNKNOWN",
      formal_chain_status: "BLOCKED",
      evidence_status: "BLOCKED",
      fail_safe_status: undefined,
      manual_takeover_status: undefined,
      zone_rollup_status: undefined,
      customer_visible_eligible: false,
      needs_review: true,
      blocking_reasons: [...trust.blocking_reasons],
    };
  });
  return {
    ...trust,
    fields: { total: fieldIds.length, healthy, at_risk: atRisk },
    top_risk_fields: [...fieldIds].map((fieldId) => {
      const agg = perField.get(fieldId);
      return { field_id: fieldId, field_name: params.field_name_by_id?.get(fieldId) ?? null, risk_level: agg?.risk_level ?? "LOW", risk_reasons: agg ? [...agg.risk_reasons] : [], open_alerts_count: Number(params.open_alerts_by_field?.get(fieldId) ?? 0), pending_acceptance_count: 0, last_operation_at: toIsoFromMs(agg?.last_operation_ms ?? null) };
    }).sort((a, b) => (RISK_RANK[b.risk_level] - RISK_RANK[a.risk_level]) || (b.open_alerts_count - a.open_alerts_count) || ((toMs(b.last_operation_at) ?? 0) - (toMs(a.last_operation_at) ?? 0))).slice(0, 5),
    recent_operations,
    risk_summary: { level: riskSummaryLevel, top_reasons: topReasons },
    period_summary: { total_operations: sortedStates.length, estimated_total_cost: 0, actual_total_cost: 0, avg_sla_ms: null },
    pending_actions_summary: { total_open_alerts: Number(params.pending_actions_summary?.total_open_alerts ?? 0), unassigned_alerts: Number(params.pending_actions_summary?.unassigned_alerts ?? 0), in_progress_alerts: Number(params.pending_actions_summary?.in_progress_alerts ?? 0), sla_breached_alerts: Number(params.pending_actions_summary?.sla_breached_alerts ?? 0), closed_today_alerts: Number(params.pending_actions_summary?.closed_today_alerts ?? 0), pending_acceptance: 0 },
    device_summary: { offline_fields: Number(params.device_summary?.offline_fields ?? 0), total_devices: Number(params.device_summary?.total_devices ?? 0), offline_devices: Number(params.device_summary?.offline_devices ?? 0) },
    roi_summary: limitedRoiSummary(sortedStates.length),
  };
}

export function projectFieldPortfolioSummaryV1(reports: OperationReportV1[]): FieldPortfolioSummaryV1 {
  const aggregate = projectCustomerDashboardAggregateV1({ reports });
  const byField = new Map<string, { field_id: string; risk_level: OperationReportRiskLevel; risk_reasons: Set<string>; operation_count: number; total_estimated_cost: number; last_executed_at: string | null; last_executed_ms: number }>();
  for (const report of reports) {
    const fieldId = resolveReportFieldId(report);
    if (!fieldId) continue;
    const current = byField.get(fieldId) ?? { field_id: fieldId, risk_level: "LOW" as OperationReportRiskLevel, risk_reasons: new Set<string>(), operation_count: 0, total_estimated_cost: 0, last_executed_at: null, last_executed_ms: 0 };
    current.risk_level = maxRisk(current.risk_level, report.risk.level);
    for (const reasonRaw of report.risk.reasons) {
      const reason = String(reasonRaw ?? "").trim();
      if (reason) current.risk_reasons.add(reason);
    }
    current.operation_count += 1;
    current.total_estimated_cost += Number((report as any).cost?.estimated_total ?? 0);
    const executedAtMs = toMs((report as any).execution?.execution_finished_at) ?? toMs((report as any).generated_at) ?? 0;
    if (executedAtMs >= current.last_executed_ms) {
      current.last_executed_ms = executedAtMs;
      current.last_executed_at = (report as any).execution?.execution_finished_at ?? report.generated_at ?? null;
    }
    byField.set(fieldId, current);
  }
  const topRiskFields = [...byField.values()].sort((a, b) => (RISK_RANK[b.risk_level] - RISK_RANK[a.risk_level]) || (b.operation_count - a.operation_count) || (b.total_estimated_cost - a.total_estimated_cost) || (b.last_executed_ms - a.last_executed_ms) || a.field_id.localeCompare(b.field_id)).slice(0, 5).map((item) => ({ field_id: item.field_id, risk_level: item.risk_level, risk_reasons: [...item.risk_reasons].slice(0, 3), operation_count: item.operation_count, total_estimated_cost: item.total_estimated_cost, last_executed_at: item.last_executed_at }));
  return { ...aggregate, top_risk_fields: topRiskFields };
}
