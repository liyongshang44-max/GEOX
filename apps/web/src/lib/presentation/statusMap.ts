export type BadgeTone = "success" | "neutral" | "warning" | "danger";

const STATUS_ZH: Record<string, string> = {
  PROPOSED: "已提出建议",
  PENDING: "待处理",
  APPROVAL_REQUIRED: "待审批",
  APPROVED: "已批准",
  READY: "待执行",
  DISPATCHED: "已下发",
  ACKED: "已确认",
  SUCCEEDED: "执行成功",
  SUCCESS: "执行成功",
  FAILED: "执行失败",
  ERROR: "执行失败",
  NOT_EXECUTED: "未执行",
  ACTIVE: "运行中",
  BLOCKED: "已阻塞",
  RUNNING: "执行中",
  DONE: "已完成",
  COMPLETED: "已完成",
};

export function mapStatusToZh(status: string | null | undefined): string {
  const key = String(status || "").toUpperCase().trim();
  return STATUS_ZH[key] || (status ? `状态：${status}` : "状态未知");
}

export function statusTone(status: string | null | undefined): BadgeTone {
  const key = String(status || "").toUpperCase();
  if (["SUCCEEDED", "SUCCESS", "DONE", "COMPLETED", "APPROVED", "ACTIVE", "ACKED"].includes(key)) return "success";
  if (["FAILED", "ERROR", "BLOCKED"].includes(key)) return "danger";
  if (["PENDING", "READY", "DISPATCHED", "RUNNING", "APPROVAL_REQUIRED", "PROPOSED"].includes(key)) return "warning";
  return "neutral";
}
