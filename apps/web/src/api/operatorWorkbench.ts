import { apiRequestWithPolicy, withQuery } from "./client";

export type OperatorWorkbenchQueueKey =
  | "APPROVAL_PENDING"
  | "DISPATCH_PENDING"
  | "EXECUTION_EXCEPTION"
  | "ACCEPTANCE_PENDING"
  | "EVIDENCE_INSUFFICIENT"
  | "ACCEPTANCE_FAILED"
  | "DEVICE_OFFLINE"
  | "ALERT_OVERDUE";

export type OperatorWorkbenchDataScope = "OFFICIAL_OPERATOR_API" | "FALLBACK_LIMITED" | "EMPTY" | "ERROR_EMPTY";

export type OperatorWorkbenchItem = {
  id: string;
  queue: OperatorWorkbenchQueueKey;
  title: string;
  description: string;
  fieldName?: string | null;
  operationName?: string | null;
  priority?: "HIGH" | "MEDIUM" | "LOW" | "UNKNOWN";
  updatedAt?: string | null;
  actionHref: string;
  relatedHref?: string | null;
  source: "operator_api" | "approvals_api" | "reports_aggregate" | "alerts_api";
};

export type OperatorWorkbenchResponse = {
  source: "operator_workbench_api" | "fallback_existing_sources" | "empty_error_state";
  dataScope: OperatorWorkbenchDataScope;
  generated_at?: string | null;
  items: OperatorWorkbenchItem[];
  message?: string;
};

type AnyRecord = Record<string, any>;

const QUEUE_HREF: Record<OperatorWorkbenchQueueKey, string> = {
  APPROVAL_PENDING: "/operator/approvals",
  DISPATCH_PENDING: "/operator/dispatch",
  EXECUTION_EXCEPTION: "/operator/dispatch",
  ACCEPTANCE_PENDING: "/operator/acceptance",
  EVIDENCE_INSUFFICIENT: "/operator/evidence",
  ACCEPTANCE_FAILED: "/operator/acceptance",
  DEVICE_OFFLINE: "/operator/workbench",
  ALERT_OVERDUE: "/operator/workbench",
};

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

function normalizePriority(value: unknown): OperatorWorkbenchItem["priority"] {
  const raw = text(value, "UNKNOWN").toUpperCase();
  if (raw === "HIGH" || raw === "MEDIUM" || raw === "LOW") return raw;
  return "UNKNOWN";
}

function normalizeQueue(value: unknown): OperatorWorkbenchQueueKey | null {
  const raw = text(value).toUpperCase();
  if (raw === "APPROVAL_PENDING" || raw.includes("APPROVAL")) return "APPROVAL_PENDING";
  if (raw === "DISPATCH_PENDING" || raw.includes("DISPATCH")) return "DISPATCH_PENDING";
  if (raw === "EXECUTION_EXCEPTION" || raw.includes("INVALID_EXECUTION") || raw.includes("EXECUTION_EXCEPTION")) return "EXECUTION_EXCEPTION";
  if (raw === "ACCEPTANCE_PENDING" || raw.includes("PENDING_ACCEPTANCE")) return "ACCEPTANCE_PENDING";
  if (raw === "EVIDENCE_INSUFFICIENT" || raw.includes("EVIDENCE")) return "EVIDENCE_INSUFFICIENT";
  if (raw === "ACCEPTANCE_FAILED" || raw.includes("ACCEPTANCE_FAILED")) return "ACCEPTANCE_FAILED";
  if (raw === "DEVICE_OFFLINE" || raw.includes("OFFLINE")) return "DEVICE_OFFLINE";
  if (raw === "ALERT_OVERDUE" || raw.includes("OVERDUE")) return "ALERT_OVERDUE";
  return null;
}

function normalizeOfficial(payload: unknown): OperatorWorkbenchItem[] {
  const rows = arrayFrom(payload, ["items", "todos", "workbench", "queue"]);
  return rows.map((row, index) => {
    const queue = normalizeQueue(row.queue ?? row.queue_key ?? row.type ?? row.status) ?? "APPROVAL_PENDING";
    return {
      id: text(row.id ?? row.todo_id ?? row.operation_id ?? row.approval_request_id, `official-${index}`),
      queue,
      title: text(row.title ?? row.summary, "运营待办"),
      description: text(row.description ?? row.detail ?? row.reason, "待运营人员处理。"),
      fieldName: text(row.field_name, ""),
      operationName: text(row.operation_name ?? row.operation_title, ""),
      priority: normalizePriority(row.priority ?? row.risk_level),
      updatedAt: text(row.updated_at ?? row.created_at ?? row.generated_at, ""),
      actionHref: text(row.action_href, QUEUE_HREF[queue]),
      relatedHref: text(row.related_href, ""),
      source: "operator_api" as const,
    };
  });
}

function operationHref(operationId: unknown): string | null {
  const id = text(operationId);
  return id ? `/customer/operations/${encodeURIComponent(id)}` : null;
}

function fieldDisplayName(row: AnyRecord): string {
  return text(row.field_name ?? row.fieldName ?? row.name, "地块待确认");
}

function operationDisplayName(row: AnyRecord): string {
  return text(row.operation_title ?? row.customer_title ?? row.title ?? row.operation_name, "作业待确认");
}

function buildApprovalFallback(payload: unknown): OperatorWorkbenchItem[] {
  const rows = arrayFrom(payload, ["items", "requests", "approval_requests", "data"]);
  return rows.slice(0, 12).map((row, index) => ({
    id: text(row.approval_request_id ?? row.request_id ?? row.id, `approval-${index}`),
    queue: "APPROVAL_PENDING" as const,
    title: text(row.title ?? row.summary, "待审批事项"),
    description: text(row.reason ?? row.description ?? row.status, "建议或处方等待审批。"),
    fieldName: text(row.field_name, ""),
    operationName: text(row.operation_title, ""),
    priority: normalizePriority(row.risk_level ?? row.priority),
    updatedAt: text(row.updated_at ?? row.created_at ?? row.generated_at, ""),
    actionHref: "/operator/approvals",
    relatedHref: operationHref(row.operation_id),
    source: "approvals_api" as const,
  }));
}

function buildReportFallback(payload: unknown): OperatorWorkbenchItem[] {
  const aggregate = payload && typeof payload === "object" ? (payload as AnyRecord) : {};
  const recentOperations = arrayFrom(aggregate, ["recent_operations", "operations"]);
  const items: OperatorWorkbenchItem[] = [];

  for (const row of recentOperations.slice(0, 20)) {
    const status = text(row.final_status ?? row.status ?? row.acceptance_status).toUpperCase();
    const operationId = text(row.operation_id ?? row.operation_plan_id ?? row.id);
    const base = {
      id: operationId || `operation-${items.length}`,
      fieldName: fieldDisplayName(row),
      operationName: operationDisplayName(row),
      updatedAt: text(row.updated_at ?? row.generated_at ?? row.finished_at, ""),
      relatedHref: operationHref(operationId),
      source: "reports_aggregate" as const,
    };

    if (status.includes("PENDING_ACCEPTANCE")) {
      items.push({ ...base, queue: "ACCEPTANCE_PENDING", title: "待验收作业", description: `${base.operationName} 等待验收结论。`, priority: "MEDIUM", actionHref: "/operator/acceptance" });
      continue;
    }
    if (status.includes("INVALID_EXECUTION") || status.includes("FAILED")) {
      items.push({ ...base, queue: "EXECUTION_EXCEPTION", title: "执行异常作业", description: `${base.operationName} 需要复核执行状态。`, priority: "HIGH", actionHref: "/operator/dispatch" });
      continue;
    }
    if (status.includes("ACCEPTANCE_FAILED") || status === "FAIL") {
      items.push({ ...base, queue: "ACCEPTANCE_FAILED", title: "验收失败作业", description: `${base.operationName} 未通过验收，需要处理。`, priority: "HIGH", actionHref: "/operator/acceptance" });
      continue;
    }

    const evidenceText = `${row.evidence_status ?? ""} ${row.evidence_summary ?? ""} ${row.risk_reason ?? ""}`.toUpperCase();
    if (evidenceText.includes("MISSING") || evidenceText.includes("INSUFFICIENT") || evidenceText.includes("证据不足")) {
      items.push({ ...base, queue: "EVIDENCE_INSUFFICIENT", title: "证据不足作业", description: `${base.operationName} 需要补齐证据。`, priority: "HIGH", actionHref: "/operator/evidence" });
    }
  }

  const topRiskFields = arrayFrom(aggregate, ["top_risk_fields", "risk_fields"]);
  for (const row of topRiskFields.slice(0, 6)) {
    const riskReasons = Array.isArray(row.risk_reasons) ? row.risk_reasons.join("、") : text(row.risk_reason ?? row.reason, "风险原因待确认");
    if (/offline|离线/i.test(riskReasons)) {
      const fieldId = text(row.field_id ?? row.id);
      items.push({
        id: `offline-${fieldId || items.length}`,
        queue: "DEVICE_OFFLINE",
        title: "设备离线风险",
        description: `${fieldDisplayName(row)} 存在设备离线风险，需要运营复核。`,
        fieldName: fieldDisplayName(row),
        priority: "MEDIUM",
        updatedAt: text(row.updated_at ?? row.generated_at, ""),
        actionHref: "/operator/workbench",
        relatedHref: fieldId ? `/customer/fields/${encodeURIComponent(fieldId)}` : null,
        source: "reports_aggregate",
      });
    }
  }

  return items;
}

function buildAlertsFallback(payload: unknown): OperatorWorkbenchItem[] {
  const rows = arrayFrom(payload, ["items", "alerts", "data"]);
  return rows.slice(0, 12).map((row, index) => {
    const isOverdue = Boolean(row.overdue) || /overdue|timeout|超时/i.test(`${row.status ?? ""} ${row.reason ?? ""} ${row.title ?? ""}`);
    return {
      id: text(row.alert_id ?? row.id, `alert-${index}`),
      queue: isOverdue ? "ALERT_OVERDUE" as const : "EXECUTION_EXCEPTION" as const,
      title: isOverdue ? "告警超时" : "告警待处理",
      description: text(row.title ?? row.description ?? row.reason, "告警需要运营复核。"),
      fieldName: text(row.field_name, ""),
      operationName: text(row.operation_title, ""),
      priority: normalizePriority(row.severity ?? row.priority),
      updatedAt: text(row.updated_at ?? row.created_at ?? row.generated_at, ""),
      actionHref: "/operator/workbench",
      relatedHref: null,
      source: "alerts_api" as const,
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

export async function fetchOperatorWorkbench(): Promise<OperatorWorkbenchResponse> {
  const official = await fetchOptional(withQuery("/api/v1/operator/workbench"));
  const officialItems = normalizeOfficial(official);
  if (officialItems.length > 0) {
    return {
      source: "operator_workbench_api",
      dataScope: "OFFICIAL_OPERATOR_API",
      generated_at: new Date().toISOString(),
      items: officialItems,
    };
  }

  const [approvals, aggregate, alerts] = await Promise.all([
    fetchOptional(withQuery("/api/v1/approvals/requests")),
    fetchOptional(withQuery("/api/v1/reports/customer-dashboard/aggregate")),
    fetchOptional(withQuery("/api/v1/alerts")),
  ]);

  const fallbackItems = [
    ...buildApprovalFallback(approvals),
    ...buildReportFallback(aggregate),
    ...buildAlertsFallback(alerts),
  ];

  if (fallbackItems.length > 0) {
    return {
      source: "fallback_existing_sources",
      dataScope: "FALLBACK_LIMITED",
      generated_at: new Date().toISOString(),
      items: fallbackItems,
      message: "当前展示 approvals / reports / alerts 可见数据包装后的有限运营队列，非完整运营总队列。",
    };
  }

  return {
    source: "fallback_existing_sources",
    dataScope: "EMPTY",
    generated_at: new Date().toISOString(),
    items: [],
    message: "暂无可处理运营事项。",
  };
}
