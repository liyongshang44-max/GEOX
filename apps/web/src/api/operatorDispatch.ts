import { apiRequestWithPolicy, withQuery } from "./client";

export type OperatorDispatchDataScope = "OFFICIAL_OPERATOR_API" | "FALLBACK_LIMITED" | "EMPTY" | "ERROR_EMPTY";
export type OperatorDispatchStatus = "TASK_CREATED" | "DISPATCH_PENDING" | "DISPATCHED" | "ACKED" | "RECEIPT_PENDING" | "EXECUTION_FAILED" | "RECEIPT_RECEIVED" | "UNKNOWN";
export type OperatorExecutionMode = "HUMAN" | "DEVICE" | "UNKNOWN";

export type OperatorDispatchItem = {
  taskId: string;
  receiptId?: string | null;
  operationId?: string | null;
  fieldName?: string | null;
  operationName?: string | null;
  status: OperatorDispatchStatus;
  executionMode: OperatorExecutionMode;
  taskCreatedAt?: string | null;
  dispatchedAt?: string | null;
  ackedAt?: string | null;
  receiptReceivedAt?: string | null;
  executorText?: string | null;
  failureReason?: string | null;
  taskHref?: string | null;
  receiptHref?: string | null;
  source: "operator_dispatch_api" | "actions_index" | "reports_aggregate";
};

export type OperatorDispatchResponse = {
  source: "operator_dispatch_api" | "fallback_existing_sources" | "empty_error_state";
  dataScope: OperatorDispatchDataScope;
  generated_at?: string | null;
  items: OperatorDispatchItem[];
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

function normalizeMode(value: unknown): OperatorExecutionMode {
  const raw = text(value).toUpperCase();
  if (raw.includes("HUMAN") || raw.includes("MANUAL") || raw.includes("人工")) return "HUMAN";
  if (raw.includes("DEVICE") || raw.includes("AUTO") || raw.includes("MACHINE") || raw.includes("设备")) return "DEVICE";
  return "UNKNOWN";
}

function normalizeStatus(row: AnyRecord): OperatorDispatchStatus {
  const raw = text(row.status ?? row.task_status ?? row.dispatch_status ?? row.final_status ?? row.state).toUpperCase();
  const hasReceipt = Boolean(text(row.receipt_id ?? row.receipt?.receipt_id));
  const failed = raw.includes("FAILED") || raw.includes("INVALID_EXECUTION") || raw.includes("ERROR") || Boolean(text(row.failure_reason ?? row.invalid_reason));
  if (failed) return "EXECUTION_FAILED";
  if (hasReceipt || raw.includes("RECEIPT_RECEIVED") || raw.includes("RECEIPT_SUBMITTED")) return "RECEIPT_RECEIVED";
  if (raw.includes("ACKED") || raw.includes("ACK")) return "ACKED";
  if (raw.includes("DISPATCHED") || raw.includes("SENT")) return "DISPATCHED";
  if (raw.includes("PENDING_DISPATCH") || raw.includes("READY_TO_DISPATCH") || raw.includes("WAITING_DISPATCH")) return "DISPATCH_PENDING";
  if (raw.includes("TASK_CREATED") || raw.includes("CREATED")) return "TASK_CREATED";
  if (raw.includes("PENDING_ACCEPTANCE") || raw.includes("RUNNING")) return "RECEIPT_PENDING";
  return "UNKNOWN";
}

function operationHref(operationId: unknown): string | null {
  const id = text(operationId);
  return id ? `/customer/operations/${encodeURIComponent(id)}` : null;
}

function normalizeOfficial(payload: unknown): OperatorDispatchItem[] {
  const rows = arrayFrom(payload, ["items", "tasks", "dispatch", "queue"]);
  return rows.map((row, index) => {
    const operationId = text(row.operation_id ?? row.operationId ?? row.operation_plan_id);
    const receiptId = text(row.receipt_id ?? row.receipt?.receipt_id);
    return {
      taskId: text(row.task_id ?? row.act_task_id ?? row.id, `dispatch-${index}`),
      receiptId,
      operationId,
      fieldName: text(row.field_name ?? row.fieldName, ""),
      operationName: text(row.operation_title ?? row.operation_name ?? row.customer_title, ""),
      status: normalizeStatus(row),
      executionMode: normalizeMode(row.execution_mode ?? row.executor_type ?? row.task_type ?? row.actor_type),
      taskCreatedAt: text(row.task_created_at ?? row.created_at ?? row.generated_at, ""),
      dispatchedAt: text(row.dispatched_at ?? row.dispatch_at, ""),
      ackedAt: text(row.acked_at ?? row.ack_at, ""),
      receiptReceivedAt: text(row.receipt_received_at ?? row.receipt_at ?? row.receipt?.created_at, ""),
      executorText: text(row.executor_name ?? row.executor_id ?? row.device_id ?? row.actor_name, ""),
      failureReason: text(row.failure_reason ?? row.invalid_reason ?? row.error_message, ""),
      taskHref: operationHref(operationId),
      receiptHref: receiptId ? operationHref(operationId) : null,
      source: "operator_dispatch_api" as const,
    };
  });
}

function normalizeActionsFallback(payload: unknown): OperatorDispatchItem[] {
  const rows = arrayFrom(payload, ["items", "tasks", "actions", "data"]);
  return rows.slice(0, 20).map((row, index) => {
    const operationId = text(row.operation_id ?? row.operationPlanId ?? row.operation_plan_id);
    const receiptId = text(row.receipt_id ?? row.receipt?.receipt_id);
    return {
      taskId: text(row.task_id ?? row.act_task_id ?? row.id, `task-${index}`),
      receiptId,
      operationId,
      fieldName: text(row.field_name, ""),
      operationName: text(row.operation_title ?? row.title, ""),
      status: normalizeStatus(row),
      executionMode: normalizeMode(row.execution_mode ?? row.executor_type ?? row.actor_type ?? row.task_kind),
      taskCreatedAt: text(row.created_at ?? row.task_created_at ?? row.generated_at, ""),
      dispatchedAt: text(row.dispatched_at ?? row.dispatch_at, ""),
      ackedAt: text(row.acked_at ?? row.ack_at, ""),
      receiptReceivedAt: text(row.receipt_received_at ?? row.receipt_at, ""),
      executorText: text(row.executor_name ?? row.executor_id ?? row.device_id ?? row.actor_name, ""),
      failureReason: text(row.failure_reason ?? row.invalid_reason ?? row.error_message, ""),
      taskHref: operationHref(operationId),
      receiptHref: receiptId ? operationHref(operationId) : null,
      source: "actions_index" as const,
    };
  });
}

function normalizeReportFallback(payload: unknown): OperatorDispatchItem[] {
  const rows = arrayFrom(payload, ["recent_operations", "operations", "items"]);
  return rows.slice(0, 20).map((row, index) => {
    const operationId = text(row.operation_id ?? row.operation_plan_id ?? row.id);
    const status = normalizeStatus(row);
    const finalStatus = text(row.final_status ?? row.status).toUpperCase();
    const hasReceipt = Boolean(text(row.receipt_id ?? row.receipt?.receipt_id));
    return {
      taskId: text(row.act_task_id ?? row.task_id, `report-task-${index}`),
      receiptId: text(row.receipt_id, ""),
      operationId,
      fieldName: text(row.field_name ?? row.fieldName, ""),
      operationName: text(row.operation_title ?? row.customer_title ?? row.title, "作业待确认"),
      status: hasReceipt ? "RECEIPT_RECEIVED" : (finalStatus.includes("PENDING_ACCEPTANCE") ? "RECEIPT_PENDING" : status),
      executionMode: normalizeMode(row.execution_mode ?? row.executor_type ?? row.task_type),
      taskCreatedAt: text(row.task_created_at ?? row.created_at ?? row.generated_at, ""),
      dispatchedAt: text(row.dispatched_at, ""),
      ackedAt: text(row.acked_at, ""),
      receiptReceivedAt: text(row.receipt_received_at ?? row.finished_at ?? row.updated_at, ""),
      executorText: text(row.executor_name ?? row.device_id ?? row.owner_name, ""),
      failureReason: text(row.failure_reason ?? row.invalid_reason ?? row.risk_reason, ""),
      taskHref: operationHref(operationId),
      receiptHref: hasReceipt ? operationHref(operationId) : null,
      source: "reports_aggregate" as const,
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

export async function fetchOperatorDispatch(): Promise<OperatorDispatchResponse> {
  const official = await fetchOptional(withQuery("/api/v1/operator/dispatch"));
  const officialItems = normalizeOfficial(official.data);
  if (official.ok || (official.data && typeof official.data === "object" && ((official.data as AnyRecord).dataScope === "OFFICIAL_OPERATOR_API" || text((official.data as AnyRecord).source).includes("operator_dispatch")))) {
    return {
      source: "operator_dispatch_api",
      dataScope: "OFFICIAL_OPERATOR_API",
      generated_at: new Date().toISOString(),
      items: officialItems,
      writeReady: false,
      message: "派发写操作需等待后端权限、审计和错误码 ready 后开放。",
    };
  }

  if (![404, 405, 501].includes(official.status)) {
    return {
      source: "operator_dispatch_api",
      dataScope: "OFFICIAL_OPERATOR_API",
      generated_at: new Date().toISOString(),
      items: officialItems,
      writeReady: false,
      message: "派发写操作需等待后端权限、审计和错误码 ready 后开放。",
    };
  }

  const [actions, aggregate] = await Promise.all([
    fetchOptional(withQuery("/api/v1/actions/index")),
    fetchOptional(withQuery("/api/v1/reports/customer-dashboard/aggregate")),
  ]);

  const fallbackItems = [
    ...normalizeActionsFallback(actions.data),
    ...normalizeReportFallback(aggregate.data),
  ].filter((item, index, all) => all.findIndex((x) => x.taskId === item.taskId && x.operationId === item.operationId) === index);

  if (fallbackItems.length > 0) {
    return {
      source: "fallback_existing_sources",
      dataScope: "FALLBACK_LIMITED",
      generated_at: new Date().toISOString(),
      items: fallbackItems,
      writeReady: false,
      message: "当前展示 actions index / reports aggregate 包装后的有限派发状态，非完整 operator dispatch。",
    };
  }

  return {
    source: "fallback_existing_sources",
    dataScope: "EMPTY",
    generated_at: new Date().toISOString(),
    items: [],
    writeReady: false,
    message: "暂无派发任务。",
  };
}
