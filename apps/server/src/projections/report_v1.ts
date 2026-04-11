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
    total: number;
    water: number;
    electric: number;
    chemical: number;
    currency: "CNY";
  };
  sla: {
    execution_success: boolean;
    acceptance_pass: boolean;
    response_time_ms: number | null;
    pending_acceptance_elapsed_ms: number | null;
    pending_acceptance_over_30m: boolean;
  };
  risk: {
    level: OperationReportRiskLevel;
    reasons: string[];
  };
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

export function projectOperationReportV1(input: {
  tenant: TenantTriple;
  operation_plan_id: string;
  operation_state: OperationStateV1;
  evidence_bundle: EvidenceBundleInput;
  acceptance: AcceptanceInput;
  receipt: ReceiptInput;
  cost: { total?: unknown; water?: unknown; electric?: unknown; chemical?: unknown };
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
  const pendingAnchorMs = receiptFinishedAtMs ?? input.operation_state.timeline.find((x) => x.type === "RECEIPT_SUBMITTED")?.ts ?? null;
  const pendingAcceptanceElapsedMs = finalStatus === "PENDING_ACCEPTANCE" && pendingAnchorMs != null
    ? Math.max(0, now.getTime() - pendingAnchorMs)
    : null;
  const pendingAcceptanceOver30m = pendingAcceptanceElapsedMs != null && pendingAcceptanceElapsedMs > 30 * 60 * 1000;

  const missingEvidence = acceptanceMissingFlag;
  const riskReasons: string[] = [];
  if (isInvalidExecution) riskReasons.push("INVALID_EXECUTION");
  if (missingEvidence) riskReasons.push("MISSING_EVIDENCE");
  if (pendingAcceptanceOver30m) riskReasons.push("PENDING_ACCEPTANCE_OVER_30M");

  const riskLevel: OperationReportRiskLevel = riskReasons.includes("INVALID_EXECUTION") || riskReasons.includes("MISSING_EVIDENCE")
    ? "HIGH"
    : (riskReasons.includes("PENDING_ACCEPTANCE_OVER_30M") ? "MEDIUM" : "LOW");

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
      total: toFiniteNumber(input.cost.total),
      water: toFiniteNumber(input.cost.water),
      electric: toFiniteNumber(input.cost.electric),
      chemical: toFiniteNumber(input.cost.chemical),
      currency: "CNY",
    },
    sla: {
      execution_success: Boolean(input.sla.execution_success),
      acceptance_pass: Boolean(input.sla.acceptance_pass),
      response_time_ms: input.sla.response_time_ms ?? null,
      pending_acceptance_elapsed_ms: pendingAcceptanceElapsedMs,
      pending_acceptance_over_30m: pendingAcceptanceOver30m,
    },
    risk: {
      level: riskLevel,
      reasons: riskReasons,
    },
  };
}
