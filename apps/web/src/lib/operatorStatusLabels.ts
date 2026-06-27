export type OperatorStatusDomain =
  | "action"
  | "approval"
  | "dispatch"
  | "acceptance"
  | "evidence"
  | "roi"
  | "device"
  | "offline_handling"
  | "generic";

const STATUS_LABELS: Record<string, string> = {
  IRRIGATION: "灌溉任务",
  IRRIGATE: "灌溉",
  PENDING: "待处理",
  PENDING_ACCEPTANCE: "待验收",
  PASS: "验收通过",
  PASSED: "验收通过",
  FAIL: "验收未通过",
  FAILED: "验收未通过",
  COMPLETE: "完整",
  COMPLETED: "已完成",
  ACKED: "已接单",
  DISPATCHED: "已派发",
  EXECUTED: "已执行",
  BASELINE_MISSING: "缺少收益基线",
  SELF_APPROVAL_BLOCKED: "自审批风险，动作已阻断",
  APPROVED: "已通过",
  REJECTED: "已拒绝",
  RETURNED: "已退回",
  RUNNING: "进行中",
  DONE: "已完成",
  RECEIPT_RECEIVED: "已收到执行回执",
  RECEIPT_PENDING: "执行回执待收",
  DISPATCH_PENDING: "待派发",
  TASK_CREATED: "已生成执行任务",
  RETRY_DISPATCHED: "已重新派发",
  EXECUTION_FAILED: "执行失败",
  EVIDENCE_INSUFFICIENT: "证据不足",
  REVIEW_REQUIRED: "需要复核",
};

const OFFLINE_HANDLING_LABELS: Record<string, string> = {
  OPEN: "待处理",
  ACKED: "已确认离线",
  FOLLOWUP_REQUIRED: "需人工核查",
  TASK_CANDIDATE_CREATED: "已生成维护任务候选",
  CLOSED: "已关闭",
  READ_ONLY: "只读",
};

const TERM_LABELS: Record<string, string> = {
  "AO-ACT task": "正式任务",
  "AO-ACT Task": "正式任务",
  "ao-act task": "正式任务",
  "AO-ACT": "正式任务链路",
  Dispatch: "派发",
  dispatch: "派发",
  ACK: "接单确认",
  Ack: "接单确认",
  ack: "接单确认",
  Receipt: "执行回执",
  receipt: "执行回执",
  telemetry: "遥测",
  Telemetry: "遥测",
  retry: "重试",
  Retry: "重试",
  manifest: "证据清单",
  Manifest: "证据清单",
  "sha256 checksum": "文件校验值",
  "SHA256 checksum": "文件校验值",
  sha256: "文件校验值",
  SHA256: "文件校验值",
  checksum: "文件校验值",
  Checksum: "文件校验值",
  operation_state: "作业状态",
  OperationState: "作业状态",
  "report API": "正式报告数据",
  "operation report": "作业报告",
  "as-applied": "实际覆盖记录",
  "permission.allowed": "会话权限结果",
  "operator_evidence_export": "证据导出权限",
  "job detail": "任务详情",
  ROI: "价值记录",
  "Field Memory": "田块记忆",
  "Skill / Rule Performance": "技能表现",
};

function normalizeStatus(value: unknown): string {
  return String(value ?? "").trim().replace(/[\s/-]+/g, "_").toUpperCase();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function labelOperatorOfflineHandlingStatus(value: unknown, fallback = "处理状态待确认"): string {
  const key = normalizeStatus(value);
  if (!key) return fallback;
  return OFFLINE_HANDLING_LABELS[key] ?? fallback;
}

export function labelOperatorStatus(value: unknown, fallback = "状态待确认"): string {
  const key = normalizeStatus(value);
  if (!key) return fallback;
  return STATUS_LABELS[key] ?? OFFLINE_HANDLING_LABELS[key] ?? fallback;
}

export function mapOperatorStatusLabel(value: unknown, domain: OperatorStatusDomain = "generic", fallback?: string): string {
  const key = normalizeStatus(value);
  if (!key) return fallback ?? "状态待确认";
  if (domain === "offline_handling") return OFFLINE_HANDLING_LABELS[key] ?? fallback ?? "处理状态待确认";
  const mapped = STATUS_LABELS[key] ?? OFFLINE_HANDLING_LABELS[key];
  if (mapped) return mapped;
  if (domain === "action") return replaceOperatorTerms(String(value ?? ""), fallback ?? "动作待确认");
  if (domain === "roi") return fallback ?? "价值状态待确认";
  if (domain === "device") return fallback ?? "设备状态待确认";
  if (domain === "evidence") return fallback ?? "证据状态待确认";
  if (domain === "acceptance") return fallback ?? "验收状态待确认";
  if (domain === "dispatch") return fallback ?? "派发状态待确认";
  if (domain === "approval") return fallback ?? "审批状态待确认";
  return fallback ?? "状态待确认";
}

export function labelOperatorAction(value: unknown, fallback = "动作待确认"): string {
  return mapOperatorStatusLabel(value, "action", fallback);
}

export function labelOperatorTerm(value: unknown, fallback = ""): string {
  const raw = String(value ?? "").trim();
  if (!raw) return fallback;
  return TERM_LABELS[raw] ?? replaceOperatorTerms(raw, fallback || raw);
}

export function replaceOperatorTerms(value: unknown, fallback = ""): string {
  const raw = String(value ?? "").trim();
  if (!raw) return fallback;
  const exactStatus = STATUS_LABELS[normalizeStatus(raw)] ?? OFFLINE_HANDLING_LABELS[normalizeStatus(raw)];
  if (exactStatus) return exactStatus;

  let next = raw;
  const orderedTerms = Object.keys(TERM_LABELS).sort((a, b) => b.length - a.length);
  for (const term of orderedTerms) {
    next = next.replace(new RegExp(escapeRegExp(term), "g"), TERM_LABELS[term]);
  }

  next = next
    .replace(/\bck_[A-Za-z0-9_-]+\b/g, "人员账号已隐藏")
    .replace(/\btok_[A-Za-z0-9_-]+\b/g, "人员账号已隐藏")
    .replace(/\bdev_[A-Za-z0-9_-]+\b/g, "设备编号已隐藏")
    .replace(/\bfield_[A-Za-z0-9_-]+\b/g, "地块编号已隐藏")
    .replace(/\bop_plan_[A-Za-z0-9_-]+\b/g, "作业编号已隐藏");

  const orderedOfflineStatuses = Object.keys(OFFLINE_HANDLING_LABELS).sort((a, b) => b.length - a.length);
  for (const status of orderedOfflineStatuses) {
    next = next.replace(new RegExp(`\\b${escapeRegExp(status)}\\b`, "g"), OFFLINE_HANDLING_LABELS[status]);
  }
  const orderedStatuses = Object.keys(STATUS_LABELS).sort((a, b) => b.length - a.length);
  for (const status of orderedStatuses) {
    next = next.replace(new RegExp(`\\b${escapeRegExp(status)}\\b`, "g"), STATUS_LABELS[status]);
  }
  return next;
}

export function isRawOperatorStatus(value: unknown): boolean {
  const key = normalizeStatus(value);
  return Boolean(key && (STATUS_LABELS[key] || OFFLINE_HANDLING_LABELS[key]));
}
