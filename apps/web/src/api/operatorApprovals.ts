import { apiRequestWithPolicy, withQuery } from "./client";

export type OperatorApprovalDataScope = "OFFICIAL_OPERATOR_API" | "FALLBACK_LIMITED" | "EMPTY" | "ERROR_EMPTY";

export type OperatorApprovalRiskLevel = "HIGH" | "MEDIUM" | "LOW" | "UNKNOWN";
export type OperatorApprovalStatus = "PENDING" | "APPROVED" | "REJECTED" | "RETURNED" | "UNKNOWN";

export type OperatorApprovalItem = {
  approvalRequestId: string;
  status: OperatorApprovalStatus;
  title: string;
  description: string;
  fieldName?: string | null;
  operationName?: string | null;
  prescriptionId?: string | null;
  recommendationId?: string | null;
  riskLevel: OperatorApprovalRiskLevel;
  requestedBy?: string | null;
  approver?: string | null;
  updatedAt?: string | null;
  createdAt?: string | null;
  canApprove: boolean;
  permissionReason?: string | null;
  selfApprovalRisk: boolean;
  source: "operator_approvals_api" | "approvals_api";
};

export type OperatorApprovalsResponse = {
  source: "operator_approvals_api" | "fallback_approvals_api" | "empty_error_state";
  dataScope: OperatorApprovalDataScope;
  generated_at?: string | null;
  items: OperatorApprovalItem[];
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

function normalizeRisk(value: unknown): OperatorApprovalRiskLevel {
  const raw = text(value, "UNKNOWN").toUpperCase();
  if (raw === "HIGH" || raw.includes("高")) return "HIGH";
  if (raw === "MEDIUM" || raw.includes("中")) return "MEDIUM";
  if (raw === "LOW" || raw.includes("低")) return "LOW";
  return "UNKNOWN";
}

function normalizeStatus(value: unknown): OperatorApprovalStatus {
  const raw = text(value, "PENDING").toUpperCase();
  if (raw === "APPROVED" || raw === "APPROVE" || raw === "PASS") return "APPROVED";
  if (raw === "REJECTED" || raw === "REJECT" || raw === "DENIED") return "REJECTED";
  if (raw === "RETURNED" || raw === "RETURN" || raw === "NEEDS_CHANGES") return "RETURNED";
  if (raw === "PENDING" || raw === "WAITING" || raw === "REQUESTED") return "PENDING";
  return "UNKNOWN";
}

function normalizePermission(row: AnyRecord, readOnlyFallback: boolean): { canApprove: boolean; permissionReason: string | null } {
  if (readOnlyFallback) return { canApprove: false, permissionReason: "写操作未接入，当前只读。" };
  if (row.can_approve === true || row.permission?.can_approve === true) return { canApprove: true, permissionReason: null };
  const reason = text(row.permission_reason ?? row.permission?.reason ?? row.deny_reason, "当前身份无审批权限。") || "当前身份无审批权限。";
  return { canApprove: false, permissionReason: reason };
}

function normalizeSelfRisk(row: AnyRecord): boolean {
  if (typeof row.self_approval_risk === "boolean") return row.self_approval_risk;
  if (typeof row.is_self_approval === "boolean") return row.is_self_approval;
  const requestedBy = text(row.requested_by ?? row.requester_id ?? row.created_by);
  const currentApprover = text(row.current_actor_id ?? row.approver_id ?? row.actor_id);
  return Boolean(requestedBy && currentApprover && requestedBy === currentApprover);
}

function normalizeItems(payload: unknown, source: OperatorApprovalItem["source"], readOnlyFallback: boolean): OperatorApprovalItem[] {
  const rows = arrayFrom(payload, ["items", "requests", "approval_requests", "approvals", "history"]);
  return rows.map((row, index) => {
    const permission = normalizePermission(row, readOnlyFallback);
    const selfApprovalRisk = normalizeSelfRisk(row);
    return {
      approvalRequestId: text(row.approval_request_id ?? row.request_id ?? row.id, `${source}-${index}`),
      status: normalizeStatus(row.status ?? row.approval_status),
      title: text(row.title ?? row.summary ?? row.operation_title, "审批事项"),
      description: text(row.description ?? row.reason ?? row.note, "建议或处方等待运营审批。"),
      fieldName: text(row.field_name ?? row.fieldName, ""),
      operationName: text(row.operation_title ?? row.operation_name ?? row.customer_title, ""),
      prescriptionId: text(row.prescription_id ?? row.prescription?.prescription_id, ""),
      recommendationId: text(row.recommendation_id ?? row.recommendation?.recommendation_id, ""),
      riskLevel: normalizeRisk(row.risk_level ?? row.risk?.level ?? row.priority),
      requestedBy: text(row.requested_by_name ?? row.requested_by ?? row.requester_name ?? row.requester_id, ""),
      approver: text(row.approver_name ?? row.approver_id ?? row.actor_name, ""),
      updatedAt: text(row.updated_at ?? row.approved_at ?? row.generated_at, ""),
      createdAt: text(row.created_at ?? row.requested_at ?? row.generated_at, ""),
      canApprove: permission.canApprove && !selfApprovalRisk,
      permissionReason: selfApprovalRisk ? "存在自审批风险，当前阻断审批动作。" : permission.permissionReason,
      selfApprovalRisk,
      source,
    };
  });
}

async function fetchOptional(path: string): Promise<unknown | null> {
  try {
    const result = await apiRequestWithPolicy<unknown>(path, undefined, { allowedStatuses: [403, 404, 405, 422], silent: true, timeoutMs: 10000 });
    return result.ok ? result.data : null;
  } catch {
    return null;
  }
}

export async function fetchOperatorApprovals(): Promise<OperatorApprovalsResponse> {
  const official = await fetchOptional(withQuery("/api/v1/operator/approvals"));
  const officialItems = normalizeItems(official, "operator_approvals_api", false);
  if (officialItems.length > 0) {
    return {
      source: "operator_approvals_api",
      dataScope: "OFFICIAL_OPERATOR_API",
      generated_at: new Date().toISOString(),
      items: officialItems,
      writeReady: false,
      message: "审批写操作需等待后端权限、审计和错误码 ready 后开放。",
    };
  }

  const fallback = await fetchOptional(withQuery("/api/v1/approvals/requests"));
  const fallbackItems = normalizeItems(fallback, "approvals_api", true);
  if (fallbackItems.length > 0) {
    return {
      source: "fallback_approvals_api",
      dataScope: "FALLBACK_LIMITED",
      generated_at: new Date().toISOString(),
      items: fallbackItems,
      writeReady: false,
      message: "当前展示 approvals requests 可见数据包装后的有限审批中心，非完整 operator approvals。",
    };
  }

  return {
    source: "fallback_approvals_api",
    dataScope: "EMPTY",
    generated_at: new Date().toISOString(),
    items: [],
    writeReady: false,
    message: "暂无审批事项。",
  };
}
