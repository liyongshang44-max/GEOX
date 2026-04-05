export const STATUS_WORDS = [
  "待处理",
  "待执行",
  "执行中",
  "待验收",
  "已完成",
  "执行无效",
  "存在风险",
  "数据不足",
  "未初始化",
  "在线",
  "离线",
] as const;

export type StatusWord = (typeof STATUS_WORDS)[number];

export function normalizeStatusWord(raw: unknown): StatusWord {
  const code = String(raw ?? "").trim().toUpperCase();
  if (!code) return "待处理";
  if (["ONLINE", "CONNECTED"].includes(code)) return "在线";
  if (["OFFLINE", "DISCONNECTED"].includes(code)) return "离线";
  if (["PENDING", "TODO", "NEW"].includes(code)) return "待处理";
  if (["READY"].includes(code)) return "待执行";
  if (["RUNNING", "IN_PROGRESS", "ACKED", "DISPATCHED"].includes(code)) return "执行中";
  if (["PENDING_ACCEPTANCE"].includes(code)) return "待验收";
  if (["SUCCESS", "SUCCEEDED", "DONE", "COMPLETED"].includes(code)) return "已完成";
  if (["INVALID_EXECUTION"].includes(code)) return "执行无效";
  if (["RISK", "FAILED", "ERROR", "FAIL"].includes(code)) return "存在风险";
  if (["NO_DATA", "MISSING", "UNKNOWN"].includes(code)) return "数据不足";
  if (["UNINITIALIZED", "INIT_REQUIRED"].includes(code)) return "未初始化";
  return "待处理";
}
