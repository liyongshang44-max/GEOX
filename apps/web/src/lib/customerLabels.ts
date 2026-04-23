export const CUSTOMER_LABELS = {
  dashboardTitle: "客户看板",
  fieldReportTitle: "地块报告",
  operationReportTitle: "作业报告",
  nextAction: "下一步建议",
  pendingActions: "待处理事项",
  evidence: "证据",
  acceptance: "验收",
  recentOperations: "近期作业",
  totalFields: "地块总数",
  riskFields: "风险地块数",
  highRiskFields: "高风险地块数",
  openAlerts: "未关闭告警",
  pendingAcceptance: "待验收",
  estimatedCost: "预计成本",
  actualCost: "实际成本",
  totalDevices: "设备总数",
  onlineDevices: "在线",
  offlineDevices: "离线",
} as const;

function normalizeKey(raw: unknown): string {
  return String(raw ?? "").trim().toUpperCase();
}

export function labelEmptyFallback(raw: unknown, fallback = "--"): string {
  if (raw === null || raw === undefined) return fallback;
  const text = String(raw).trim();
  return text ? text : fallback;
}

export function labelBooleanYesNo(raw: unknown): string {
  return raw ? "是" : "否";
}

export function labelRiskLevel(raw: unknown): string {
  const key = normalizeKey(raw);
  if (key === "HIGH") return "高风险";
  if (key === "MEDIUM") return "中风险";
  if (key === "LOW") return "低风险";
  return "中风险";
}

export function labelFinalStatus(raw: unknown): string {
  const key = normalizeKey(raw);
  if (["SUCCESS", "SUCCEEDED", "DONE", "COMPLETED", "CLOSED"].includes(key)) return "已完成";
  if (["PENDING_ACCEPTANCE", "WAIT_ACCEPTANCE", "TO_ACCEPT"].includes(key)) return "待验收";
  if (["RUNNING", "IN_PROGRESS", "PROCESSING"].includes(key)) return "执行中";
  if (["INVALID_EXECUTION", "ERROR", "FAILED", "FAIL", "REJECTED", "ABNORMAL"].includes(key)) return "执行异常";
  if (["PENDING", "TODO", "NEW", "QUEUED", "UNKNOWN", ""].includes(key)) return "待确认";
  return "待确认";
}

export function labelAcceptanceStatus(raw: unknown): string {
  const key = normalizeKey(raw);
  if (["PASS", "SUCCESS", "SUCCEEDED", "APPROVED"].includes(key)) return "验收通过";
  if (["FAIL", "FAILED", "REJECTED"].includes(key)) return "验收未通过";
  if (["PENDING_ACCEPTANCE", "PENDING", "WAITING", "TODO", "UNKNOWN", ""].includes(key)) return "待验收";
  return "待验收";
}

export function labelApprovalStatus(raw: unknown): string {
  const key = normalizeKey(raw);
  if (["APPROVED", "PASS", "SUCCESS", "SUCCEEDED", "DONE"].includes(key)) return "已完成";
  if (["REJECTED", "FAIL", "FAILED", "ERROR"].includes(key)) return "执行异常";
  return "待确认";
}

// Backward-compatible aliases for existing imports.
export const toRiskLabel = labelRiskLevel;
export const toOperationStatusLabel = labelFinalStatus;
export const toAcceptanceStatusLabel = labelAcceptanceStatus;
