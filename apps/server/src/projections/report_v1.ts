import { evaluateRisk } from "../domain/risk_engine.js";
import type { OperationStateV1 } from "./operation_state_v1.js";

export type OperationReportRiskLevel = "LOW" | "MEDIUM" | "HIGH";

export type OperationReportV1 = {
  type: "operation_report_v1";
  version: "v1";
  generated_at: string;
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
    act_task_id: string | null;
    receipt_id: string | null;
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
  workflow: {
    owner_actor_id: string | null;
    owner_name: string | null;
    last_note: string | null;
    updated_at: string | null;
    updated_by: string | null;
    linked_alert_ids?: string[];
  };
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

export function projectOperationReportV1(input: {
  tenant: TenantTriple;
  operation_plan_id: string;
  operation_state: OperationStateV1;
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
  operation_title?: unknown;
  customer_title?: unknown;
  now?: Date;
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
  const computedRisk = evaluateRisk({
    final_status: finalStatus,
    missing_evidence: missingEvidence,
    pending_acceptance_elapsed_ms: pendingAcceptanceElapsedMs,
    pending_acceptance_over_30m: pendingAcceptanceOver30m,
  });

  return {
    type: "operation_report_v1",
    version: "v1",
    generated_at: now.toISOString(),
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
      act_task_id: toText(input.operation_state.act_task_id ?? input.operation_state.task_id),
      receipt_id: toText(input.operation_state.receipt_id),
    },
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
      acceptance_pass: Boolean(input.sla.acceptance_pass),
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
}
