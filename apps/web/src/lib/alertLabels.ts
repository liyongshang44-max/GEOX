import type { AlertStatus } from "../api/alerts";

const CATEGORY_LABELS: Record<string, string> = {
  PENDING_ACCEPTANCE_TIMEOUT: "长时间待验收",
  EVIDENCE_MISSING: "证据缺失",
  INVALID_EXECUTION: "执行无效",
  DEVICE_HEARTBEAT_STALE: "设备离线或无遥测",
  HIGH_RISK_OPERATION: "高风险作业",
};

const STATUS_LABELS: Record<AlertStatus, string> = {
  OPEN: "未处理",
  ACKED: "已确认",
  CLOSED: "已关闭",
};

export function alertCategoryLabel(category: string | null | undefined): string {
  const key = String(category ?? "").trim().toUpperCase();
  if (!key) return "未分类";
  return CATEGORY_LABELS[key] ?? key;
}

export function alertStatusLabel(status: AlertStatus | string | null | undefined): string {
  const key = String(status ?? "").trim().toUpperCase() as AlertStatus;
  return STATUS_LABELS[key] ?? "未知状态";
}
