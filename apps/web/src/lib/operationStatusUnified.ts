export type NormalizedOperationFinalStatus =
  | "PENDING"
  | "RUNNING"
  | "PENDING_ACCEPTANCE"
  | "SUCCESS"
  | "FAILED"
  | "INVALID_EXECUTION"
  | "EVIDENCE_MISSING"
  | "UNKNOWN";

export type UnifiedStatusInput = {
  final_status?: string | null;
  operation_state_v1?: {
    final_status?: string | null;
  } | null;
  operation?: {
    final_status?: string | null;
  } | null;
};

export type DashboardEvidenceGroupKey = "PASS" | "PENDING_ACCEPTANCE" | "EXECUTION_EXCEPTION" | "EVIDENCE_MISSING";
export type OperationsListGroupKey = "TODO" | "PENDING_ACCEPTANCE" | "DONE_OR_EXCEPTION";

export function normalizeOperationFinalStatusUnified(value?: string | null): NormalizedOperationFinalStatus {
  const raw = String(value ?? "").trim().toUpperCase();
  if (!raw) return "UNKNOWN";
  if (raw === "INVALID_EXECUTION") return "INVALID_EXECUTION";
  if (raw === "PENDING_ACCEPTANCE") return "PENDING_ACCEPTANCE";
  if (["SUCCESS", "SUCCEEDED", "DONE", "EXECUTED", "COMPLETED"].includes(raw)) return "SUCCESS";
  if (["FAILED", "ERROR", "CANCELLED", "NOT_EXECUTED", "REJECTED"].includes(raw)) return "FAILED";
  if (["PENDING", "READY", "QUEUED", "CREATED"].includes(raw)) return "PENDING";
  if (["RUNNING", "EXECUTING", "DISPATCHED", "ACKED", "IN_PROGRESS"].includes(raw)) return "RUNNING";
  if (["EVIDENCE_MISSING", "MISSING_EVIDENCE", "NO_RECEIPT", "RECEIPT_MISSING"].includes(raw)) return "EVIDENCE_MISSING";
  return "UNKNOWN";
}

export function resolveUnifiedOperationFinalStatus(input?: UnifiedStatusInput | null): NormalizedOperationFinalStatus {
  const rawStatus =
    input?.final_status ??
    input?.operation_state_v1?.final_status ??
    input?.operation?.final_status ??
    null;
  return normalizeOperationFinalStatusUnified(rawStatus);
}

export function toDashboardEvidenceGroup(status: NormalizedOperationFinalStatus): DashboardEvidenceGroupKey {
  if (status === "SUCCESS") return "PASS";
  if (status === "PENDING_ACCEPTANCE") return "PENDING_ACCEPTANCE";
  if (status === "EVIDENCE_MISSING") return "EVIDENCE_MISSING";
  return "EXECUTION_EXCEPTION";
}

export function toOperationsListGroup(status: NormalizedOperationFinalStatus): OperationsListGroupKey {
  if (status === "PENDING_ACCEPTANCE") return "PENDING_ACCEPTANCE";
  if (["SUCCESS", "INVALID_EXECUTION", "FAILED", "EVIDENCE_MISSING", "UNKNOWN"].includes(status)) {
    return "DONE_OR_EXCEPTION";
  }
  return "TODO";
}

export function toOperationDetailStatusLabel(status: NormalizedOperationFinalStatus): string {
  if (status === "PENDING") return "待执行";
  if (status === "RUNNING") return "执行中";
  if (status === "PENDING_ACCEPTANCE") return "待验收";
  if (status === "SUCCESS") return "已完成";
  if (status === "FAILED") return "异常";
  if (status === "INVALID_EXECUTION") return "执行无效";
  if (status === "EVIDENCE_MISSING") return "证据缺失";
  return "UNKNOWN";
}
