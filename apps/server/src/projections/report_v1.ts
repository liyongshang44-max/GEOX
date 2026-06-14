import { evaluateRisk } from "../domain/risk_engine.js";
import type { FertilizationReportProjectionV1 } from "../services/fertilization/fertilization_projection_v1.js";
import type { PestDiseaseInspectionReportProjectionV1 } from "../services/inspection/pest_disease_inspection_projection_v1.js";
import type { OperationStateV1 } from "./operation_state_v1.js";
import { applyDeviceAnomalyReportGuardV1 } from "./device_anomaly_report_v1.js";

export type OperationReportRiskLevel = "LOW" | "MEDIUM" | "HIGH";
export type OperationReportFormalScenarioTypeV1 =
  | "FORMAL_IRRIGATION"
  | "DEVICE_ANOMALY"
  | "FORMAL_VARIABLE_OPERATION"
  | "FORMAL_SAMPLING"
  | "FORMAL_FERTILIZATION"
  | "FORMAL_PEST_DISEASE_INSPECTION"
  | "UNKNOWN";
export type OperationReportPestDiseaseInspectionV1 = PestDiseaseInspectionReportProjectionV1 & {
  inspection_id: PestDiseaseInspectionReportProjectionV1["inspection_id"];
  acceptance_status: PestDiseaseInspectionReportProjectionV1["acceptance_status"];
  customer_visible_eligible: PestDiseaseInspectionReportProjectionV1["customer_visible_eligible"];
  observation_evidence: PestDiseaseInspectionReportProjectionV1["observation_evidence"];
  blocking_reasons: PestDiseaseInspectionReportProjectionV1["blocking_reasons"];
};
export type OperationReportFertilizationV1 = FertilizationReportProjectionV1;

export type FieldMemorySummary = {
  memory_id: string;
  memory_type: string;
  metric_key: string;
  before_value?: number | null;
  after_value?: number | null;
  delta_value?: number | null;
  target_range?: { min?: number | null; max?: number | null } | null;
  confidence: number;
  summary_text: string;
  evidence_refs: unknown[];
  skill_id?: string | null;
  skill_trace_ref?: string | null;
  occurred_at: string;
};


export type RoiLedgerSummary = {
  roi_ledger_id: string;
  roi_type: string;

  baseline: { type: string; value: number | null; unit: string | null };
  planned: { value: number | null; unit: string | null };
  actual: { value: number | null; unit: string | null };
  delta: { value: number | null; unit: string | null };

  baseline_type: string;
  baseline_value: number | null;
  planned_value: number | null;
  actual_value: number | null;
  delta_value: number | null;
  unit: string | null;

  value_kind: "MEASURED" | "ESTIMATED" | "ASSUMPTION_BASED" | "INSUFFICIENT_EVIDENCE";

  confidence: {
    level: string;
    basis: string;
    reasons: string[];
  };

  evidence_refs: unknown[];

  calculation_method: string;
  assumptions: Record<string, unknown>;
  uncertainty_notes: string | null;

  source_skill_id: string | null;
  skill_trace_ref: string | null;
  skill_trace_id: string | null;
  skill_refs: Array<{ skill_id: string | null; skill_version: string | null; trace_id: string | null; run_id: string | null }>;
  field_memory_refs: string[];

  estimated_money_value: number | null;
  currency: string | null;

  customer_text: string;

  trust_level: string | null;
  source_lane: string | null;
  formal_acceptance_id: string | null;
  formal_evidence_passed: boolean;
  chain_validation_passed: boolean;
  customer_visible_value: boolean;
  trust_reasons: string[];
};


export type DiagnosticInputDeviceV1 = {
  device_id: string;
  display_name: string | null;
  capability: string | null;
  metric: string | null;
  value: number | null;
  unit: string | null;
  field_id?: string | null;
  display_kind_text?: string | null;
  sensing_role_text?: string | null;
  capabilities?: string[];
  capability_text?: string | null;
  online_status?: string | null;
  last_heartbeat_ts_ms?: number | null;
  last_telemetry_ts_ms?: number | null;
  contributed_metrics?: string[];
  data_sources?: string[];
};

export type DiagnosticInputObservationV1 = {
  metric: string;
  label: string;
  value: number | null;
  unit: string | null;
  role: "diagnosis_input" | "agronomy_context" | "acceptance_input";
  observed_at_ts_ms?: number | null;
  source_device_id?: string | null;
  source_fact_id?: string | null;
};

export type DiagnosticInputsV1 = {
  field_id: string | null;
  devices: DiagnosticInputDeviceV1[];
  observations: DiagnosticInputObservationV1[];
  diagnosis: { human: string | null };
};

export type OperationReportV1 = {
  type: "operation_report_v1";
  version: "v1";
  generated_at: string;
  field_name: string | null;
  approval: {
    status: string | null;
    actor_id: string | null;
    actor_name: string | null;
    generated_at: string | null;
    approved_at: string | null;
    note: string | null;
  };
  why: {
    explain_human: string | null;
    objective_text: string | null;
  };
  diagnostic_inputs?: DiagnosticInputsV1;
  weather_summary?: {
    rainfall_forecast_mm: number | null;
    max_temperature_c: number | null;
    narrative: string | null;
    weather_forecast_id?: string | null;
    source_quality?: {
      provider: string | null;
      source_type: string | null;
      provider_status: string | null;
      stale: boolean | null;
      missing_fields: string[];
    } | null;
  } | null;
  irrigation_requirement_summary?: {
    requirement_id: string | null;
    source_forecast_id: string | null;
    source_fact_id: string | null;
    source_observation_refs: string[];
    skill_id: string | null;
    skill_version: string | null;
    skill_run_id: string | null;
    field_id: string | null;
    season_id: string | null;
    crop_code: string | null;
    crop_stage: string | null;
    root_zone_soil_moisture_percent: number | null;
    target_soil_moisture_percent: number | null;
    target_min_soil_moisture_percent: number | null;
    target_max_soil_moisture_percent: number | null;
    rainfall_forecast_mm_72h: number | null;
    effective_rainfall_mm_72h: number | null;
    temperature_max_c_72h: number | null;
    net_irrigation_mm: number | null;
    gross_irrigation_mm: number | null;
    gross_irrigation_requirement_mm: number | null;
    unit: string | null;
    calculation_method: string | null;
    calculation_inputs: Record<string, unknown>;
    source_quality: {
      status: string | null;
      source: string | null;
      deterministic: boolean | null;
      missing_fields: string[];
    } | null;
    binding: {
      requirement_to_forecast: boolean;
      requirement_to_field: boolean;
      report_binding_status: "BOUND" | "MISSING_REQUIREMENT" | "FORECAST_MISMATCH";
    };
    narrative: string | null;
  } | null;
  customer_memory_summary?: {
    title: string;
    learned: string | null;
    confidence: number | string | null;
    before_value?: number | null;
    after_value?: number | null;
    delta_value?: number | null;
  } | null;
  spatial_execution?: {
    available: boolean;
    coverage_pct: number | null;
    applied_mm: number | null;
    planned_mm: number | null;
    map_available: boolean;
    map_url: string | null;
    map_unavailable_reason: string | null;
    coverage_geojson?: Record<string, unknown> | null;
    evidence_refs?: unknown[];
  } | null;
  operation_outcome_summary?: {
    title: string;
    summary: string | null;
    before_value: number | null;
    after_value: number | null;
    delta_value: number | null;
    acceptance_status: string | null;
  } | null;
  operation_title: string | null;
  customer_title: string | null;
  identifiers: {
    tenant_id: string;
    project_id: string;
    group_id: string;
    field_id: string | null;
    operation_plan_id: string;
    operation_id: string;
    recommendation_id: string | null;
    prescription_id: string | null;
    approval_id: string | null;
    skill_trace_id: string | null;
    skill_run_id: string | null;
    as_executed_id: string | null;
    act_task_id: string | null;
    receipt_id: string | null;
  };
  prescription?: {
    prescription_id: string | null;
    amount: number | null;
    unit: string | null;
    operation_type: string | null;
  } | null;
  as_executed: {
    as_executed_id?: string | null;
    planned_amount?: number | null;
    executed_amount?: number | null;
    unit?: string | null;
    deviation?: number | null;
    status?: string | null;
    operation_id: string;
    execution_mode: "DEVICE" | "HUMAN";
    started_at: string | null;
    finished_at: string | null;
    actual_params: Record<string, unknown>;
    receipt_id: string | null;
    device_id: string | null;
    operator_id: string | null;
    deviation_summary: string | null;
  };
  execution: {
    final_status: string;
    invalid_execution: boolean;
    invalid_reason: string | null;
    dispatched_at: string | null;
    execution_started_at: string | null;
    execution_finished_at: string | null;
    response_time_ms: number | null;
  };
  acceptance: {
    status: "PASS" | "FAIL" | "PENDING" | "NOT_AVAILABLE";
    verdict: string | null;
    missing_evidence: boolean;
    missing_items: string[];
    generated_at: string | null;
  };
  evidence: {
    artifacts_count: number;
    logs_count: number;
    media_count: number;
    metrics_count: number;
    receipt_present: boolean;
    acceptance_present: boolean;
  };
  cost: {
    estimated_total: number;
    actual_total?: number;
    actual_water_cost?: number;
    actual_electric_cost?: number;
    actual_chemical_cost?: number;
    estimated_water_cost?: number;
    estimated_electric_cost?: number;
    estimated_chemical_cost?: number;
  };
  sla: {
    dispatch_latency_quality: "VALID" | "MISSING_DATA" | "INVALID_ORDER";
    execution_duration_quality: "VALID" | "MISSING_DATA" | "INVALID_ORDER";
    acceptance_latency_quality: "VALID" | "MISSING_DATA" | "INVALID_ORDER";
    execution_success: boolean;
    acceptance_pass: boolean;
    response_time_ms: number | null;
    dispatch_latency_ms?: number;
    execution_duration_ms?: number;
    acceptance_latency_ms?: number;
    invalid_reasons: ReportV1SlaInvalidReason[];
    pending_acceptance_elapsed_ms: number | null;
    pending_acceptance_over_30m: boolean;
  };
  risk: {
    level: OperationReportRiskLevel;
    reasons: string[];
  };
  field_memory: {
    field_response_memory: FieldMemorySummary[];
    device_reliability_memory: FieldMemorySummary[];
    skill_performance_memory: FieldMemorySummary[];
  };
  roi_ledger: {
    summary: {
      total_items: number;
      measured_items: number;
      estimated_items: number;
      assumption_based_items: number;
      insufficient_items: number;
      low_confidence_items: number;
      has_customer_visible_value: boolean;
    };
    items: RoiLedgerSummary[];
    water_saved: RoiLedgerSummary[];
    labor_saved: RoiLedgerSummary[];
    early_warning_lead_time: RoiLedgerSummary[];
    first_pass_acceptance_rate: RoiLedgerSummary[];
    low_confidence_items: RoiLedgerSummary[];
  };
  as_applied: {
    coverage_percent?: number | null;
    field_id?: string | null;
    operation_id: string;
    coverage_status: "AVAILABLE" | "MISSING" | "NOT_APPLICABLE";
    coverage_geojson: Record<string, unknown> | null;
    planned_geojson: Record<string, unknown> | null;
    applied_amount_summary: string | null;
    planned_vs_actual_deviation: string | null;
    evidence_ref: string | null;
    application?: Record<string, unknown> | null;
  };
  zone_applications?: unknown[];
  zone_evidence_customer_v1?: {
    zone_matrix: Array<{ zone_id: string | null; zone_acceptance_result: string | null; operation_rollup_policy: string | null }>;
    operation_rollup_policy: string | null;
  };
  zone_evidence_operator_debug_v1?: {
    label: "技术诊断";
    collapsed_by_default: boolean;
    stage1_debug_matrix: Array<{ zone_id: string | null; stage1_debug: { formal_coverage_ratio: unknown; trigger_metric_evidence: unknown; stage1_source: unknown } }>;
  };
  formal_scenario?: {
    scenario_type: OperationReportFormalScenarioTypeV1;
    formal_chain_status: "PASSED" | "NEEDS_REVIEW" | "INSUFFICIENT_EVIDENCE" | "SIMULATED" | "LIMITED";
    evidence_status: "FORMAL_PASSED" | "MISSING" | "SIMULATED" | "TECHNICAL_ONLY";
    customer_visible_eligible: boolean;
    needs_review: boolean;
    blocking_reasons: string[];
  };
  sampling?: {
    plan_id: string | null;
    sample_id: string | null;
    sample_type: "SOIL" | "TISSUE" | "WATER" | null;
    zone_id: string | null;
    collected_at_ts: number | null;
    lab_result_status: "PASS" | "NEEDS_REVIEW" | "INVALID" | "MISSING";
    acceptance_status: "PASS" | "NEEDS_REVIEW" | "FAIL" | "MISSING";
    customer_visible_eligible: boolean;
    blocking_reasons: string[];
  };
  fertilization?: OperationReportFertilizationV1;
  pest_disease_inspection?: OperationReportPestDiseaseInspectionV1;
  device_anomaly?: import("./device_anomaly_report_v1.js").DeviceAnomalyReportV1;

  fail_safe?: {
    status: "NONE" | "OPEN" | "ACKED" | "COMPLETED" | "RESOLVED";
    trigger: string | null;
    severity: string | null;
    event_id: string | null;
  };
  manual_takeover?: {
    status: "NONE" | "REQUESTED" | "ACKED" | "COMPLETED";
    takeover_id: string | null;
    reason: string | null;
  };
  zone_matrix?: Array<{
    zone_id: string;
    planned_rate: number | null;
    actual_rate: number | null;
    coverage_percent: number | null;
    deviation_percent: number | null;
    pre_sensing_ref: string | null;
    post_sensing_ref: string | null;
    evidence_sufficiency: "PASS" | "FAIL" | "NEEDS_EVIDENCE";
    zone_acceptance_result: "PASS" | "FAIL" | "PARTIAL" | "NEEDS_REVIEW";
    operation_rollup_policy: "ALL_REQUIRED_PASS" | "PARTIAL_ALLOWED" | "CRITICAL_ZONE_REQUIRED";
  }>;
  planned: {
    planned_area: Record<string, unknown> | null;
    planned_path: Record<string, unknown> | null;
    planned_rate: number | null;
    planned_amount: number | null;
  };
  workflow: {
    owner_actor_id: string | null;
    owner_name: string | null;
    last_note: string | null;
    updated_at: string | null;
    updated_by: string | null;
    linked_alert_ids?: string[];
  };
  evidence_pack_summary?: unknown;

};

export type OperationReportSingleResponseV1 = {
  ok: true;
  operation_report_v1: OperationReportV1;
};

export type OperationReportFieldListResponseV1 = {
  ok: true;
  items: OperationReportV1[];
};

type TenantTriple = { tenant_id: string; project_id: string; group_id: string };

type AcceptanceInput = {
  verdict?: unknown;
  missing_evidence?: unknown;
  generated_at?: unknown;
  status?: unknown;
} | null;

type ReceiptInput = {
  execution_started_at?: unknown;
  execution_finished_at?: unknown;
} | null;

type EvidenceBundleInput = {
  artifacts?: unknown[];
  logs?: unknown[];
  media?: unknown[];
  metrics?: unknown[];
};

function toText(v: unknown): string | null {
  if (typeof v === "string") {
    const t = v.trim();
    return t || null;
  }
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return null;
}

function toMs(v: unknown): number | null {
  const t = toText(v);
  if (!t) return null;
  const ms = Date.parse(t);
  return Number.isFinite(ms) ? ms : null;
}


function toObject(v: unknown): Record<string, unknown> | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  return v as Record<string, unknown>;
}

function toNullableNumber(v: unknown): number | null {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}


function normalizeExecutionMode(v: unknown): "DEVICE" | "HUMAN" {
  const mode = String(v ?? "").trim().toUpperCase();
  if (["DEVICE", "AUTO", "AUTOMATIC"].includes(mode)) return "DEVICE";
  return "HUMAN";
}

function pickActualParams(operationState: any, receipt: any): Record<string, unknown> {
  const candidate = operationState?.actual_params
    ?? receipt?.actual_params
    ?? receipt?.params
    ?? receipt?.metrics
    ?? {};
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return {};
  return candidate as Record<string, unknown>;
}


function normalizeCoverageStatus(v: unknown): "AVAILABLE" | "MISSING" | "NOT_APPLICABLE" {
  const s = String(v ?? "").trim().toUpperCase();
  if (s === "AVAILABLE" || s === "MISSING" || s === "NOT_APPLICABLE") return s;
  return "MISSING";
}

function toFiniteNumber(v: unknown, fallback = 0): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

type ReportV1SlaMetrics = {
  dispatch_latency_quality: ReportV1SlaQuality;
  execution_duration_quality: ReportV1SlaQuality;
  acceptance_latency_quality: ReportV1SlaQuality;
  dispatch_latency_ms?: number;
  execution_duration_ms?: number;
  acceptance_latency_ms?: number;
  invalid_reasons: ReportV1SlaInvalidReason[];
};

type ReportV1SlaQuality = "VALID" | "MISSING_DATA" | "INVALID_ORDER";
type ReportV1SlaSource = "timeline" | "receipt" | "acceptance";
type ReportV1SlaInvalidReason =
  | "dispatch_latency_missing_start"
  | "dispatch_latency_missing_end"
  | "dispatch_latency_negative_duration"
  | "execution_duration_missing_start"
  | "execution_duration_missing_end"
  | "execution_duration_negative_duration"
  | "acceptance_latency_missing_start"
  | "acceptance_latency_missing_end"
  | "acceptance_latency_negative_duration";

function resolveSlaTimestamp(params: {
  timelineMs?: number | null;
  receiptMs?: number | null;
  acceptanceMs?: number | null;
}): { value: number | null; source: ReportV1SlaSource | null } {
  if (params.timelineMs != null) return { value: params.timelineMs, source: "timeline" };
  if (params.receiptMs != null) return { value: params.receiptMs, source: "receipt" };
  if (params.acceptanceMs != null) return { value: params.acceptanceMs, source: "acceptance" };
  return { value: null, source: null };
}

function computeSlaDuration(params: {
  startMs: number | null;
  endMs: number | null;
  missingStartReason: ReportV1SlaInvalidReason;
  missingEndReason: ReportV1SlaInvalidReason;
  negativeReason: ReportV1SlaInvalidReason;
  invalidReasons: ReportV1SlaInvalidReason[];
}): { durationMs: number | undefined; quality: ReportV1SlaQuality } {
  const { startMs, endMs, missingStartReason, missingEndReason, negativeReason, invalidReasons } = params;
  if (startMs == null) {
    invalidReasons.push(missingStartReason);
    return { durationMs: undefined, quality: "MISSING_DATA" };
  }
  if (endMs == null) {
    invalidReasons.push(missingEndReason);
    return { durationMs: undefined, quality: "MISSING_DATA" };
  }
  const delta = endMs - startMs;
  if (delta < 0) {
    invalidReasons.push(negativeReason);
    return { durationMs: undefined, quality: "INVALID_ORDER" };
  }
  return { durationMs: delta, quality: "VALID" };
}

export function computeReportV1SlaMetrics(params: {
  timeline: Array<{ ts: number; type: string }>;
  receipt: ReceiptInput;
  acceptance: AcceptanceInput;
}): ReportV1SlaMetrics {
  const invalidReasons: ReportV1SlaInvalidReason[] = [];
  const timelineCreatedAtMs = params.timeline.find((x) => x.type === "RECOMMENDATION_CREATED")?.ts ?? null;
  const timelineDispatchedAtMs = params.timeline.find((x) => x.type === "TASK_CREATED")?.ts ?? null;
  const timelineExecutionStartMs = params.timeline.find((x) => x.type === "EXECUTION_STARTED")?.ts ?? null;
  const timelineExecutionEndMs = params.timeline.find((x) => x.type === "EXECUTION_FINISHED")?.ts ?? null;
  const timelineReceiptSubmittedMs = params.timeline.find((x) => x.type === "RECEIPT_SUBMITTED")?.ts ?? null;
  const timelineAcceptanceGeneratedMs = params.timeline.find((x) => x.type === "ACCEPTANCE_GENERATED")?.ts ?? null;
  const receiptStartMs = toMs(params.receipt?.execution_started_at);
  const receiptEndMs = toMs(params.receipt?.execution_finished_at);
  const acceptanceTsMs = toMs(params.acceptance?.generated_at);

  const dispatchStart = resolveSlaTimestamp({ timelineMs: timelineCreatedAtMs });
  const dispatchEnd = resolveSlaTimestamp({ timelineMs: timelineDispatchedAtMs });
  const executionStart = resolveSlaTimestamp({ timelineMs: timelineExecutionStartMs, receiptMs: receiptStartMs });
  const executionEnd = resolveSlaTimestamp({ timelineMs: timelineExecutionEndMs, receiptMs: receiptEndMs });
  const acceptanceStart = resolveSlaTimestamp({
    timelineMs: timelineReceiptSubmittedMs,
    receiptMs: receiptEndMs,
    acceptanceMs: acceptanceTsMs,
  });
  const acceptanceEnd = resolveSlaTimestamp({ timelineMs: timelineAcceptanceGeneratedMs, acceptanceMs: acceptanceTsMs });

  const dispatchLatency = computeSlaDuration({
    startMs: dispatchStart.value,
    endMs: dispatchEnd.value,
    missingStartReason: "dispatch_latency_missing_start",
    missingEndReason: "dispatch_latency_missing_end",
    negativeReason: "dispatch_latency_negative_duration",
    invalidReasons,
  });

  const executionDuration = computeSlaDuration({
    startMs: executionStart.value,
    endMs: executionEnd.value,
    missingStartReason: "execution_duration_missing_start",
    missingEndReason: "execution_duration_missing_end",
    negativeReason: "execution_duration_negative_duration",
    invalidReasons,
  });

  const acceptanceLatency = computeSlaDuration({
    startMs: acceptanceStart.value,
    endMs: acceptanceEnd.value,
    missingStartReason: "acceptance_latency_missing_start",
    missingEndReason: "acceptance_latency_missing_end",
    negativeReason: "acceptance_latency_negative_duration",
    invalidReasons,
  });

  return {
    dispatch_latency_quality: dispatchLatency.quality,
    execution_duration_quality: executionDuration.quality,
    acceptance_latency_quality: acceptanceLatency.quality,
    dispatch_latency_ms: dispatchLatency.durationMs,
    execution_duration_ms: executionDuration.durationMs,
    acceptance_latency_ms: acceptanceLatency.durationMs,
    invalid_reasons: invalidReasons,
  };
}

function normalizeOperationReportFormalScenarioTypeV1(
  value: unknown,
): OperationReportFormalScenarioTypeV1 | null {
  const key = String(value ?? "").trim().toUpperCase();
  if (key === "FORMAL_IRRIGATION") return "FORMAL_IRRIGATION";
  if (key === "DEVICE_ANOMALY") return "DEVICE_ANOMALY";
  if (key === "FORMAL_VARIABLE_OPERATION") return "FORMAL_VARIABLE_OPERATION";
  if (key === "FORMAL_SAMPLING") return "FORMAL_SAMPLING";
  if (key === "FORMAL_FERTILIZATION") return "FORMAL_FERTILIZATION";
  if (key === "FORMAL_PEST_DISEASE_INSPECTION") return "FORMAL_PEST_DISEASE_INSPECTION";
  if (key === "UNKNOWN") return "UNKNOWN";
  return null;
}

function mergeFertilizationIntoReport(
  report: OperationReportV1,
  fertilization: OperationReportFertilizationV1 | null,
): OperationReportV1 {
  if (!fertilization) return report;

  const scenario = report.formal_scenario ?? {
    scenario_type: "UNKNOWN" as OperationReportFormalScenarioTypeV1,
    formal_chain_status: "LIMITED" as const,
    evidence_status: "MISSING" as const,
    customer_visible_eligible: false,
    needs_review: true,
    blocking_reasons: [],
  };

  const blockingReasons = Array.from(new Set([
    ...(Array.isArray(scenario.blocking_reasons) ? scenario.blocking_reasons : []),
    ...(Array.isArray(fertilization.blocking_reasons) ? fertilization.blocking_reasons : []),
  ].map((x) => String(x ?? "").trim()).filter(Boolean)));

  return {
    ...report,
    fertilization,
    formal_scenario: {
      scenario_type: "FORMAL_FERTILIZATION",
      formal_chain_status: fertilization.customer_visible_eligible
        ? "PASSED"
        : (fertilization.acceptance_status === "MISSING" ? "LIMITED" : "NEEDS_REVIEW"),
      evidence_status: fertilization.evidence_tier === "FORMAL"
        ? "FORMAL_PASSED"
        : (fertilization.evidence_tier === "WARNING" ? "TECHNICAL_ONLY" : "MISSING"),
      customer_visible_eligible: Boolean(fertilization.customer_visible_eligible),
      needs_review: !fertilization.customer_visible_eligible,
      blocking_reasons: blockingReasons,
    },
  };
}

export function projectOperationReportV1(input: {
  tenant: TenantTriple;
  operation_plan_id: string;
  operation_state: OperationStateV1;
  field_name?: unknown;
  evidence_bundle: EvidenceBundleInput;
  acceptance: AcceptanceInput;
  receipt: ReceiptInput;
  cost: {
    estimated_total?: unknown;
    actual_total?: unknown;
    actual_water_cost?: unknown;
    actual_electric_cost?: unknown;
    actual_chemical_cost?: unknown;
    estimated_water_cost?: unknown;
    estimated_electric_cost?: unknown;
    estimated_chemical_cost?: unknown;
  };
  sla: { execution_success?: boolean; acceptance_pass?: boolean; response_time_ms?: number | null };
  operation_workflow?: {
    owner_actor_id?: unknown;
    owner_name?: unknown;
    last_note?: unknown;
    updated_at?: unknown;
    updated_by?: unknown;
    linked_alert_ids?: unknown;
  } | null;
  approval?: {
    status?: unknown;
    actor_id?: unknown;
    actor_name?: unknown;
    generated_at?: unknown;
    approved_at?: unknown;
    note?: unknown;
  } | null;
  why?: {
    explain_human?: unknown;
    objective_text?: unknown;
  } | null;
  diagnostic_inputs?: DiagnosticInputsV1 | null;
  operation_title?: unknown;
  customer_title?: unknown;
  now?: Date;
  roi_ledger?: any[];
  sampling_view?: Partial<NonNullable<OperationReportV1["sampling"]>> | null;
  fertilization_view?: OperationReportFertilizationV1 | null;
}): OperationReportV1 {
  const now = input.now ?? new Date();
  const acceptanceMissingItems = Array.isArray(input.acceptance?.missing_evidence)
    ? input.acceptance?.missing_evidence.map((x) => String(x)).filter(Boolean)
    : [];
  const acceptanceVerdict = toText(input.acceptance?.verdict);
  const acceptanceMissingFlag = input.acceptance?.missing_evidence === true || acceptanceMissingItems.length > 0;
  const acceptanceStatusFromInput = toText(input.acceptance?.status)?.toUpperCase();
  const acceptanceStatus: OperationReportV1["acceptance"]["status"] = acceptanceVerdict
    ? (acceptanceVerdict.toUpperCase().includes("PASS") ? "PASS" : acceptanceVerdict.toUpperCase().includes("FAIL") ? "FAIL" : "PENDING")
    : (acceptanceStatusFromInput === "PASS" || acceptanceStatusFromInput === "FAIL" || acceptanceStatusFromInput === "PENDING"
      ? acceptanceStatusFromInput
      : (input.operation_state.acceptance?.status ?? "NOT_AVAILABLE"));

  const finalStatus = String(input.operation_state.final_status ?? "PENDING").toUpperCase();
  const isInvalidExecution = finalStatus === "INVALID_EXECUTION";
  const dispatchedAtTs = input.operation_state.timeline.find((x) => x.type === "TASK_CREATED")?.ts ?? null;

  const receiptFinishedAtMs = toMs(input.receipt?.execution_finished_at);
  const computedSlaMetrics = computeReportV1SlaMetrics({
    timeline: input.operation_state.timeline,
    receipt: input.receipt,
    acceptance: input.acceptance,
  });
  const pendingAnchorMs = receiptFinishedAtMs ?? input.operation_state.timeline.find((x) => x.type === "RECEIPT_SUBMITTED")?.ts ?? null;
  const pendingAcceptanceElapsedMs = finalStatus === "PENDING_ACCEPTANCE" && pendingAnchorMs != null
    ? Math.max(0, now.getTime() - pendingAnchorMs)
    : null;
  const pendingAcceptanceOver30m = pendingAcceptanceElapsedMs != null && pendingAcceptanceElapsedMs > 30 * 60 * 1000;

  const missingEvidence = acceptanceMissingFlag;
  const roiRows = Array.isArray(input.roi_ledger) ? input.roi_ledger : [];
  const toNum = (v: unknown): number | null => {
    const n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) ? n : null;
  };
  const VALUE_KIND_WHITELIST = new Set(["MEASURED", "ESTIMATED", "ASSUMPTION_BASED", "INSUFFICIENT_EVIDENCE"]);
  function buildCustomerText(x: any): string {
    const hasBaseline = x?.baseline_value != null;
    const delta = x?.delta_value ?? "--";
    const unit = x?.unit ?? "";
    const confidence = x?.confidence?.level ?? "LOW";
    const evidenceCount = Array.isArray(x?.evidence_refs) ? x.evidence_refs.length : 0;
    const baseText = `价值记录：${delta}${unit}（可信度 ${confidence}，证据 ${evidenceCount} 项）`;
    if (!hasBaseline) return baseText;
    const roiType = String(x?.roi_type ?? "");
    if (roiType === "WATER_SAVED") return `节水：${delta}${unit}（可信度 ${confidence}，证据 ${evidenceCount} 项）`;
    if (roiType === "LABOR_SAVED") return `节省工时：${delta}${unit}（可信度 ${confidence}，证据 ${evidenceCount} 项）`;
    return baseText;
  }
  const toSummary = (x: any): RoiLedgerSummary => {
    const evidence = Array.isArray(x?.evidence_refs) ? x.evidence_refs : [];
    const confidence = x?.confidence ?? {};
    const valueKind = String(x?.value_kind ?? "INSUFFICIENT_EVIDENCE").toUpperCase();

    let normalizedKind = VALUE_KIND_WHITELIST.has(valueKind) ? valueKind : "INSUFFICIENT_EVIDENCE";
    if (normalizedKind === "MEASURED" && evidence.length === 0) {
      normalizedKind = "INSUFFICIENT_EVIDENCE";
    }

    return {
      roi_ledger_id: String(x?.roi_ledger_id ?? ""),
      roi_type: String(x?.roi_type ?? ""),

      baseline: { type: String(x?.baseline_type ?? "DEFAULT"), value: toNum(x?.baseline_value), unit: x?.unit ?? null },
      planned: { value: toNum(x?.planned_value), unit: x?.unit ?? null },
      actual: { value: toNum(x?.actual_value), unit: x?.unit ?? null },
      delta: { value: toNum(x?.delta_value), unit: x?.unit ?? null },

      baseline_type: String(x?.baseline_type ?? "DEFAULT"),
      baseline_value: toNum(x?.baseline_value),
      planned_value: toNum(x?.planned_value),
      actual_value: toNum(x?.actual_value),
      delta_value: toNum(x?.delta_value),
      unit: x?.unit ?? null,

      value_kind: (normalizedKind === "MEASURED" || normalizedKind === "ESTIMATED" || normalizedKind === "ASSUMPTION_BASED" || normalizedKind === "INSUFFICIENT_EVIDENCE"
        ? normalizedKind
        : "INSUFFICIENT_EVIDENCE"),

      confidence: {
        level: String(confidence.level ?? "LOW"),
        basis: String(confidence.basis ?? "unknown"),
        reasons: Array.isArray(confidence.reasons) ? confidence.reasons : [],
      },

      evidence_refs: evidence,

      calculation_method: String(x?.calculation_method ?? "manual"),

      assumptions: x?.assumptions ?? {},

      uncertainty_notes: x?.uncertainty_notes ?? null,

      source_skill_id: x?.source_skill_id ?? null,
      skill_trace_ref: x?.skill_trace_ref ?? null,
      skill_trace_id: x?.skill_trace_id ?? x?.skill_trace_ref ?? null,
      skill_refs: Array.isArray(x?.skill_refs) ? x.skill_refs.map((ref: any) => ({
        skill_id: ref?.skill_id != null ? String(ref.skill_id) : null,
        skill_version: ref?.skill_version != null ? String(ref.skill_version) : null,
        trace_id: ref?.trace_id != null ? String(ref.trace_id) : null,
        run_id: ref?.run_id != null ? String(ref.run_id) : null,
      })) : [],
      field_memory_refs: Array.isArray(x?.field_memory_refs) ? x.field_memory_refs.map((v: any) => String(v)).filter(Boolean) : [],
      estimated_money_value: toNum(x?.estimated_money_value),
      currency: x?.currency != null ? String(x.currency) : null,

      customer_text: buildCustomerText(x),

      trust_level: x?.trust_level ?? null,
      source_lane: x?.source_lane ?? null,
      formal_acceptance_id: x?.formal_acceptance_id ?? null,
      formal_evidence_passed: x?.formal_evidence_passed === true,
      chain_validation_passed: x?.chain_validation_passed === true,
      customer_visible_value: x?.customer_visible_value === true,
      trust_reasons: Array.isArray(x?.trust_reasons) ? x.trust_reasons : [],
    };
  };
  const roiSummaries = roiRows.map(toSummary);
  const roiSummary = {
    total_items: roiSummaries.length,
    measured_items: roiSummaries.filter((x) => x.value_kind === "MEASURED").length,
    estimated_items: roiSummaries.filter((x) => x.value_kind === "ESTIMATED").length,
    assumption_based_items: roiSummaries.filter((x) => x.value_kind === "ASSUMPTION_BASED").length,
    insufficient_items: roiSummaries.filter((x) => x.value_kind === "INSUFFICIENT_EVIDENCE").length,
    low_confidence_items: roiSummaries.filter((x) => String((x.confidence as any)?.level ?? "").toUpperCase() === "LOW").length,
    has_customer_visible_value: roiSummaries.some((x) => x.estimated_money_value != null || String(x.customer_text ?? "").trim().length > 0),
  };
  const operationStateAny = input.operation_state as any;
  const planned = {
    planned_area: toObject(operationStateAny?.planned_area ?? operationStateAny?.execution_plan?.planned_area ?? operationStateAny?.spatial_scope ?? null),
    planned_path: toObject(operationStateAny?.planned_path ?? operationStateAny?.execution_plan?.planned_path ?? null),
    planned_rate: toNullableNumber(operationStateAny?.planned_rate ?? operationStateAny?.operation_amount?.rate ?? operationStateAny?.execution_plan?.planned_rate),
    planned_amount: toNullableNumber(operationStateAny?.planned_amount ?? operationStateAny?.operation_amount?.amount ?? operationStateAny?.execution_plan?.planned_amount),
  };

  const asExecuted = {
    operation_id: input.operation_state.operation_id,
    execution_mode: normalizeExecutionMode((input.operation_state as any)?.execution_mode ?? (input.operation_state as any)?.executor_type),
    started_at: toText(input.receipt?.execution_started_at ?? (input.operation_state as any)?.execution_started_at),
    finished_at: toText(input.receipt?.execution_finished_at ?? (input.operation_state as any)?.execution_finished_at),
    actual_params: pickActualParams(input.operation_state as any, input.receipt as any),
    receipt_id: toText(input.operation_state.receipt_id),
    device_id: toText(
      input.operation_state.device_id
      ?? (input.receipt as any)?.device_id
      ?? (input.receipt as any)?.executor?.device_id
      ?? (input.receipt as any)?.operator?.device_id,
    ),
    operator_id: toText(
      (input.operation_state as any)?.operator_id
      ?? (input.receipt as any)?.operator_id
      ?? (input.receipt as any)?.operator?.operator_id
      ?? (input.receipt as any)?.executor?.operator_id
      ?? (input.receipt as any)?.executor_id,
    ),
    deviation_summary: toText((input.operation_state as any)?.deviation_summary ?? (input.receipt as any)?.deviation_summary),
  };

  const asAppliedRaw = (input.operation_state as any)?.as_applied ?? {};
  const asAppliedGeojson = toObject(asAppliedRaw?.coverage_geojson ?? asAppliedRaw?.geojson ?? asAppliedRaw?.coverage ?? null);
  const plannedGeojson = toObject(
    asAppliedRaw?.planned_geojson
    ?? asAppliedRaw?.planned
    ?? planned.planned_area
    ?? planned.planned_path
    ?? null,
  );
  const asAppliedApplication = toObject(asAppliedRaw?.application ?? null);
  const asAppliedCoveragePercent = Number.isFinite(Number(asAppliedRaw?.coverage_percent))
    ? Number(asAppliedRaw.coverage_percent)
    : Number.isFinite(Number((asAppliedApplication as any)?.coverage_percent))
      ? Number((asAppliedApplication as any).coverage_percent)
      : Number.isFinite(Number((asAppliedApplication as any)?.avg_coverage_percent))
        ? Number((asAppliedApplication as any).avg_coverage_percent)
        : null;
  const asAppliedAmount = Number.isFinite(Number((asAppliedApplication as any)?.applied_amount))
    ? Number((asAppliedApplication as any).applied_amount)
    : Number.isFinite(Number((asAppliedApplication as any)?.actual_amount))
      ? Number((asAppliedApplication as any).actual_amount)
      : Number.isFinite(Number((asAppliedApplication as any)?.executed_amount))
        ? Number((asAppliedApplication as any).executed_amount)
        : null;
  const plannedAppliedAmount = Number.isFinite(Number((asAppliedApplication as any)?.planned_amount))
    ? Number((asAppliedApplication as any).planned_amount)
    : Number.isFinite(Number((asAppliedApplication as any)?.target_amount))
      ? Number((asAppliedApplication as any).target_amount)
      : null;
  const hasAsAppliedRecord = Boolean(asAppliedGeojson)
    || asAppliedCoveragePercent !== null
    || asAppliedAmount !== null
    || plannedAppliedAmount !== null;

  const asApplied = {
    operation_id: input.operation_state.operation_id,
    coverage_status: normalizeCoverageStatus(asAppliedRaw?.coverage_status ?? (hasAsAppliedRecord ? "AVAILABLE" : "MISSING")),
    coverage_geojson: asAppliedGeojson,
    planned_geojson: plannedGeojson,
    applied_amount_summary: toText(asAppliedRaw?.applied_amount_summary ?? asAppliedRaw?.amount_summary),
    planned_vs_actual_deviation: toText(asAppliedRaw?.planned_vs_actual_deviation ?? asAppliedRaw?.deviation_summary),
    evidence_ref: toText(asAppliedRaw?.evidence_ref ?? asAppliedRaw?.evidence_id ?? asAppliedRaw?.trace_id),
    application: asAppliedApplication,
    coverage_percent: asAppliedCoveragePercent,
  };
  const zoneApplications = Array.isArray((asApplied as any)?.application?.zone_applications)
    ? (asApplied as any).application.zone_applications
    : [];
  const zoneMatrixCustomerView = zoneApplications.map((z: any) => ({
    zone_id: String(z?.zone_id ?? "").trim() || null,
    zone_acceptance_result: String(z?.zone_acceptance_result ?? "").trim() || null,
    operation_rollup_policy: String(z?.operation_rollup_policy ?? "").trim() || null,
  }));
  const zoneMatrixOperatorDebug = zoneApplications.map((z: any) => ({
    zone_id: String(z?.zone_id ?? "").trim() || null,
    stage1_debug: {
      formal_coverage_ratio: z?.formal_coverage_ratio ?? null,
      trigger_metric_evidence: z?.trigger_metric_evidence ?? null,
      stage1_source: z?.stage1_source ?? null,
    },
  }));
  const variableByZoneMode = String((asApplied as any)?.application?.mode ?? "").trim().toUpperCase() === "VARIABLE_BY_ZONE";
  const zoneRollupPass = zoneMatrixCustomerView.length > 0
    ? zoneMatrixCustomerView.every((z: any) => String(z?.zone_acceptance_result ?? "").toUpperCase() === "PASS")
    : false;
  const samplingRaw = input.sampling_view ?? {};
  const samplingSampleTypeRaw = String(samplingRaw?.sample_type ?? "").trim().toUpperCase();
  const samplingSampleType = (["SOIL", "TISSUE", "WATER"].includes(samplingSampleTypeRaw) ? samplingSampleTypeRaw : null) as NonNullable<OperationReportV1["sampling"]>["sample_type"];
  const samplingLabStatusRaw = String(samplingRaw?.lab_result_status ?? "").trim().toUpperCase();
  const samplingLabStatus = (["PASS", "NEEDS_REVIEW", "INVALID", "MISSING"].includes(samplingLabStatusRaw) ? samplingLabStatusRaw : "MISSING") as NonNullable<OperationReportV1["sampling"]>["lab_result_status"];
  const samplingAcceptanceStatusRaw = String(samplingRaw?.acceptance_status ?? "").trim().toUpperCase();
  const samplingAcceptanceStatus = (["PASS", "NEEDS_REVIEW", "FAIL", "MISSING"].includes(samplingAcceptanceStatusRaw) ? samplingAcceptanceStatusRaw : "MISSING") as NonNullable<OperationReportV1["sampling"]>["acceptance_status"];
  const samplingBlockingReasons = Array.isArray(samplingRaw?.blocking_reasons)
    ? samplingRaw.blocking_reasons.map((x: unknown) => String(x ?? "").trim()).filter(Boolean)
    : [];

  const operationScenarioType = String(
    operationStateAny?.scenario_type
      ?? operationStateAny?.meta?.scenario_type
      ?? operationStateAny?.operation_scenario_type
      ?? "",
  ).trim().toUpperCase();
  const explicitScenarioType = normalizeOperationReportFormalScenarioTypeV1(operationScenarioType);
  const scenarioType: OperationReportFormalScenarioTypeV1 =
    explicitScenarioType
      ?? (variableByZoneMode
        ? "FORMAL_VARIABLE_OPERATION"
        : (samplingRaw?.sample_id || samplingRaw?.plan_id
          ? "FORMAL_SAMPLING"
          : "UNKNOWN"));
  const chainStatusRaw = String((operationStateAny?.chain_status ?? operationStateAny?.guarded_projection?.chain_status ?? operationStateAny?.formal_chain_status ?? "")).trim().toUpperCase();
  const formalChainStatus: NonNullable<OperationReportV1["formal_scenario"]>["formal_chain_status"] =
    chainStatusRaw === "PASSED" || chainStatusRaw === "NEEDS_REVIEW" || chainStatusRaw === "INSUFFICIENT_EVIDENCE" || chainStatusRaw === "SIMULATED" || chainStatusRaw === "LIMITED"
      ? chainStatusRaw as any
      : "LIMITED";
  const evidenceStatusRaw = String((operationStateAny?.evidence_status ?? operationStateAny?.evidence?.evidence_status ?? "")).trim().toUpperCase();
  const evidenceStatus: NonNullable<OperationReportV1["formal_scenario"]>["evidence_status"] =
    evidenceStatusRaw === "FORMAL_PASSED" || evidenceStatusRaw === "MISSING" || evidenceStatusRaw === "SIMULATED" || evidenceStatusRaw === "TECHNICAL_ONLY"
      ? evidenceStatusRaw as any
      : (formalChainStatus === "PASSED" ? "FORMAL_PASSED" : "MISSING");
  const blockingReasons = Array.isArray(operationStateAny?.guarded_projection?.blocking_reasons)
    ? operationStateAny.guarded_projection.blocking_reasons.map((x: unknown) => String(x ?? "").trim()).filter(Boolean)
    : [];
  const customerVisibleEligible = Boolean(
    operationStateAny?.customer_visible_eligible
    ?? operationStateAny?.guarded_projection?.customer_visible_eligible
    ?? (formalChainStatus === "PASSED"),
  );
  const needsReview = Boolean(operationStateAny?.needs_review ?? !customerVisibleEligible);
  const failSafeRaw = operationStateAny?.fail_safe ?? operationStateAny?.fail_safe_event ?? {};
  const failSafeStatusRaw = String(failSafeRaw?.status ?? "").trim().toUpperCase();
  const failSafeStatus: NonNullable<OperationReportV1["fail_safe"]>["status"] =
    failSafeStatusRaw === "OPEN" || failSafeStatusRaw === "ACKED" || failSafeStatusRaw === "COMPLETED" || failSafeStatusRaw === "RESOLVED"
      ? failSafeStatusRaw as any
      : "NONE";
  const manualTakeoverRaw = operationStateAny?.manual_takeover ?? {};
  const manualTakeoverStatusRaw = String(manualTakeoverRaw?.status ?? "").trim().toUpperCase();
  const manualTakeoverStatus: NonNullable<OperationReportV1["manual_takeover"]>["status"] =
    manualTakeoverStatusRaw === "REQUESTED" || manualTakeoverStatusRaw === "ACKED" || manualTakeoverStatusRaw === "COMPLETED"
      ? manualTakeoverStatusRaw as any
      : "NONE";
  const zoneMatrix: NonNullable<OperationReportV1["zone_matrix"]> = zoneApplications.map((z: any) => ({
    zone_id: String(z?.zone_id ?? "").trim(),
    planned_rate: toNullableNumber(z?.planned_rate),
    actual_rate: toNullableNumber(z?.actual_rate),
    coverage_percent: toNullableNumber(z?.coverage_percent ?? z?.formal_coverage_ratio),
    deviation_percent: toNullableNumber(z?.deviation_percent),
    pre_sensing_ref: toText(z?.pre_sensing_ref),
    post_sensing_ref: toText(z?.post_sensing_ref),
    evidence_sufficiency: (["PASS", "FAIL", "NEEDS_EVIDENCE"].includes(String(z?.evidence_sufficiency ?? "").toUpperCase())
      ? String(z?.evidence_sufficiency).toUpperCase()
      : "NEEDS_EVIDENCE") as any,
    zone_acceptance_result: (["PASS", "FAIL", "PARTIAL", "NEEDS_REVIEW"].includes(String(z?.zone_acceptance_result ?? "").toUpperCase())
      ? String(z?.zone_acceptance_result).toUpperCase()
      : "NEEDS_REVIEW") as any,
    operation_rollup_policy: (["ALL_REQUIRED_PASS", "PARTIAL_ALLOWED", "CRITICAL_ZONE_REQUIRED"].includes(String(z?.operation_rollup_policy ?? "").toUpperCase())
      ? String(z?.operation_rollup_policy).toUpperCase()
      : "ALL_REQUIRED_PASS") as any,
  })).filter((z) => z.zone_id);

  const computedRisk = evaluateRisk({
    final_status: finalStatus,
    missing_evidence: missingEvidence,
    pending_acceptance_elapsed_ms: pendingAcceptanceElapsedMs,
    pending_acceptance_over_30m: pendingAcceptanceOver30m,
  });

  const report: OperationReportV1 = {
    type: "operation_report_v1",
    version: "v1",
    generated_at: now.toISOString(),
    field_name: toText(input.field_name),
    approval: {
      status: toText(input.approval?.status),
      actor_id: toText(input.approval?.actor_id),
      actor_name: toText(input.approval?.actor_name),
      generated_at: toText(input.approval?.generated_at),
      approved_at: toText(input.approval?.approved_at),
      note: toText(input.approval?.note),
    },
    why: {
      explain_human: toText(input.why?.explain_human),
      objective_text: toText(input.why?.objective_text),
    },
    diagnostic_inputs: input.diagnostic_inputs ?? {
      field_id: toText(input.operation_state.field_id),
      devices: [],
      observations: [],
      diagnosis: { human: toText(input.why?.explain_human) },
    },
    operation_title: toText(input.operation_title),
    customer_title: toText(input.customer_title),
    identifiers: {
      tenant_id: input.tenant.tenant_id,
      project_id: input.tenant.project_id,
      group_id: input.tenant.group_id,
      field_id: toText(input.operation_state.field_id),
      operation_plan_id: input.operation_plan_id,
      operation_id: input.operation_state.operation_id,
      recommendation_id: toText(input.operation_state.recommendation_id),
      prescription_id: toText((input.operation_state as any).prescription_id),
      approval_id: toText((input.operation_state as any).approval_request_id ?? (input.operation_state as any).approval_id),
      skill_trace_id: toText((input.operation_state as any).skill_trace_id),
      skill_run_id: toText((input.operation_state as any).skill_run_id),
      as_executed_id: toText((input.operation_state as any).as_executed_id),
      act_task_id: toText(input.operation_state.act_task_id ?? input.operation_state.task_id),
      receipt_id: toText(input.operation_state.receipt_id),
    },
    as_executed: asExecuted,
    execution: {
      final_status: finalStatus,
      invalid_execution: isInvalidExecution,
      invalid_reason: toText(input.operation_state.invalid_reason),
      dispatched_at: dispatchedAtTs != null ? new Date(dispatchedAtTs).toISOString() : null,
      execution_started_at: toText(input.receipt?.execution_started_at),
      execution_finished_at: toText(input.receipt?.execution_finished_at),
      response_time_ms: input.sla.response_time_ms ?? null,
    },
    acceptance: {
      status: acceptanceStatus,
      verdict: acceptanceVerdict,
      missing_evidence: missingEvidence,
      missing_items: acceptanceMissingItems,
      generated_at: toText(input.acceptance?.generated_at),
    },
    evidence: {
      artifacts_count: Array.isArray(input.evidence_bundle.artifacts) ? input.evidence_bundle.artifacts.length : 0,
      logs_count: Array.isArray(input.evidence_bundle.logs) ? input.evidence_bundle.logs.length : 0,
      media_count: Array.isArray(input.evidence_bundle.media) ? input.evidence_bundle.media.length : 0,
      metrics_count: Array.isArray(input.evidence_bundle.metrics) ? input.evidence_bundle.metrics.length : 0,
      receipt_present: Boolean(input.receipt),
      acceptance_present: Boolean(input.acceptance),
    },
    cost: {
      estimated_total: toFiniteNumber(input.cost.estimated_total),
      ...(typeof input.cost.actual_total === "number" && Number.isFinite(input.cost.actual_total)
        ? { actual_total: input.cost.actual_total }
        : {}),
      ...(typeof input.cost.actual_water_cost === "number" && Number.isFinite(input.cost.actual_water_cost)
        ? { actual_water_cost: input.cost.actual_water_cost }
        : {}),
      ...(typeof input.cost.actual_electric_cost === "number" && Number.isFinite(input.cost.actual_electric_cost)
        ? { actual_electric_cost: input.cost.actual_electric_cost }
        : {}),
      ...(typeof input.cost.actual_chemical_cost === "number" && Number.isFinite(input.cost.actual_chemical_cost)
        ? { actual_chemical_cost: input.cost.actual_chemical_cost }
        : {}),
      ...(typeof input.cost.estimated_water_cost === "number" && Number.isFinite(input.cost.estimated_water_cost)
        ? { estimated_water_cost: input.cost.estimated_water_cost }
        : {}),
      ...(typeof input.cost.estimated_electric_cost === "number" && Number.isFinite(input.cost.estimated_electric_cost)
        ? { estimated_electric_cost: input.cost.estimated_electric_cost }
        : {}),
      ...(typeof input.cost.estimated_chemical_cost === "number" && Number.isFinite(input.cost.estimated_chemical_cost)
        ? { estimated_chemical_cost: input.cost.estimated_chemical_cost }
        : {}),
    },
    sla: {
      dispatch_latency_quality: computedSlaMetrics.dispatch_latency_quality,
      execution_duration_quality: computedSlaMetrics.execution_duration_quality,
      acceptance_latency_quality: computedSlaMetrics.acceptance_latency_quality,
      execution_success: Boolean(input.sla.execution_success),
      acceptance_pass: variableByZoneMode ? zoneRollupPass : Boolean(input.sla.acceptance_pass),
      response_time_ms: input.sla.response_time_ms ?? null,
      dispatch_latency_ms: computedSlaMetrics.dispatch_latency_ms,
      execution_duration_ms: computedSlaMetrics.execution_duration_ms,
      acceptance_latency_ms: computedSlaMetrics.acceptance_latency_ms,
      invalid_reasons: computedSlaMetrics.invalid_reasons,
      pending_acceptance_elapsed_ms: pendingAcceptanceElapsedMs,
      pending_acceptance_over_30m: pendingAcceptanceOver30m,
    },
    risk: {
      level: computedRisk.level as OperationReportRiskLevel,
      reasons: computedRisk.reasons,
    },
    field_memory: {
      field_response_memory: Array.isArray((input as any).field_memory?.field_response_memory)
        ? ((input as any).field_memory.field_response_memory as FieldMemorySummary[])
        : [],
      device_reliability_memory: Array.isArray((input as any).field_memory?.device_reliability_memory)
        ? ((input as any).field_memory.device_reliability_memory as FieldMemorySummary[])
        : [],
      skill_performance_memory: Array.isArray((input as any).field_memory?.skill_performance_memory)
        ? ((input as any).field_memory.skill_performance_memory as FieldMemorySummary[])
        : [],
    },

    roi_ledger: {
      summary: roiSummary,
      items: roiSummaries,
      water_saved: roiSummaries.filter((x) => x.roi_type === "WATER_SAVED"),
      labor_saved: roiSummaries.filter((x) => x.roi_type === "LABOR_SAVED"),
      early_warning_lead_time: roiSummaries.filter((x) => x.roi_type === "EARLY_WARNING_LEAD_TIME"),
      first_pass_acceptance_rate: roiSummaries.filter((x) => x.roi_type === "FIRST_PASS_ACCEPTANCE_RATE"),
      low_confidence_items: roiSummaries.filter((x) => String((x.confidence as any)?.level ?? "").toUpperCase() === "LOW"),
    },
    as_applied: asApplied,
    zone_applications: zoneMatrixCustomerView,
    zone_evidence_customer_v1: {
      zone_matrix: zoneMatrixCustomerView,
      operation_rollup_policy: zoneMatrixCustomerView[0]?.operation_rollup_policy ?? null,
    },
    zone_evidence_operator_debug_v1: {
      label: "技术诊断",
      collapsed_by_default: true,
      stage1_debug_matrix: zoneMatrixOperatorDebug,
    },
    formal_scenario: {
      scenario_type: scenarioType,
      formal_chain_status: formalChainStatus,
      evidence_status: evidenceStatus,
      customer_visible_eligible: customerVisibleEligible,
      needs_review: customerVisibleEligible ? needsReview : true,
      blocking_reasons: blockingReasons,
    },
    sampling: {
      plan_id: toText(samplingRaw?.plan_id),
      sample_id: toText(samplingRaw?.sample_id),
      sample_type: samplingSampleType,
      zone_id: toText(samplingRaw?.zone_id),
      collected_at_ts: toNullableNumber(samplingRaw?.collected_at_ts),
      lab_result_status: samplingLabStatus,
      acceptance_status: samplingAcceptanceStatus,
      customer_visible_eligible: Boolean(samplingRaw?.customer_visible_eligible),
      blocking_reasons: samplingBlockingReasons,
    },
    fail_safe: {
      status: failSafeStatus,
      trigger: toText(failSafeRaw?.trigger ?? failSafeRaw?.trigger_type),
      severity: toText(failSafeRaw?.severity),
      event_id: toText(failSafeRaw?.event_id ?? failSafeRaw?.fail_safe_event_id),
    },
    manual_takeover: {
      status: manualTakeoverStatus,
      takeover_id: toText(manualTakeoverRaw?.takeover_id),
      reason: toText(manualTakeoverRaw?.reason ?? manualTakeoverRaw?.reason_code),
    },
    zone_matrix: zoneMatrix,
    planned,
    workflow: {
      owner_actor_id: toText(input.operation_workflow?.owner_actor_id),
      owner_name: toText(input.operation_workflow?.owner_name),
      last_note: toText(input.operation_workflow?.last_note),
      updated_at: Number.isFinite(Number(input.operation_workflow?.updated_at)) && Number(input.operation_workflow?.updated_at) > 0
        ? new Date(Number(input.operation_workflow?.updated_at)).toISOString()
        : null,
      updated_by: toText(input.operation_workflow?.updated_by),
      linked_alert_ids: Array.isArray(input.operation_workflow?.linked_alert_ids)
        ? input.operation_workflow?.linked_alert_ids.map((x) => String(x ?? "").trim()).filter(Boolean)
        : [],
    },
  };
  const mergedReport = mergeFertilizationIntoReport(report, input.fertilization_view ?? null);
  const shouldGuardDeviceAnomaly = scenarioType === "DEVICE_ANOMALY" || mergedReport.fail_safe?.status !== "NONE" || mergedReport.manual_takeover?.status !== "NONE";
  return shouldGuardDeviceAnomaly ? applyDeviceAnomalyReportGuardV1(mergedReport) : mergedReport;
}
