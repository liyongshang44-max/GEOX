export const CUSTOMER_WORDS = {
  operation: "作业",
  acceptance: "验收",
  risk: "风险",
  nextAction: "下一步建议",
  evidence: "证据",
  pendingActions: "待处理事项",
  highRiskFields: "高风险地块数",
  pendingAcceptance: "待验收",
  done: "已完成",
  passed: "已通过",
  failed: "未通过",
  running: "执行中",
} as const;

function normalizeKey(raw: unknown): string {
  return String(raw ?? "").trim().toUpperCase();
}

export function toRiskLabel(raw: unknown): string {
  const key = normalizeKey(raw);
  if (key === "HIGH") return "高风险";
  if (key === "MEDIUM") return "中风险";
  if (key === "LOW") return "低风险";
  return "风险未知";
}

export function toOperationStatusLabel(raw: unknown): string {
  const key = normalizeKey(raw);
  if (key === "SUCCESS" || key === "SUCCEEDED") return CUSTOMER_WORDS.done;
  if (key === "PASS") return CUSTOMER_WORDS.passed;
  if (key === "FAIL" || key === "FAILED" || key === "ERROR" || key === "INVALID_EXECUTION" || key === "REJECTED") return CUSTOMER_WORDS.failed;
  if (key === "PENDING_ACCEPTANCE") return CUSTOMER_WORDS.pendingAcceptance;
  if (key === "RUNNING" || key === "IN_PROGRESS" || key === "PENDING") return CUSTOMER_WORDS.running;
  return CUSTOMER_WORDS.running;
}

export function toAcceptanceStatusLabel(raw: unknown): string {
  const key = normalizeKey(raw);
  if (key === "PASS" || key === "SUCCESS" || key === "SUCCEEDED") return CUSTOMER_WORDS.passed;
  if (key === "FAIL" || key === "FAILED" || key === "REJECTED") return CUSTOMER_WORDS.failed;
  if (key === "PENDING" || key === "PENDING_ACCEPTANCE" || !key) return CUSTOMER_WORDS.pendingAcceptance;
  return CUSTOMER_WORDS.pendingAcceptance;
}
