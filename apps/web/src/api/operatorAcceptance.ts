import { apiRequestWithPolicy, withQuery } from "./client";

export type OperatorAcceptanceDataScope = "OFFICIAL_OPERATOR_API" | "FALLBACK_LIMITED" | "EMPTY" | "ERROR_EMPTY";
export type OperatorAcceptanceStatus = "PENDING" | "EVIDENCE_INSUFFICIENT" | "FAILED" | "REVIEW_REQUIRED" | "PASSED" | "UNKNOWN";

export type OperatorAcceptanceItem = {
  operationId: string;
  acceptanceId?: string | null;
  fieldName?: string | null;
  operationName?: string | null;
  acceptanceStatus: OperatorAcceptanceStatus;
  operationStateStatus?: string | null;
  evidenceInsufficient: boolean;
  failureReason?: string | null;
  reviewReason?: string | null;
  acceptanceVerdict?: string | null;
  generatedAt?: string | null;
  updatedAt?: string | null;
  canEvaluate: boolean;
  canRequestReview: boolean;
  permissionReason?: string | null;
  source: "operator_acceptance_api" | "reports_aggregate";
};

export type OperatorAcceptanceResponse = {
  source: "operator_acceptance_api" | "fallback_reports_aggregate" | "empty_error_state";
  dataScope: OperatorAcceptanceDataScope;
  generated_at?: string | null;
  items: OperatorAcceptanceItem[];
  message?: string;
  writeReady: boolean;
};

type AnyRecord = Record<string, any>;

function text(value: unknown, fallback = ""): string {
  const raw = String(value ?? "").trim();
  if (!raw || raw === "--" || raw === "undefined" || raw === "null") return fallback;
  return raw;
}

function arrayFrom(payload: unknown, keys: string[]): AnyRecord[] {
  if (Array.isArray(payload)) return payload.filter((item): item is AnyRecord => Boolean(item && typeof item === "object"));
  if (!payload || typeof payload !== "object") return [];
  const obj = payload as AnyRecord;
  for (const key of keys) {
    const value = obj[key];
    if (Array.isArray(value)) return value.filter((item): item is AnyRecord => Boolean(item && typeof item === "object"));
  }
  if (obj.data) return arrayFrom(obj.data, keys);
  if (obj.items) return arrayFrom(obj.items, keys);
  return [];
}

function normalizeStatusFromSource(row: AnyRecord): OperatorAcceptanceStatus {
  const raw = text(row.acceptance_status ?? row.acceptance?.status ?? row.verdict ?? row.acceptance_verdict ?? row.final_status ?? row.status).toUpperCase();
  const evidenceText = `${row.evidence_status ?? ""} ${row.evidence_summary ?? ""} ${row.missing_evidence ?? ""} ${row.missing_items ?? ""}`.toUpperCase();
  const failureText = `${row.failure_reason ?? ""} ${row.invalid_reason ?? ""} ${row.acceptance_failed_reason ?? ""}`.toUpperCase();

  if (evidenceText.includes("MISSING") || evidenceText.includes("INSUFFICIENT") || evidenceText.includes("TRUE") || evidenceText.includes("证据不足")) return "EVIDENCE_INSUFFICIENT";
  if (raw === "PASS" || raw === "PASSED" || raw === "ACCEPTED" || raw.includes("PASS")) return "PASSED";
  if (raw === "FAIL" || raw === "FAILED" || raw.includes("FAIL")) return "FAILED";
  if (raw.includes("PENDING_ACCEPTANCE") || raw === "PENDING" || raw.includes("WAITING")) return "PENDING";
  if (raw.includes("REVIEW") || failureText.includes("REVIEW")) return "REVIEW_REQUIRED";
  return "UNKNOWN";
}

function evidenceInsufficient(row: AnyRecord, status: OperatorAcceptanceStatus): boolean {
  if (status === "EVIDENCE_INSUFFICIENT") return true;
  if (typeof row.missing_evidence === "boolean") return row.missing_evidence;
  if (typeof row.acceptance?.missing_evidence === "boolean") return row.acceptance.missing_evidence;
  const textValue = `${row.evidence_status ?? ""} ${row.evidence_summary ?? ""} ${row.missing_items ?? ""}`;
  return /missing|insufficient|证据不足/i.test(textValue);
}

function normalizeOfficial(payload: unknown): OperatorAcceptanceItem[] {
  const rows = arrayFrom(payload, ["items", "acceptance", "queue", "operations"]);
  return rows.map((row, index) => {
    const status = normalizeStatusFromSource(row);
    const missingEvidence = evidenceInsufficient(row, status);
    return {
      operationId: text(row.operation_id ?? row.operationId ?? row.operation_plan_id ?? row.id, `operation-${index}`),
      acceptanceId: text(row.acceptance_id ?? row.acceptance?.acceptance_id, ""),
      fieldName: text(row.field_name ?? row.fieldName, ""),
      operationName: text(row.operation_title ?? row.operation_name ?? row.customer_title ?? row.title, ""),
      acceptanceStatus: missingEvidence ? "EVIDENCE_INSUFFICIENT" : status,
      operationStateStatus: text(row.operation_state_status ?? row.final_status ?? row.operation_state?.final_status, ""),
      evidenceInsufficient: missingEvidence,
      failureReason: text(row.failure_reason ?? row.invalid_reason ?? row.acceptance_failed_reason ?? row.acceptance?.reason, ""),
      reviewReason: text(row.review_reason ?? row.reason ?? row.note, ""),
      acceptanceVerdict: text(row.acceptance_verdict ?? row.verdict ?? row.acceptance?.verdict, ""),
      generatedAt: text(row.generated_at ?? row.acceptance?.generated_at, ""),
      updatedAt: text(row.updated_at ?? row.finished_at ?? row.generated_at, ""),
      canEvaluate: Boolean(row.can_evaluate ?? row.permissions?.can_evaluate ?? false) && !missingEvidence,
      canRequestReview: Boolean(row.can_request_review ?? row.permissions?.can_request_review ?? false),
      permissionReason: text(row.permission_reason ?? row.permissions?.reason, ""),
      source: "operator_acceptance_api" as const,
    };
  });
}

function normalizeReportFallback(payload: unknown): OperatorAcceptanceItem[] {
  const rows = arrayFrom(payload, ["recent_operations", "operations", "items"]);
  return rows.slice(0, 30).map((row, index) => {
    const status = normalizeStatusFromSource(row);
    const missingEvidence = evidenceInsufficient(row, status);
    const operationId = text(row.operation_id ?? row.operation_plan_id ?? row.id, `operation-${index}`);
    return {
      operationId,
      acceptanceId: text(row.acceptance_id, ""),
      fieldName: text(row.field_name ?? row.fieldName, ""),
      operationName: text(row.operation_title ?? row.customer_title ?? row.title, "作业待确认"),
      acceptanceStatus: missingEvidence ? "EVIDENCE_INSUFFICIENT" : status,
      operationStateStatus: text(row.final_status ?? row.status, ""),
      evidenceInsufficient: missingEvidence,
      failureReason: text(row.failure_reason ?? row.invalid_reason ?? row.risk_reason ?? row.acceptance_failed_reason, ""),
      reviewReason: text(row.review_reason ?? row.risk_reason ?? row.reason, ""),
      acceptanceVerdict: text(row.acceptance_verdict ?? row.verdict, ""),
      generatedAt: text(row.acceptance_generated_at ?? row.generated_at, ""),
      updatedAt: text(row.updated_at ?? row.finished_at ?? row.generated_at, ""),
      canEvaluate: false,
      canRequestReview: false,
      permissionReason: "验收写操作未接入，当前只读。",
      source: "reports_aggregate" as const,
    };
  }).filter((item) => item.acceptanceStatus !== "UNKNOWN");
}

async function fetchOptional(path: string): Promise<unknown | null> {
  try {
    const result = await apiRequestWithPolicy<unknown>(path, undefined, { allowedStatuses: [403, 404, 405, 422], silent: true, timeoutMs: 10000 });
    return result.ok ? result.data : null;
  } catch {
    return null;
  }
}

export async function fetchOperatorAcceptance(): Promise<OperatorAcceptanceResponse> {
  const official = await fetchOptional(withQuery("/api/v1/operator/acceptance"));
  const officialItems = normalizeOfficial(official);
  if (officialItems.length > 0) {
    return {
      source: "operator_acceptance_api",
      dataScope: "OFFICIAL_OPERATOR_API",
      generated_at: new Date().toISOString(),
      items: officialItems,
      writeReady: false,
      message: "验收写操作需等待后端权限、审计和错误码 ready 后开放。",
    };
  }

  const aggregate = await fetchOptional(withQuery("/api/v1/reports/customer-dashboard/aggregate"));
  const fallbackItems = normalizeReportFallback(aggregate);
  if (fallbackItems.length > 0) {
    return {
      source: "fallback_reports_aggregate",
      dataScope: "FALLBACK_LIMITED",
      generated_at: new Date().toISOString(),
      items: fallbackItems,
      writeReady: false,
      message: "当前展示 reports aggregate 包装后的有限验收队列，非完整 operator acceptance。",
    };
  }

  return {
    source: "fallback_reports_aggregate",
    dataScope: "EMPTY",
    generated_at: new Date().toISOString(),
    items: [],
    writeReady: false,
    message: "暂无验收事项。",
  };
}
