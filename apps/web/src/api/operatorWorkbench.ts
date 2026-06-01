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
export type OperatorWorkbenchHandlingStatus = "OPEN" | "ACKED" | "FOLLOWUP_REQUIRED" | "TASK_CANDIDATE_CREATED" | "CLOSED" | "READ_ONLY";

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
  deviceId?: string | null;
  fieldId?: string | null;
  alertId?: string | null;
  sourceId?: string | null;
  queueId?: string | null;
  handlingStatus?: OperatorWorkbenchHandlingStatus;
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
  DEVICE_OFFLINE: "/operator/devices-alerts?focus=device_offline",
  ALERT_OVERDUE: "/operator/devices-alerts?focus=alert_overdue",
};

const PLACEHOLDER_ID_VALUES = new Set(["...", "…", "--", "undefined", "null", "待确认", "未定位到设备", "地块待确认"]);

export function isPlaceholderId(value: unknown): boolean {
  const raw = String(value ?? "").trim();
  if (!raw) return true;
  return PLACEHOLDER_ID_VALUES.has(raw) || PLACEHOLDER_ID_VALUES.has(raw.toLowerCase());
}

function text(value: unknown, fallback = ""): string {
  const raw = String(value ?? "").trim();
  if (!raw || raw === "--" || raw === "undefined" || raw === "null" || raw === "..." || raw === "…" || raw === "待确认") return fallback;
  return raw;
}

function idText(value: unknown): string {
  return isPlaceholderId(value) ? "" : String(value ?? "").trim();
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

function normalizeHandlingStatus(value: unknown, fallback: OperatorWorkbenchHandlingStatus): OperatorWorkbenchHandlingStatus {
  const raw = text(value, fallback).toUpperCase();
  if (raw === "OPEN" || raw === "ACKED" || raw === "FOLLOWUP_REQUIRED" || raw === "TASK_CANDIDATE_CREATED" || raw === "CLOSED" || raw === "READ_ONLY") return raw;
  return fallback;
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

function appendQuery(path: string, params: Record<string, unknown>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    const raw = key.endsWith("_id") ? idText(value) : text(value);
    if (raw) query.set(key, raw);
  }
  const qs = query.toString();
  if (!qs) return path;
  return `${path}${path.includes("?") ? "&" : "?"}${qs}`;
}

function deviceOfflineHref(params: { deviceId?: unknown; fieldId?: unknown; source?: unknown }): string {
  const deviceId = idText(params.deviceId);
  const fieldId = idText(params.fieldId);
  const source = text(params.source).toLowerCase();
  if (deviceId) return appendQuery(QUEUE_HREF.DEVICE_OFFLINE, { device_id: deviceId, field_id: fieldId, online_status: "OFFLINE" });
  if (source === "aggregate") return appendQuery(QUEUE_HREF.DEVICE_OFFLINE, { source: "aggregate", field_id: fieldId });
  return appendQuery(QUEUE_HREF.DEVICE_OFFLINE, { field_id: fieldId });
}

function alertOverdueHref(params: { alertId?: unknown; fieldId?: unknown }): string {
  return appendQuery(QUEUE_HREF.ALERT_OVERDUE, { alert_id: params.alertId, field_id: params.fieldId });
}

function defaultActionHref(queue: OperatorWorkbenchQueueKey, row: AnyRecord): string {
  if (queue === "DEVICE_OFFLINE") return deviceOfflineHref({ deviceId: row.device_id ?? row.deviceId, fieldId: row.field_id ?? row.fieldId, source: row.source });
  if (queue === "ALERT_OVERDUE") return alertOverdueHref({ alertId: row.alert_id ?? row.alertId ?? row.id, fieldId: row.field_id ?? row.fieldId });
  return QUEUE_HREF[queue];
}

function operationHref(operationId: unknown): string | null {
  const id = idText(operationId);
  return id ? `/customer/operations/${encodeURIComponent(id)}` : null;
}

function fieldHref(fieldId: unknown): string | null {
  const id = idText(fieldId);
  return id ? `/customer/fields/${encodeURIComponent(id)}` : null;
}

function fieldDisplayName(row: AnyRecord): string {
  return text(row.field_name ?? row.fieldName ?? row.name, "地块待确认");
}

function operationDisplayName(row: AnyRecord): string {
  return text(row.operation_title ?? row.customer_title ?? row.title ?? row.operation_name, "作业待确认");
}

function normalizeOfficial(payload: unknown): OperatorWorkbenchItem[] {
  const rows = arrayFrom(payload, ["items", "todos", "workbench", "queue"]);
  return rows.map((row, index) => {
    const queue = normalizeQueue(row.queue ?? row.queue_key ?? row.type ?? row.status) ?? "APPROVAL_PENDING";
    const deviceId = idText(row.device_id ?? row.deviceId);
    const fieldId = idText(row.field_id ?? row.fieldId);
    const alertId = idText(row.alert_id ?? row.alertId);
    return {
      id: idText(row.id ?? row.todo_id ?? row.operation_id ?? row.approval_request_id ?? row.device_id ?? row.alert_id) || `official-${index}`,
      queue,
      title: text(row.title ?? row.summary, "运营待办"),
      description: text(row.description ?? row.detail ?? row.reason, "待运营人员处理。"),
      fieldName: text(row.field_name, ""),
      operationName: text(row.operation_name ?? row.operation_title ?? row.device_id ?? row.alert_id, ""),
      priority: normalizePriority(row.priority ?? row.risk_level),
      updatedAt: text(row.updated_at ?? row.created_at ?? row.generated_at, ""),
      actionHref: text(row.action_href, defaultActionHref(queue, row)),
      relatedHref: text(row.related_href, ""),
      source: "operator_api" as const,
      deviceId,
      fieldId,
      alertId,
      sourceId: idText(row.source_id ?? row.id),
      queueId: idText(row.queue_id ?? row.todo_id ?? row.id),
      handlingStatus: normalizeHandlingStatus(row.handling_status, "OPEN"),
    };
  });
}

function buildApprovalFallback(payload: unknown): OperatorWorkbenchItem[] {
  const rows = arrayFrom(payload, ["items", "requests", "approval_requests", "data"]);
  return rows.slice(0, 12).map((row, index) => ({
    id: idText(row.approval_request_id ?? row.request_id ?? row.id) || `approval-${index}`,
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
    sourceId: idText(row.approval_request_id ?? row.request_id ?? row.id),
    handlingStatus: "READ_ONLY" as const,
  }));
}

function buildReportFallback(payload: unknown): OperatorWorkbenchItem[] {
  const aggregate = payload && typeof payload === "object" ? (payload as AnyRecord) : {};
  const recentOperations = arrayFrom(aggregate, ["recent_operations", "operations"]);
  const items: OperatorWorkbenchItem[] = [];

  for (const row of recentOperations.slice(0, 20)) {
    const status = text(row.final_status ?? row.status ?? row.acceptance_status).toUpperCase();
    const operationId = idText(row.operation_id ?? row.operation_plan_id ?? row.id);
    const base = {
      id: operationId || `operation-${items.length}`,
      fieldName: fieldDisplayName(row),
      operationName: operationDisplayName(row),
      updatedAt: text(row.updated_at ?? row.generated_at ?? row.finished_at, ""),
      relatedHref: operationHref(operationId),
      source: "reports_aggregate" as const,
      sourceId: operationId,
      handlingStatus: "READ_ONLY" as const,
    };

    if (status.includes("PENDING_ACCEPTANCE")) items.push({ ...base, queue: "ACCEPTANCE_PENDING", title: "待验收作业", description: `${base.operationName} 等待验收结论。`, priority: "MEDIUM", actionHref: "/operator/acceptance" });
    else if (status.includes("INVALID_EXECUTION") || status.includes("FAILED")) items.push({ ...base, queue: "EXECUTION_EXCEPTION", title: "执行异常作业", description: `${base.operationName} 需要复核执行状态。`, priority: "HIGH", actionHref: "/operator/dispatch" });
    else if (status.includes("ACCEPTANCE_FAILED") || status === "FAIL") items.push({ ...base, queue: "ACCEPTANCE_FAILED", title: "验收失败作业", description: `${base.operationName} 未通过验收，需要处理。`, priority: "HIGH", actionHref: "/operator/acceptance" });
    else {
      const evidenceText = `${row.evidence_status ?? ""} ${row.evidence_summary ?? ""} ${row.risk_reason ?? ""}`.toUpperCase();
      if (evidenceText.includes("MISSING") || evidenceText.includes("INSUFFICIENT") || evidenceText.includes("证据不足")) items.push({ ...base, queue: "EVIDENCE_INSUFFICIENT", title: "证据不足作业", description: `${base.operationName} 需要补齐证据。`, priority: "HIGH", actionHref: "/operator/evidence" });
    }
  }

  const topRiskFields = arrayFrom(aggregate, ["top_risk_fields", "risk_fields"]);
  for (const row of topRiskFields.slice(0, 6)) {
    const riskReasons = Array.isArray(row.risk_reasons) ? row.risk_reasons.join("、") : text(row.risk_reason ?? row.reason, "风险原因待确认");
    if (/offline|离线/i.test(riskReasons)) {
      const fieldId = idText(row.field_id ?? row.id);
      const deviceId = idText(row.device_id ?? row.deviceId);
      const aggregateSource = deviceId ? "" : "aggregate";
      items.push({
        id: `offline-${deviceId || fieldId || items.length}`,
        queue: "DEVICE_OFFLINE",
        title: "设备离线风险",
        description: deviceId ? `${fieldDisplayName(row)} 存在设备离线风险，需要进入设备与告警中心复核。` : `${fieldDisplayName(row)} 的设备离线待办来自聚合统计，当前没有设备明细。`,
        fieldName: fieldDisplayName(row),
        operationName: deviceId || "聚合统计设备待定位",
        priority: "MEDIUM",
        updatedAt: text(row.updated_at ?? row.generated_at, ""),
        actionHref: deviceOfflineHref({ deviceId, fieldId, source: aggregateSource }),
        relatedHref: fieldHref(fieldId),
        source: "reports_aggregate",
        deviceId: deviceId || null,
        fieldId: fieldId || null,
        sourceId: idText(row.source_id ?? row.id ?? fieldId),
        queueId: `DEVICE_OFFLINE:${deviceId || fieldId || items.length}`,
        handlingStatus: "READ_ONLY",
      });
    }
  }

  return items;
}

function buildAlertsFallback(payload: unknown): OperatorWorkbenchItem[] {
  const rows = arrayFrom(payload, ["items", "alerts", "data"]);
  return rows.slice(0, 12).map((row, index) => {
    const isOverdue = Boolean(row.overdue) || /overdue|timeout|超时/i.test(`${row.status ?? ""} ${row.reason ?? ""} ${row.title ?? ""}`);
    const queue = isOverdue ? "ALERT_OVERDUE" as const : "EXECUTION_EXCEPTION" as const;
    const alertId = idText(row.alert_id ?? row.id) || `alert-${index}`;
    const fieldId = idText(row.field_id ?? row.fieldId);
    return {
      id: alertId,
      queue,
      title: isOverdue ? "告警超时" : "告警待处理",
      description: text(row.title ?? row.description ?? row.reason, "告警需要运营复核。"),
      fieldName: text(row.field_name, ""),
      operationName: text(row.operation_title ?? alertId, ""),
      priority: normalizePriority(row.severity ?? row.priority),
      updatedAt: text(row.updated_at ?? row.created_at ?? row.generated_at, ""),
      actionHref: isOverdue ? alertOverdueHref({ alertId, fieldId }) : "/operator/dispatch",
      relatedHref: null,
      source: "alerts_api" as const,
      fieldId,
      alertId,
      sourceId: alertId,
      handlingStatus: "READ_ONLY" as const,
    };
  });
}

type OptionalApiResult = { ok: boolean; status: number; data: unknown | null };

async function fetchOptional(path: string): Promise<OptionalApiResult> {
  try {
    const result = await apiRequestWithPolicy<unknown>(path, undefined, { allowedStatuses: [403, 404, 405, 422, 501], silent: true, timeoutMs: 10000 });
    return { ok: Boolean(result.ok), status: Number(result.status ?? 0), data: result.data ?? null };
  } catch {
    return { ok: false, status: 0, data: null };
  }
}

export async function fetchOperatorWorkbench(): Promise<OperatorWorkbenchResponse> {
  const official = await fetchOptional(withQuery("/api/v1/operator/workbench"));
  const officialItems = normalizeOfficial(official.data);
  if (official.ok || (official.data && typeof official.data === "object" && ((official.data as AnyRecord).dataScope === "OFFICIAL_OPERATOR_API" || text((official.data as AnyRecord).source).includes("operator_workbench")))) {
    return { source: "operator_workbench_api", dataScope: "OFFICIAL_OPERATOR_API", generated_at: new Date().toISOString(), items: officialItems };
  }

  if (![404, 405, 501].includes(official.status)) {
    return { source: "operator_workbench_api", dataScope: "OFFICIAL_OPERATOR_API", generated_at: new Date().toISOString(), items: officialItems };
  }

  const [approvals, aggregate, alerts] = await Promise.all([
    fetchOptional(withQuery("/api/v1/approvals/requests")),
    fetchOptional(withQuery("/api/v1/reports/customer-dashboard/aggregate")),
    fetchOptional(withQuery("/api/v1/alerts")),
  ]);

  const fallbackItems = [...buildApprovalFallback(approvals.data), ...buildReportFallback(aggregate.data), ...buildAlertsFallback(alerts.data)];
  if (fallbackItems.length > 0) return { source: "fallback_existing_sources", dataScope: "FALLBACK_LIMITED", generated_at: new Date().toISOString(), items: fallbackItems, message: "当前展示 approvals / reports / alerts 可见数据包装后的有限运营队列，非完整运营总队列。" };

  return { source: "fallback_existing_sources", dataScope: "EMPTY", generated_at: new Date().toISOString(), items: [], message: "暂无可处理运营事项。" };
}
