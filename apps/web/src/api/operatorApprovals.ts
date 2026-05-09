import { apiRequestWithPolicy, withQuery, ApiError } from "./client";

export type OperatorApprovalDataScope = "OFFICIAL_OPERATOR_API" | "FALLBACK_LIMITED" | "EMPTY" | "ERROR_EMPTY";

export type OperatorApprovalRiskLevel = "HIGH" | "MEDIUM" | "LOW" | "UNKNOWN";
export type OperatorApprovalStatus = "PENDING" | "APPROVED" | "REJECTED" | "RETURNED" | "UNKNOWN";

export type OperatorApprovalActionKind = "approve" | "reject" | "return";
export type OperatorActionErrorCodeV1 =
  | "AUTH_MISSING"
  | "FORBIDDEN"
  | "ACTION_NOT_READY"
  | "INVALID_STATE"
  | "SELF_APPROVAL_BLOCKED"
  | "TARGET_NOT_FOUND"
  | "EVIDENCE_INSUFFICIENT"
  | "AUDIT_WRITE_FAILED"
  | "STATE_WRITE_FAILED";

export type OperatorActionResponseV1 = {
  ok: boolean;
  action_id: string;
  audit_id: string;
  action_type: string;
  target_type: string;
  target_id: string;
  status_before: string | null;
  status_after: string | null;
  permission: {
    allowed: boolean;
    role: string | null;
    reason: string | null;
  };
  message: string;
  error_code?: OperatorActionErrorCodeV1;
  updated_at: string;
};

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
  permissionAllowed: boolean;
  permissionRole?: string | null;
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
  if (/token|secret|credential|private\s*key|password|stack\s*trace|debug\s*json/i.test(raw)) return fallback;
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

function boolOrNull(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  return null;
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
  if (raw === "PENDING" || raw === "WAITING" || raw === "REQUESTED" || raw === "OPEN") return "PENDING";
  return "UNKNOWN";
}

function normalizePermission(row: AnyRecord, readOnlyFallback: boolean): { allowed: boolean; role: string | null; reason: string | null } {
  if (readOnlyFallback) return { allowed: false, role: null, reason: "写操作未接入，当前只读。" };
  const permission = row.permission && typeof row.permission === "object" ? row.permission as AnyRecord : null;
  const allowed = boolOrNull(permission?.allowed) ?? boolOrNull(permission?.can_approve) ?? boolOrNull(row.can_approve) ?? false;
  const role = text(permission?.role ?? row.permission_role, "") || null;
  const reason = allowed
    ? null
    : (text(permission?.reason ?? row.permission_reason ?? row.deny_reason, "当前身份无审批权限。") || "当前身份无审批权限。");
  return { allowed, role, reason };
}

function normalizeSelfRisk(row: AnyRecord): boolean {
  if (typeof row.self_approval_risk === "boolean") return row.self_approval_risk;
  if (typeof row.is_self_approval === "boolean") return row.is_self_approval;
  const requestedBy = text(row.requested_by_actor_id ?? row.requested_by ?? row.requester_id ?? row.created_by);
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
      canApprove: permission.allowed && !selfApprovalRisk,
      permissionAllowed: permission.allowed,
      permissionRole: permission.role,
      permissionReason: selfApprovalRisk ? "存在自审批风险，当前阻断审批动作。" : permission.reason,
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

function writeReadyFromPayload(payload: unknown): boolean {
  return Boolean(payload && typeof payload === "object" && (payload as AnyRecord).writeReady === true);
}

export async function fetchOperatorApprovals(): Promise<OperatorApprovalsResponse> {
  const official = await fetchOptional(withQuery("/api/v1/operator/approvals"));
  const officialItems = normalizeItems(official, "operator_approvals_api", false);
  if (officialItems.length > 0 || writeReadyFromPayload(official)) {
    return {
      source: "operator_approvals_api",
      dataScope: "OFFICIAL_OPERATOR_API",
      generated_at: text((official as AnyRecord | null)?.generated_at, new Date().toISOString()),
      items: officialItems,
      writeReady: writeReadyFromPayload(official),
      message: text((official as AnyRecord | null)?.message, "审批写操作由后端 permission.allowed 控制。"),
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

function actionPath(approvalRequestId: string, action: OperatorApprovalActionKind): string {
  return `/api/v1/operator/approvals/${encodeURIComponent(approvalRequestId)}/${action}`;
}

function parseActionError(error: unknown): OperatorActionResponseV1 | null {
  if (!(error instanceof ApiError)) return null;
  try {
    const parsed = JSON.parse(error.bodyText) as OperatorActionResponseV1;
    if (parsed && typeof parsed === "object" && typeof parsed.message === "string") return parsed;
  } catch {
    return null;
  }
  return null;
}

export async function submitOperatorApprovalAction(
  approvalRequestId: string,
  action: OperatorApprovalActionKind,
  note?: string,
): Promise<OperatorActionResponseV1> {
  try {
    return await (async () => {
      const result = await apiRequestWithPolicy<OperatorActionResponseV1>(
        withQuery(actionPath(approvalRequestId, action)),
        {
          method: "POST",
          body: JSON.stringify({ note: text(note, "") || undefined }),
        },
      );
      if (!result.ok) throw new ApiError(result.status, result.bodyText, result.url);
      return result.data;
    })();
  } catch (error) {
    const parsed = parseActionError(error);
    if (parsed) return parsed;
    throw error;
  }
}
