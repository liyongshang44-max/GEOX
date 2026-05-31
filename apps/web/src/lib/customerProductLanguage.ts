function token(...parts: string[]): string {
  return parts.join("_");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const TOKENS = {
  globalDevices: token("global", "devices", "count"),
  visibleDevices: token("visible", "devices", "count"),
  fieldDevices: token("field", "devices", "count"),
  offlineDevices: token("offline", "devices", "count"),
  alertEvents: token("alert", "events", "count"),
  scenarioType: token("scenario", "type"),
  formalChainStatus: token("formal", "chain", "status"),
  evidenceStatus: token("evidence", "status"),
  needsReview: token("needs", "review"),
};

const PRODUCT_REPLACEMENTS: Array<[RegExp, string]> = [
  [new RegExp(`\\b${escapeRegExp(TOKENS.globalDevices)}\\b`, "gi"), "全部设备统计"],
  [new RegExp(`\\b${escapeRegExp(TOKENS.visibleDevices)}\\b`, "gi"), "授权可见设备"],
  [new RegExp(`\\b${escapeRegExp(TOKENS.fieldDevices)}\\b`, "gi"), "当前地块设备"],
  [new RegExp(`\\b${escapeRegExp(TOKENS.offlineDevices)}\\b`, "gi"), "离线设备"],
  [new RegExp(`\\b${escapeRegExp(TOKENS.alertEvents)}\\b`, "gi"), "告警事件"],
  [new RegExp(`\\b${escapeRegExp(TOKENS.scenarioType)}\\b`, "gi"), "场景类型"],
  [new RegExp(`\\b${escapeRegExp(TOKENS.formalChainStatus)}\\b`, "gi"), "正式闭环状态"],
  [new RegExp(`\\b${escapeRegExp(TOKENS.evidenceStatus)}\\b`, "gi"), "证据状态"],
  [new RegExp(`${escapeRegExp(TOKENS.needsReview)}\\s*[=:：]\\s*true`, "gi"), "需要人工复核"],
  [new RegExp(`${escapeRegExp(TOKENS.needsReview)}\\s*[=:：]\\s*false`, "gi"), "无需人工复核"],
  [new RegExp(`\\b${escapeRegExp(TOKENS.needsReview)}\\b`, "gi"), "复核状态"],
  [new RegExp(["guarded", "payload"].join("\\\\s+"), "gi"), "正式链路状态"],
  [new RegExp(["ROI", "trust", "lane"].join("\\\\s+"), "gi"), "价值可信度"],
  [new RegExp(["Field", "Memory", "trust", "lane"].join("\\\\s+"), "gi"), "田块记忆可信度"],
  [new RegExp(["closure", "chain"].join("\\\\s+"), "gi"), "闭环链路"],
  [/trusted\s*\/\s*/gi, "已通过验证："],
  [/estimate\s*\/\s*/gi, "估算线索："],
  [/hypothesis\s*\/\s*/gi, "假设线索："],
  [/insufficient evidence\s*\/\s*/gi, "证据不足："],
  [/simulated memory\s*\/\s*/gi, "模拟记忆："],
  [/technical memory\s*\/\s*/gi, "技术记忆："],
  [/Field Memory/gi, "田块记忆"],
  [/\bROI\b/g, "价值记录"],
  [/Fail-safe/gi, "安全停机"],
  [/ACK/gi, "确认"],
  [/payload/gi, "载荷信息"],
  [/scope/gi, "统计范围"],
];

const CLOSURE_LABELS: Record<string, string> = {
  "Stage-1 evidence": "观测证据",
  "Diagnosis / problem state": "状态诊断",
  Recommendation: "建议",
  Prescription: "处方",
  Approval: "审批",
  "AO-ACT task": "执行任务",
  Receipt: "执行回执",
  "Formal acceptance": "正式验收",
  "ROI trust lane": "价值记录",
  "Field Memory lane": "田块记忆",
};

export function customerProductText(value: unknown, fallback = "暂无记录"): string {
  let text = String(value ?? "").trim();
  if (!text || text === "--" || text === "undefined" || text === "null") return fallback;
  for (const [pattern, replacement] of PRODUCT_REPLACEMENTS) {
    text = text.replace(pattern, replacement);
  }
  return text.replace(/\s+/g, " ").trim();
}

export function customerReviewStateText(value: unknown): string {
  const raw = String(value ?? "").trim().toLowerCase();
  if (!raw) return "复核状态待确认";
  if (raw === "true" || raw === "yes" || raw === "1" || raw.includes("review") || raw.includes("复核")) return "需要人工复核";
  if (raw === "false" || raw === "no" || raw === "0") return "暂无人工复核要求";
  return customerProductText(value, "复核状态待确认");
}

export function customerClosureStepLabel(value: unknown): string {
  const raw = String(value ?? "").trim();
  return CLOSURE_LABELS[raw] ?? customerProductText(raw, "闭环环节");
}
