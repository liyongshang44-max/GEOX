import type { OperatorDispatchItem, OperatorDispatchResponse, OperatorDispatchStatus, OperatorExecutionMode } from "../api/operatorDispatch";
import { mapOperatorStatusLabel, replaceOperatorTerms } from "../lib/operatorStatusLabels";

export type OperatorActionButtonStateV1 = {
  canAction: boolean;
  disabledReason: string | null;
  pending: boolean;
  lastError: string | null;
};

export type OperatorDispatchTechnicalRefsVm = {
  taskIdText: string;
  receiptIdText: string;
  sourceText: string;
};

export type OperatorDispatchRowVm = {
  taskId: string;
  receiptIdText: string;
  title: string;
  objectText: string;
  statusText: string;
  nextActionText: string;
  statusTone: "danger" | "warning" | "success" | "neutral";
  executionModeText: string;
  taskText: string;
  dispatchText: string;
  ackText: string;
  receiptText: string;
  executorText: string;
  deviceText: string;
  failureReasonText: string;
  sourceText: string;
  taskHref?: string | null;
  receiptHref?: string | null;
  canDispatch: boolean;
  canRetry: boolean;
  dispatchButtonState: OperatorActionButtonStateV1;
  retryButtonState: OperatorActionButtonStateV1;
  disabledReason: string;
  technicalRefs: OperatorDispatchTechnicalRefsVm;
};

export type OperatorDispatchGroupVm = {
  key: string;
  title: string;
  description: string;
  count: number;
  rows: OperatorDispatchRowVm[];
};

export type OperatorDispatchVm = {
  title: string;
  lead: string;
  generatedAtText: string;
  dataScopeText: string;
  dataScopeWarning?: string;
  writeReady: boolean;
  totalCount: number;
  groups: OperatorDispatchGroupVm[];
  emptyTitle: string;
  emptyDescription: string;
};

type DispatchGroupKey = "TASK_CREATED" | "DISPATCH_PENDING" | "DISPATCHED" | "RETRY_DISPATCHED" | "ACKED" | "RECEIPT_PENDING" | "EXECUTION_FAILED" | "RECEIPT_RECEIVED" | "COMPLETED" | "HUMAN" | "DEVICE";

const GROUP_META: Record<DispatchGroupKey, { title: string; description: string }> = {
  TASK_CREATED: { title: "已生成任务", description: "任务已生成，尚未派发；下一步是确认执行方并派发。" },
  DISPATCH_PENDING: { title: "待派发任务", description: "任务已准备但尚未派发给人或设备。" },
  DISPATCHED: { title: "已派发任务", description: "任务已派发，等待接单确认或执行回执。" },
  RETRY_DISPATCHED: { title: "已重新派发", description: "失败任务已重新派发，等待后续接单确认或执行回执。" },
  ACKED: { title: "已接单", description: "执行方已确认接收任务，等待执行回执。" },
  RECEIPT_PENDING: { title: "执行回执待收", description: "任务执行状态尚未形成回执；执行完成不等于验收通过。" },
  EXECUTION_FAILED: { title: "执行失败", description: "任务执行失败或被判定为无效执行，失败状态允许重试。" },
  RECEIPT_RECEIVED: { title: "已收到执行回执", description: "执行回执已记录，后续仍需验收中心判断结果。" },
  COMPLETED: { title: "已完成任务", description: "任务已完成，不能重试；验收通过仍以验收中心和作业报告为准。" },
  HUMAN: { title: "人工执行任务", description: "由人工或服务队执行的任务。" },
  DEVICE: { title: "设备执行任务", description: "由设备、阀门、泵站或自动化执行器执行的任务。" },
};

const GROUP_ORDER: DispatchGroupKey[] = ["TASK_CREATED", "DISPATCH_PENDING", "DISPATCHED", "RETRY_DISPATCHED", "ACKED", "RECEIPT_PENDING", "EXECUTION_FAILED", "RECEIPT_RECEIVED", "COMPLETED", "HUMAN", "DEVICE"];

function isTechnicalId(value: unknown): boolean {
  const raw = String(value ?? "").trim();
  return /^(act|task|ao_act|receipt|rec|prc|apr|opl|ft_op|ft_field)_[A-Za-z0-9_-]+$/i.test(raw)
    || /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(raw);
}

function text(value: unknown, fallback = ""): string {
  const raw = String(value ?? "").trim();
  if (!raw || raw === "--" || raw === "undefined" || raw === "null") return fallback;
  if (/token|secret|credential|private\s*key|password|stack\s*trace|debug\s*json/i.test(raw)) return fallback;
  return replaceOperatorTerms(raw);
}

function businessText(value: unknown, fallback = ""): string {
  if (isTechnicalId(value)) return fallback;
  return text(value, fallback);
}

function dateText(value: unknown): string {
  const raw = text(value);
  if (!raw) return "暂无记录";
  const ms = Date.parse(raw);
  if (!Number.isFinite(ms) || ms <= 0) return "暂无记录";
  return new Date(ms).toLocaleString("zh-CN", { hour12: false });
}

function includesIrrigation(item: OperatorDispatchItem): boolean {
  const haystack = [item.operationName, item.fieldName, item.executorText].map((x) => String(x ?? "")).join(" ");
  return /IRRIGATE|IRRIGATION|灌溉/i.test(haystack);
}

function dispatchTitle(item: OperatorDispatchItem): string {
  if (includesIrrigation(item)) return "灌溉任务";
  const base = businessText(item.operationName, "派发任务");
  if (base === "灌溉") return "灌溉任务";
  return base;
}

function statusText(value: OperatorDispatchStatus): string {
  if (value === "TASK_CREATED") return "已生成，尚未派发";
  if (value === "DISPATCH_PENDING") return "待派发";
  if (value === "DISPATCHED") return "已派发，等待接单确认";
  if (value === "RETRY_DISPATCHED") return "已重新派发，等待接单确认";
  if (value === "ACKED") return "已接单，等待执行回执";
  if (value === "RECEIPT_PENDING") return "执行回执待收";
  if (value === "EXECUTION_FAILED") return "执行失败";
  if (value === "RECEIPT_RECEIVED") return "已收到执行回执";
  if (value === "COMPLETED") return "已完成";
  return mapOperatorStatusLabel(value, "dispatch", "状态待确认");
}

function nextActionText(value: OperatorDispatchStatus): string {
  if (value === "TASK_CREATED") return "确认执行方后派发任务";
  if (value === "DISPATCH_PENDING") return "执行派发";
  if (value === "DISPATCHED" || value === "RETRY_DISPATCHED") return "等待接单确认或执行回执";
  if (value === "ACKED") return "等待执行回执";
  if (value === "RECEIPT_PENDING") return "跟进执行方补充执行回执";
  if (value === "EXECUTION_FAILED") return "复核失败原因，必要时重试派发";
  if (value === "RECEIPT_RECEIVED" || value === "COMPLETED") return "进入验收中心复核执行结果";
  return "确认任务状态后再处理";
}

function statusTone(value: OperatorDispatchStatus): OperatorDispatchRowVm["statusTone"] {
  if (value === "EXECUTION_FAILED") return "danger";
  if (value === "TASK_CREATED" || value === "DISPATCH_PENDING" || value === "RECEIPT_PENDING") return "warning";
  if (value === "ACKED" || value === "RECEIPT_RECEIVED" || value === "DISPATCHED" || value === "RETRY_DISPATCHED" || value === "COMPLETED") return "success";
  return "neutral";
}

function modeText(value: OperatorExecutionMode): string {
  if (value === "HUMAN") return "人工执行";
  if (value === "DEVICE") return "设备执行";
  return "执行方式待确认";
}

function sourceText(value: OperatorDispatchItem["source"]): string {
  if (value === "operator_dispatch_api") return "运营派发接口";
  if (value === "actions_index") return "执行任务索引 fallback";
  return "报告聚合 fallback";
}

function objectText(item: OperatorDispatchItem): string {
  const parts = [businessText(item.fieldName), businessText(item.operationName)].filter(Boolean);
  return parts.length ? parts.join(" / ") : "任务对象待确认";
}

function buildDispatchButtonState(item: OperatorDispatchItem, writeReady: boolean): OperatorActionButtonStateV1 {
  if (!writeReady) return { canAction: false, disabledReason: "当前不可派发：派发写操作未 ready，当前只读。", pending: false, lastError: null };
  if (!item.taskId) return { canAction: false, disabledReason: "当前不可派发：执行任务未生成。", pending: false, lastError: null };
  if (!item.canDispatch) return { canAction: false, disabledReason: text(item.permissionReason, "当前任务状态不允许派发。"), pending: false, lastError: null };
  return { canAction: true, disabledReason: null, pending: false, lastError: null };
}

function buildRetryButtonState(item: OperatorDispatchItem, writeReady: boolean): OperatorActionButtonStateV1 {
  if (!writeReady) return { canAction: false, disabledReason: "当前任务状态不允许重试；只有失败状态可以重试。", pending: false, lastError: null };
  if (!item.taskId) return { canAction: false, disabledReason: "当前任务状态不允许重试；执行任务未生成。", pending: false, lastError: null };
  if (!item.canRetry) return { canAction: false, disabledReason: "当前任务状态不允许重试；只有失败状态可以重试。", pending: false, lastError: null };
  return { canAction: true, disabledReason: null, pending: false, lastError: null };
}

function taskText(item: OperatorDispatchItem): string {
  if (item.status === "TASK_CREATED") return `已生成，尚未派发 · ${dateText(item.taskCreatedAt)}`;
  return `已生成 · ${dateText(item.taskCreatedAt)}`;
}

function dispatchText(item: OperatorDispatchItem): string {
  if (item.status === "TASK_CREATED" || item.status === "DISPATCH_PENDING") return "尚未派发";
  return dateText(item.dispatchedAt);
}

function ackText(item: OperatorDispatchItem): string {
  return item.ackedAt ? `已收到 · ${dateText(item.ackedAt)}` : "未收到";
}

function receiptText(item: OperatorDispatchItem): string {
  return item.receiptId ? `已收到 · ${dateText(item.receiptReceivedAt)}` : "未收到";
}

function deviceText(item: OperatorDispatchItem): string {
  if (item.executionMode !== "DEVICE") return "待确认";
  return businessText(item.executorText, "待确认");
}

function buildTechnicalRefs(item: OperatorDispatchItem): OperatorDispatchTechnicalRefsVm {
  return {
    taskIdText: text(item.taskId, "执行任务 ID 待确认"),
    receiptIdText: text(item.receiptId, "未收到执行回执 ID"),
    sourceText: sourceText(item.source),
  };
}

function buildRow(item: OperatorDispatchItem, writeReady: boolean): OperatorDispatchRowVm {
  const dispatchButtonState = buildDispatchButtonState(item, writeReady);
  const retryButtonState = buildRetryButtonState(item, writeReady);
  return {
    taskId: text(item.taskId, "任务编号待确认"),
    receiptIdText: text(item.receiptId, "尚未收到执行回执"),
    title: dispatchTitle(item),
    objectText: objectText(item),
    statusText: statusText(item.status),
    nextActionText: nextActionText(item.status),
    statusTone: statusTone(item.status),
    executionModeText: modeText(item.executionMode),
    taskText: taskText(item),
    dispatchText: dispatchText(item),
    ackText: ackText(item),
    receiptText: receiptText(item),
    executorText: businessText(item.executorText, "待确认"),
    deviceText: deviceText(item),
    failureReasonText: text(item.failureReason, item.status === "EXECUTION_FAILED" ? "失败原因待补充" : "无失败原因"),
    sourceText: sourceText(item.source),
    taskHref: item.taskHref ?? null,
    receiptHref: item.receiptHref ?? null,
    canDispatch: dispatchButtonState.canAction,
    canRetry: retryButtonState.canAction,
    dispatchButtonState,
    retryButtonState,
    disabledReason: dispatchButtonState.disabledReason || retryButtonState.disabledReason || "",
    technicalRefs: buildTechnicalRefs(item),
  };
}

function dataScopeText(response: OperatorDispatchResponse): string {
  if (response.dataScope === "OFFICIAL_OPERATOR_API") return "正式运营派发状态";
  if (response.dataScope === "FALLBACK_LIMITED") return "有限 fallback 派发状态";
  if (response.dataScope === "ERROR_EMPTY") return "派发状态暂不可用";
  return "暂无派发任务";
}

function groupRows(rows: OperatorDispatchRowVm[], rawItems: OperatorDispatchItem[]): OperatorDispatchGroupVm[] {
  return GROUP_ORDER.map((key) => {
    let filtered: OperatorDispatchRowVm[] = [];
    if (key === "HUMAN") filtered = rows.filter((_, index) => rawItems[index]?.executionMode === "HUMAN");
    else if (key === "DEVICE") filtered = rows.filter((_, index) => rawItems[index]?.executionMode === "DEVICE");
    else filtered = rows.filter((_, index) => rawItems[index]?.status === key);
    const meta = GROUP_META[key];
    return { key, title: meta.title, description: meta.description, count: filtered.length, rows: filtered };
  });
}

export function buildOperatorDispatchVm(response: OperatorDispatchResponse): OperatorDispatchVm {
  const rows = (response.items ?? []).map((item) => buildRow(item, response.writeReady));
  return {
    title: "派发状态",
    lead: "查看执行任务、派发、接单确认、执行回执的状态，区分执行完成与验收通过。",
    generatedAtText: dateText(response.generated_at),
    dataScopeText: dataScopeText(response),
    dataScopeWarning: response.dataScope === "FALLBACK_LIMITED" ? replaceOperatorTerms(response.message || "当前展示有限 fallback 派发数据，非完整 operator dispatch。") : undefined,
    writeReady: response.writeReady,
    totalCount: rows.length,
    groups: groupRows(rows, response.items ?? []),
    emptyTitle: "暂无派发任务",
    emptyDescription: "当前没有已生成、待派发、已派发、已接单、执行回执待收或执行失败任务。",
  };
}
