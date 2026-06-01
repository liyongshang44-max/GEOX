import type { OperatorWorkbenchHandlingStatus, OperatorWorkbenchItem, OperatorWorkbenchQueueKey, OperatorWorkbenchResponse } from "../api/operatorWorkbench";
import { replaceOperatorTerms } from "../lib/operatorStatusLabels";

export type OperatorWorkbenchQueueVm = {
  key: OperatorWorkbenchQueueKey;
  title: string;
  description: string;
  count: number;
  actionHref: string;
  items: OperatorWorkbenchTodoVm[];
};

export type OperatorWorkbenchTodoVm = {
  id: string;
  title: string;
  description: string;
  metaText: string;
  priorityText: string;
  updatedAtText: string;
  actionHref: string;
  relatedHref?: string | null;
  sourceText: string;
  deviceId?: string | null;
  fieldId?: string | null;
  alertId?: string | null;
  sourceId?: string | null;
  queueId?: string | null;
  handlingStatus?: OperatorWorkbenchHandlingStatus;
  handlingStatusText: string;
};

export type OperatorWorkbenchSummaryVm = {
  total: number;
  operationTodos: number;
  deviceTodos: number;
  evidenceTodos: number;
  alertTodos: number;
  explanationText: string;
};

export type OperatorWorkbenchVm = {
  title: string;
  lead: string;
  generatedAtText: string;
  dataScopeText: string;
  dataScopeWarning?: string;
  totalCount: number;
  summary: OperatorWorkbenchSummaryVm;
  queues: OperatorWorkbenchQueueVm[];
  emptyTitle: string;
  emptyDescription: string;
};

const OPERATION_QUEUE_KEYS = new Set<OperatorWorkbenchQueueKey>([
  "APPROVAL_PENDING",
  "DISPATCH_PENDING",
  "EXECUTION_EXCEPTION",
  "ACCEPTANCE_PENDING",
  "ACCEPTANCE_FAILED",
]);

const QUEUE_META: Record<OperatorWorkbenchQueueKey, { title: string; description: string; actionHref: string }> = {
  APPROVAL_PENDING: { title: "待审批", description: "建议、处方或关键动作等待授权。", actionHref: "/operator/approvals" },
  DISPATCH_PENDING: { title: "待派发", description: "已形成任务但尚未进入执行。", actionHref: "/operator/dispatch" },
  EXECUTION_EXCEPTION: { title: "执行异常", description: "执行失败、无效执行或状态异常。", actionHref: "/operator/dispatch" },
  ACCEPTANCE_PENDING: { title: "待验收", description: "已执行完成但尚未形成验收结论。", actionHref: "/operator/acceptance" },
  EVIDENCE_INSUFFICIENT: { title: "证据不足", description: "缺少验收所需证据或证据摘要。", actionHref: "/operator/evidence" },
  ACCEPTANCE_FAILED: { title: "验收未通过", description: "验收未通过，需要复核或补救。", actionHref: "/operator/acceptance" },
  DEVICE_OFFLINE: { title: "设备离线", description: "这些设备需要检查最近心跳、绑定地块和数据采集状态。", actionHref: "/operator/devices-alerts" },
  ALERT_OVERDUE: { title: "告警超时", description: "告警长时间未处理或关闭。", actionHref: "/operator/devices-alerts" },
};

const QUEUE_ORDER: OperatorWorkbenchQueueKey[] = [
  "APPROVAL_PENDING",
  "DISPATCH_PENDING",
  "EXECUTION_EXCEPTION",
  "ACCEPTANCE_PENDING",
  "EVIDENCE_INSUFFICIENT",
  "ACCEPTANCE_FAILED",
  "DEVICE_OFFLINE",
  "ALERT_OVERDUE",
];

function text(value: unknown, fallback = ""): string {
  const raw = String(value ?? "").trim();
  if (!raw || raw === "--" || raw === "undefined" || raw === "null") return fallback;
  return replaceOperatorTerms(raw);
}

function dateText(value: unknown): string {
  const raw = text(value);
  if (!raw) return "暂无更新时间";
  const ms = Date.parse(raw);
  if (!Number.isFinite(ms) || ms <= 0) return "暂无更新时间";
  return new Date(ms).toLocaleString("zh-CN", { hour12: false });
}

function priorityText(value: OperatorWorkbenchItem["priority"]): string {
  if (value === "HIGH") return "高优先级";
  if (value === "MEDIUM") return "中优先级";
  if (value === "LOW") return "低优先级";
  return "优先级待确认";
}

function sourceText(value: OperatorWorkbenchItem["source"]): string {
  if (value === "operator_api") return "运营接口";
  if (value === "approvals_api") return "审批接口 fallback";
  if (value === "reports_aggregate") return "报告聚合 fallback";
  if (value === "alerts_api") return "告警接口 fallback";
  return "fallback";
}

function handlingStatusText(value: OperatorWorkbenchItem["handlingStatus"]): string {
  if (value === "OPEN") return "待处理";
  if (value === "ACKED") return "已确认";
  if (value === "FOLLOWUP_REQUIRED") return "需继续跟进";
  if (value === "TASK_CANDIDATE_CREATED") return "已记录任务候选";
  if (value === "CLOSED") return "已关闭";
  if (value === "READ_ONLY") return "只读待核查";
  return "状态待确认";
}

function metaText(item: OperatorWorkbenchItem): string {
  const parts = [text(item.fieldName), text(item.operationName), text(item.deviceId), text(item.alertId)].filter(Boolean);
  return parts.length ? parts.join(" · ") : "对象范围待确认";
}

function buildTodo(item: OperatorWorkbenchItem): OperatorWorkbenchTodoVm {
  return {
    id: item.id,
    title: text(item.title, QUEUE_META[item.queue].title),
    description: text(item.description, QUEUE_META[item.queue].description),
    metaText: metaText(item),
    priorityText: priorityText(item.priority),
    updatedAtText: dateText(item.updatedAt),
    actionHref: item.actionHref || QUEUE_META[item.queue].actionHref,
    relatedHref: item.relatedHref ?? null,
    sourceText: sourceText(item.source),
    deviceId: item.deviceId ?? null,
    fieldId: item.fieldId ?? null,
    alertId: item.alertId ?? null,
    sourceId: item.sourceId ?? null,
    queueId: item.queueId ?? null,
    handlingStatus: item.handlingStatus,
    handlingStatusText: handlingStatusText(item.handlingStatus),
  };
}

function scopeText(response: OperatorWorkbenchResponse): string {
  if (response.dataScope === "OFFICIAL_OPERATOR_API") return "正式运营总队列";
  if (response.dataScope === "FALLBACK_LIMITED") return "有限 fallback 队列";
  if (response.dataScope === "ERROR_EMPTY") return "运营总队列暂不可用";
  return "暂无运营待办";
}

function countByQueue(items: OperatorWorkbenchItem[], predicate: (queue: OperatorWorkbenchQueueKey) => boolean): number {
  return items.filter((item) => predicate(item.queue)).length;
}

function buildSummary(items: OperatorWorkbenchItem[]): OperatorWorkbenchSummaryVm {
  const operationTodos = countByQueue(items, (queue) => OPERATION_QUEUE_KEYS.has(queue));
  const deviceTodos = countByQueue(items, (queue) => queue === "DEVICE_OFFLINE");
  const evidenceTodos = countByQueue(items, (queue) => queue === "EVIDENCE_INSUFFICIENT");
  const alertTodos = countByQueue(items, (queue) => queue === "ALERT_OVERDUE");
  const total = items.length;
  return {
    total,
    operationTodos,
    deviceTodos,
    evidenceTodos,
    alertTodos,
    explanationText: `待处理总数 ${total} = 作业待办 ${operationTodos} + 设备待办 ${deviceTodos} + 证据待办 ${evidenceTodos} + 告警待办 ${alertTodos}。`,
  };
}

export function buildOperatorWorkbenchVm(response: OperatorWorkbenchResponse): OperatorWorkbenchVm {
  const sourceItems = response.items ?? [];
  const todos = sourceItems.map(buildTodo);
  const queues = QUEUE_ORDER.map((key) => {
    const meta = QUEUE_META[key];
    const items = todos.filter((_, index) => sourceItems[index]?.queue === key);
    return {
      key,
      title: meta.title,
      description: meta.description,
      count: items.length,
      actionHref: meta.actionHref,
      items,
    };
  });
  const summary = buildSummary(sourceItems);

  return {
    title: "运营总队列",
    lead: "汇总今天需要处理的审批、派发、异常、验收、证据、设备和告警事项。",
    generatedAtText: dateText(response.generated_at),
    dataScopeText: scopeText(response),
    dataScopeWarning: response.dataScope === "FALLBACK_LIMITED" ? text(response.message, "当前展示有限 fallback 数据，非完整运营总队列。") : undefined,
    totalCount: summary.total,
    summary,
    queues,
    emptyTitle: "暂无可处理运营事项",
    emptyDescription: "当前没有待审批、待派发、执行异常、待验收、证据不足、验收未通过、设备离线或告警超时事项。",
  };
}
