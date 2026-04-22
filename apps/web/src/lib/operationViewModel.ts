import type { OperationsConsoleApprovalDetail, OperationsConsoleMonitoringItem, OperationsConsoleResponse } from "./api";
import { formatSourceMeta, resolveSourceMeta, type DataOriginValue } from "./dataOrigin";

export type OpsLang = "zh" | "en";
export type WorkStatus = "pending_approval" | "ready_to_dispatch" | "executing" | "completed" | "failed";
export type WorkTab = "pending_approval" | "ready_to_dispatch" | "executing" | "failed";

export type OperationLabels = {
  pageTitle: string;
  pageDesc: string;
  refresh: string;
  auditExport: string;
  createOperation: string;
  pendingApproval: string;
  readyToDispatch: string;
  inExecution: string;
  completed: string;
  needsAttention: string;
  queueTitle: string;
  detailTitle: string;
  noItems: string;
  approvalId: string;
  operationPlanId: string;
  taskId: string;
  receiptId: string;
  currentStatus: string;
  source: string;
  createdAt: string;
  targetField: string;
  targetDevice: string;
  executionParameters: string;
  flow: string[];
  fromRecommendation: string;
  manual: string;
  approve: string;
  dispatch: string;
  viewProgress: string;
  retry: string;
  details: string;
  initiator: string;
  operationTemplate: string;
  createdStatus: string;
  debugTitle: string;
  fullIds: string;
  rawStatus: string;
};

export const OP_LABELS: Record<OpsLang, OperationLabels> = {
  zh: {
    pageTitle: "作业控制台",
    pageDesc: "集中处理审批、派发、执行与回执，作为作业运营主工作台。",
    refresh: "刷新数据",
    auditExport: "查看审计与导出",
    createOperation: "新建作业",
    pendingApproval: "待审批",
    readyToDispatch: "待派发",
    inExecution: "执行中",
    completed: "已完成",
    needsAttention: "失败待处理",
    queueTitle: "待处理工作",
    detailTitle: "详情面板",
    noItems: "暂无可处理项。",
    approvalId: "审批单号",
    operationPlanId: "作业计划编号",
    taskId: "作业任务编号",
    receiptId: "执行回执编号",
    currentStatus: "当前状态",
    source: "来源",
    createdAt: "创建时间",
    targetField: "目标地块",
    targetDevice: "目标设备",
    executionParameters: "执行参数",
    flow: ["建议", "审批", "作业计划", "作业执行", "执行回执"],
    fromRecommendation: "来自农业建议",
    manual: "人工创建",
    approve: "审批",
    dispatch: "派发",
    viewProgress: "查看进度",
    retry: "重试",
    details: "查看详情",
    initiator: "发起方式",
    operationTemplate: "作业模板",
    createdStatus: "已创建",
    debugTitle: "开发调试信息（原始字段）",
    fullIds: "完整 ID",
    rawStatus: "原始状态",
  },
  en: {
    pageTitle: "Operations Console",
    pageDesc: "Manage approvals, dispatch, execution, and receipts in one control workspace.",
    refresh: "Refresh",
    auditExport: "Audit & Export",
    createOperation: "Create Operation",
    pendingApproval: "Pending Approval",
    readyToDispatch: "Ready to Dispatch",
    inExecution: "In Execution",
    completed: "Completed",
    needsAttention: "Needs Attention",
    queueTitle: "Work Queue",
    detailTitle: "Detail Panel",
    noItems: "No work items.",
    approvalId: "Approval ID",
    operationPlanId: "Operation Plan ID",
    taskId: "Task ID",
    receiptId: "Receipt ID",
    currentStatus: "Current Status",
    source: "Source",
    createdAt: "Created At",
    targetField: "Target Field",
    targetDevice: "Target Device",
    executionParameters: "Execution Parameters",
    flow: ["Recommendation", "Approval", "Operation Plan", "Task", "Receipt"],
    fromRecommendation: "From Recommendation",
    manual: "Manual",
    approve: "Approve",
    dispatch: "Dispatch",
    viewProgress: "View Progress",
    retry: "Retry",
    details: "Details",
    initiator: "Initiator",
    operationTemplate: "Operation Template",
    createdStatus: "Created",
    debugTitle: "Developer Debug Fields",
    fullIds: "Full IDs",
    rawStatus: "Raw Status",
  },
};

export function getOperationLabels(lang: OpsLang): OperationLabels {
  return OP_LABELS[lang];
}

const ACTION_LABELS: Record<string, { zh: string; en: string }> = {
  IRRIGATE: { zh: "灌溉作业", en: "Irrigation" },
  SPRAY: { zh: "喷洒作业", en: "Spraying" },
  PLOW: { zh: "翻地作业", en: "Plowing" },
  HARROW: { zh: "耙地作业", en: "Harrowing" },
  HARVEST: { zh: "采收作业", en: "Harvest" },
};

export type OperationWorkItem = {
  key: string;
  status: WorkStatus;
  statusLabel: string;
  title: string;
  sourceLabel: string;
  source_kind: DataOriginValue;
  source_type: DataOriginValue;
  data_origin: DataOriginValue;
  createdAt: string;
  field: string;
  device: string;
  actionLabel: string;
  approvalId: string;
  operationPlanId: string;
  taskId: string;
  receiptId: string;
  shortApprovalId: string;
  shortOperationPlanId: string;
  shortTaskId: string;
  shortReceiptId: string;
  parameters: unknown;
  rawStatus: string;
  chainDone: [boolean, boolean, boolean, boolean, boolean];
  raw: any;
};

export function shortId(v: string | null | undefined): string {
  const id = String(v ?? "").trim();
  if (!id) return "-";
  return id.length <= 12 ? id : `${id.slice(0, 6)}...${id.slice(-4)}`;
}

function inferSource(raw: any): { sourceLabel: string; source_kind: DataOriginValue; source_type: DataOriginValue; data_origin: DataOriginValue } {
  const sourceMeta = resolveSourceMeta(
    {
      source_kind: raw?.source_kind,
      source_type: raw?.source_type ?? raw?.source ?? raw?.meta?.source ?? raw?.approval_source,
      data_origin: raw?.data_origin,
    },
    raw?.recommendation_id || raw?.meta?.recommendation_id
      ? { source_kind: "derived_state", source_type: "derived_state", data_origin: "derived_state" }
      : { source_kind: "external_background", source_type: "external_background", data_origin: "external_background" },
  );
  return {
    sourceLabel: formatSourceMeta(sourceMeta),
    source_kind: sourceMeta.source_kind,
    source_type: sourceMeta.source_type,
    data_origin: sourceMeta.data_origin,
  };
}

function normalizeTarget(target: any): { field: string; device: string } {
  const kind = String(target?.kind ?? "").toLowerCase();
  const ref = String(target?.ref ?? target?.field_id ?? target?.id ?? "");
  if (kind.includes("device")) return { field: "-", device: ref || "-" };
  return { field: ref || String(target ?? "-") || "-", device: String(target?.device_id ?? "-") || "-" };
}

function statusFromTask(task: OperationsConsoleMonitoringItem): WorkStatus {
  const state = String(task.state ?? "").toUpperCase();
  const receipt = String(task.latest_receipt_status ?? "").toUpperCase();
  if (task.retry_allowed || state.includes("FAIL") || receipt.includes("FAIL")) return "failed";
  if (task.receipt_fact_id || receipt.includes("OK") || receipt.includes("SUCCESS") || state === "DONE") return "completed";
  if (state === "CREATED" || !task.dispatch_fact_id) return "ready_to_dispatch";
  return "executing";
}

function statusLabel(status: WorkStatus, labels: OperationLabels): string {
  if (status === "pending_approval") return labels.pendingApproval;
  if (status === "ready_to_dispatch") return labels.readyToDispatch;
  if (status === "executing") return labels.inExecution;
  if (status === "completed") return labels.completed;
  return labels.needsAttention;
}

function actionLabel(actionType: string | null | undefined, lang: OpsLang): string {
  const key = String(actionType ?? "").toUpperCase();
  return ACTION_LABELS[key]?.[lang] ?? (key || "-");
}

function opPlanIdFromRaw(raw: any): string {
  return String(raw?.operation_plan_id ?? raw?.plan_id ?? raw?.meta?.operation_plan_id ?? "");
}

export function buildWorkItems(data: OperationsConsoleResponse | null, lang: OpsLang): OperationWorkItem[] {
  if (!data) return [];
  const labels = OP_LABELS[lang];

  const pendingApprovals: OperationWorkItem[] = (data.approvals ?? [])
    .filter((a: OperationsConsoleApprovalDetail) => String(a.status).toUpperCase() === "PENDING")
    .map((a) => {
      const target = normalizeTarget(a.target);
      const approvalId = String(a.request_id ?? "");
      const taskId = String(a.act_task_id ?? "");
      const operationPlanId = opPlanIdFromRaw(a);
      const sourceInfo = inferSource(a);
      return {
        key: `approval:${approvalId}`,
        status: "pending_approval",
        statusLabel: statusLabel("pending_approval", labels),
        title: actionLabel(a.action_type, lang),
        ...sourceInfo,
        createdAt: a.occurred_at || "-",
        field: target.field,
        device: a.device_id || target.device || "-",
        actionLabel: labels.approve,
        approvalId,
        operationPlanId,
        taskId,
        receiptId: "",
        shortApprovalId: shortId(approvalId),
        shortOperationPlanId: shortId(operationPlanId),
        shortTaskId: shortId(taskId),
        shortReceiptId: "-",
        parameters: a.parameter_snapshot,
        rawStatus: String(a.status ?? ""),
        chainDone: [Boolean(a.request_id), Boolean(a.request_id), Boolean(operationPlanId), Boolean(taskId), false],
        raw: a,
      };
    });

  const taskItems: OperationWorkItem[] = (data.monitoring ?? []).map((m: OperationsConsoleMonitoringItem) => {
    const status = statusFromTask(m);
    const target = normalizeTarget(m.target);
    const operationPlanId = opPlanIdFromRaw(m);
    const sourceInfo = inferSource(m);
    return {
      key: `task:${m.act_task_id}`,
      status,
      statusLabel: statusLabel(status, labels),
      title: actionLabel(m.action_type, lang),
      ...sourceInfo,
      createdAt: m.dispatch_occurred_at || m.receipt_occurred_at || "-",
      field: target.field,
      device: m.device_id || target.device || "-",
      actionLabel: status === "ready_to_dispatch" ? labels.dispatch : status === "failed" ? labels.retry : labels.viewProgress,
      approvalId: String((m as any).approval_request_id ?? (m as any).request_id ?? ""),
      operationPlanId,
      taskId: String(m.act_task_id ?? ""),
      receiptId: String(m.receipt_fact_id ?? ""),
      shortApprovalId: shortId((m as any).approval_request_id ?? (m as any).request_id),
      shortOperationPlanId: shortId(operationPlanId),
      shortTaskId: shortId(m.act_task_id),
      shortReceiptId: shortId(m.receipt_fact_id),
      parameters: m.parameters,
      rawStatus: String(m.state ?? ""),
      chainDone: [true, Boolean((m as any).approval_request_id ?? (m as any).request_id), Boolean(operationPlanId), Boolean(m.act_task_id), Boolean(m.receipt_fact_id)],
      raw: m,
    };
  });

  return [...pendingApprovals, ...taskItems].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

export function summarize(items: OperationWorkItem[]): Record<WorkStatus, number> {
  return {
    pending_approval: items.filter((x) => x.status === "pending_approval").length,
    ready_to_dispatch: items.filter((x) => x.status === "ready_to_dispatch").length,
    executing: items.filter((x) => x.status === "executing").length,
    completed: items.filter((x) => x.status === "completed").length,
    failed: items.filter((x) => x.status === "failed").length,
  };
}
