import type { OperatorDispatchItem, OperatorDispatchResponse, OperatorDispatchStatus, OperatorExecutionMode } from "../api/operatorDispatch";

export type OperatorDispatchRowVm = {
  taskId: string;
  receiptIdText: string;
  title: string;
  objectText: string;
  statusText: string;
  statusTone: "danger" | "warning" | "success" | "neutral";
  executionModeText: string;
  taskText: string;
  dispatchText: string;
  ackText: string;
  receiptText: string;
  executorText: string;
  failureReasonText: string;
  sourceText: string;
  taskHref?: string | null;
  receiptHref?: string | null;
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

type DispatchGroupKey = "TASK_CREATED" | "DISPATCH_PENDING" | "DISPATCHED" | "ACKED" | "RECEIPT_PENDING" | "EXECUTION_FAILED" | "HUMAN" | "DEVICE";

const GROUP_META: Record<DispatchGroupKey, { title: string; description: string }> = {
  TASK_CREATED: { title: "已生成任务", description: "AO-ACT task 已生成，需要关注后续派发。" },
  DISPATCH_PENDING: { title: "待派发任务", description: "任务已准备但尚未派发给人或设备。" },
  DISPATCHED: { title: "已派发任务", description: "任务已派发，等待 ACK 或执行回执。" },
  ACKED: { title: "ACKED", description: "执行方已确认接收任务。" },
  RECEIPT_PENDING: { title: "回执待收", description: "任务执行状态尚未形成回执；执行完成不等于验收通过。" },
  EXECUTION_FAILED: { title: "执行失败", description: "任务执行失败或被判定为无效执行，必须展示失败原因。" },
  HUMAN: { title: "人工执行任务", description: "由人工或服务队执行的任务。" },
  DEVICE: { title: "设备执行任务", description: "由设备、阀门、泵站或自动化执行器执行的任务。" },
};

const GROUP_ORDER: DispatchGroupKey[] = ["TASK_CREATED", "DISPATCH_PENDING", "DISPATCHED", "ACKED", "RECEIPT_PENDING", "EXECUTION_FAILED", "HUMAN", "DEVICE"];

function text(value: unknown, fallback = ""): string {
  const raw = String(value ?? "").trim();
  if (!raw || raw === "--" || raw === "undefined" || raw === "null") return fallback;
  return raw;
}

function dateText(value: unknown): string {
  const raw = text(value);
  if (!raw) return "暂无记录";
  const ms = Date.parse(raw);
  if (!Number.isFinite(ms) || ms <= 0) return "暂无记录";
  return new Date(ms).toLocaleString("zh-CN", { hour12: false });
}

function statusText(value: OperatorDispatchStatus): string {
  if (value === "TASK_CREATED") return "已生成任务";
  if (value === "DISPATCH_PENDING") return "待派发";
  if (value === "DISPATCHED") return "已派发";
  if (value === "ACKED") return "已确认接收";
  if (value === "RECEIPT_PENDING") return "回执待收";
  if (value === "EXECUTION_FAILED") return "执行失败";
  if (value === "RECEIPT_RECEIVED") return "已收到回执";
  return "状态待确认";
}

function statusTone(value: OperatorDispatchStatus): OperatorDispatchRowVm["statusTone"] {
  if (value === "EXECUTION_FAILED") return "danger";
  if (value === "DISPATCH_PENDING" || value === "RECEIPT_PENDING") return "warning";
  if (value === "ACKED" || value === "RECEIPT_RECEIVED") return "success";
  return "neutral";
}

function modeText(value: OperatorExecutionMode): string {
  if (value === "HUMAN") return "人工执行";
  if (value === "DEVICE") return "设备执行";
  return "执行方式待确认";
}

function sourceText(value: OperatorDispatchItem["source"]): string {
  if (value === "operator_dispatch_api") return "运营派发接口";
  if (value === "actions_index") return "AO-ACT index fallback";
  return "报告聚合 fallback";
}

function objectText(item: OperatorDispatchItem): string {
  const parts = [text(item.fieldName), text(item.operationName)].filter(Boolean);
  return parts.length ? parts.join(" · ") : "执行对象待确认";
}

function buildRow(item: OperatorDispatchItem): OperatorDispatchRowVm {
  return {
    taskId: text(item.taskId, "任务编号待确认"),
    receiptIdText: text(item.receiptId, "尚未收到回执"),
    title: text(item.operationName, "派发任务"),
    objectText: objectText(item),
    statusText: statusText(item.status),
    statusTone: statusTone(item.status),
    executionModeText: modeText(item.executionMode),
    taskText: `任务：${text(item.taskId, "待确认")} · ${dateText(item.taskCreatedAt)}`,
    dispatchText: `派发：${dateText(item.dispatchedAt)}`,
    ackText: `ACK：${dateText(item.ackedAt)}`,
    receiptText: `回执：${text(item.receiptId, "未收到")} · ${dateText(item.receiptReceivedAt)}`,
    executorText: text(item.executorText, "执行方待确认"),
    failureReasonText: text(item.failureReason, item.status === "EXECUTION_FAILED" ? "失败原因待补充" : "无失败原因"),
    sourceText: sourceText(item.source),
    taskHref: item.taskHref ?? null,
    receiptHref: item.receiptHref ?? null,
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
  const rows = (response.items ?? []).map(buildRow);
  return {
    title: "派发状态",
    lead: "查看 AO-ACT task、dispatch、ACK、receipt 的只读状态，区分执行完成与验收通过。",
    generatedAtText: dateText(response.generated_at),
    dataScopeText: dataScopeText(response),
    dataScopeWarning: response.dataScope === "FALLBACK_LIMITED" ? response.message || "当前展示有限 fallback 派发数据，非完整 operator dispatch。" : undefined,
    writeReady: response.writeReady,
    totalCount: rows.length,
    groups: groupRows(rows, response.items ?? []),
    emptyTitle: "暂无派发任务",
    emptyDescription: "当前没有已生成、待派发、已派发、ACKED、回执待收或执行失败任务。",
  };
}
