import { evaluateRisk } from "../domain/risk_engine";
import type { OperationStateV1 } from "./operation_state_v1";

export type OperationReportRiskLevel = "LOW" | "MEDIUM" | "HIGH";

export type OperationReportV1 = {
  type: "operation_report_v1";
  version: "v1";
  generated_at: string;
  identifiers: {
    tenant_id: string;
    project_id: string;
    group_id: string;
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
    actual_total: number;
    actual_water_cost: number;
    actual_electric_cost: number;
    actual_chemical_cost: number;
    estimated_total: number;
    estimated_water_cost: number;
    estimated_chemical_cost: number;
    estimated_device_cost: number;
    estimated_labor_cost: number;
    action_type: "IRRIGATE" | "FERTILIZE";
    action_resolution: "DIRECT" | "ALIAS" | "UNKNOWN_FALLBACK";
    cost_quality: "ESTIMATED_WITH_ACTUAL" | "ESTIMATED_ONLY";
    cost_notes: string[];
    requested_action_type: string | null;
    currency: "CNY";
  };
  sla: {
    execution_success: boolean;
    acceptance_pass: boolean;
    response_time_ms: number | null;
    dispatch_latency_ms?: number;
    execution_duration_ms?: number;
    acceptance_latency_ms?: number;
    invalid_reasons: string[];
    pending_acceptance_elapsed_ms: number | null;
    pending_acceptance_over_30m: boolean;
  };
  risk: {
    level: OperationReportRiskLevel;
    reasons: string[];
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
  dispatch_latency_ms?: number;
  execution_duration_ms?: number;
  acceptance_latency_ms?: number;
  invalid_reasons: string[];
};

function computeNonNegativeDuration(params: {
  startMs: number | null;
  endMs: number | null;
  missingReason: string;
  negativeReason: string;
  invalidReasons: string[];
}): number | undefined {
  const { startMs, endMs, missingReason, negativeReason, invalidReasons } = params;
  if (startMs == null || endMs == null) {
    invalidReasons.push(missingReason);
    return undefined;
  }
  const delta = endMs - startMs;
  if (delta < 0) {
    invalidReasons.push(negativeReason);
    return undefined;
  }
  return delta;
}

export function computeReportV1SlaMetrics(params: {
  timeline: Array<{ ts: number; type: string }>;
  receipt: ReceiptInput;
  acceptance: AcceptanceInput;
}): ReportV1SlaMetrics {
  const invalidReasons: string[] = [];
  const timelineCreatedAtMs = params.timeline.find((x) => x.type === "RECOMMENDATION_CREATED")?.ts ?? null;
  const timelineDispatchedAtMs = params.timeline.find((x) => x.type === "TASK_CREATED")?.ts ?? null;
  const receiptStartMs = toMs(params.receipt?.execution_started_at);
  const receiptEndMs = toMs(params.receipt?.execution_finished_at);
  const receiptTsMs = receiptEndMs ?? (params.timeline.find((x) => x.type === "RECEIPT_SUBMITTED")?.ts ?? null);
  const acceptanceTsMs = toMs(params.acceptance?.generated_at);

  const dispatchLatencyMs = computeNonNegativeDuration({
    startMs: timelineCreatedAtMs,
    endMs: timelineDispatchedAtMs,
    missingReason: "dispatch_latency_missing_timestamp",
    negativeReason: "dispatch_latency_negative_duration",
    invalidReasons,
  });

  const executionDurationMs = computeNonNegativeDuration({
    startMs: receiptStartMs,
    endMs: receiptEndMs,
    missingReason: "execution_duration_missing_timestamp",
    negativeReason: "execution_duration_negative_duration",
    invalidReasons,
  });

  const acceptanceLatencyMs = computeNonNegativeDuration({
    startMs: receiptTsMs,
    endMs: acceptanceTsMs,
    missingReason: "acceptance_latency_missing_timestamp",
    negativeReason: "acceptance_latency_negative_duration",
    invalidReasons,
  });

  return {
    dispatch_latency_ms: dispatchLatencyMs,
    execution_duration_ms: executionDurationMs,
    acceptance_latency_ms: acceptanceLatencyMs,
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
    actual_total?: unknown;
    actual_water_cost?: unknown;
    actual_electric_cost?: unknown;
    actual_chemical_cost?: unknown;
    estimated_total?: unknown;
    estimated_water_cost?: unknown;
    estimated_chemical_cost?: unknown;
    estimated_device_cost?: unknown;
    estimated_labor_cost?: unknown;
    action_type?: unknown;
    action_resolution?: unknown;
    cost_quality?: unknown;
    cost_notes?: unknown;
    requested_action_type?: unknown;
  };
  sla: { execution_success?: boolean; acceptance_pass?: boolean; response_time_ms?: number | null };
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
    identifiers: {
      tenant_id: input.tenant.tenant_id,
      project_id: input.tenant.project_id,
      group_id: input.tenant.group_id,
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
      actual_total: toFiniteNumber(input.cost.actual_total),
      actual_water_cost: toFiniteNumber(input.cost.actual_water_cost),
      actual_electric_cost: toFiniteNumber(input.cost.actual_electric_cost),
      actual_chemical_cost: toFiniteNumber(input.cost.actual_chemical_cost),
      estimated_total: toFiniteNumber(input.cost.estimated_total),
      estimated_water_cost: toFiniteNumber(input.cost.estimated_water_cost),
      estimated_chemical_cost: toFiniteNumber(input.cost.estimated_chemical_cost),
      estimated_device_cost: toFiniteNumber(input.cost.estimated_device_cost),
      estimated_labor_cost: toFiniteNumber(input.cost.estimated_labor_cost),
      action_type: toText(input.cost.action_type) === "FERTILIZE" ? "FERTILIZE" : "IRRIGATE",
      action_resolution: toText(input.cost.action_resolution) === "ALIAS"
        ? "ALIAS"
        : toText(input.cost.action_resolution) === "UNKNOWN_FALLBACK"
          ? "UNKNOWN_FALLBACK"
          : "DIRECT",
      cost_quality: toText(input.cost.cost_quality) === "ESTIMATED_WITH_ACTUAL" ? "ESTIMATED_WITH_ACTUAL" : "ESTIMATED_ONLY",
      cost_notes: Array.isArray(input.cost.cost_notes) ? input.cost.cost_notes.map((x) => String(x)).filter(Boolean) : [],
      requested_action_type: toText(input.cost.requested_action_type),
      currency: "CNY",
    },
    sla: {
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
  };
}
