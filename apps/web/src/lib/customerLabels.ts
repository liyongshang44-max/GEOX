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

const CUSTOMER_STATUS_LABELS: Record<string, string> = {
  PENDING_ACCEPTANCE: "作业已完成，等待验收",
  SUCCESS: "验收通过",
  SUCCEEDED: "验收通过",
  PASS: "验收通过",
  FAILED: "未达到预期效果",
  FAIL: "未达到预期效果",
  INVALID_EXECUTION: "执行无效，需要复核",
  EVIDENCE_MISSING: "证据不足，暂不能验收",
  DEVICE_OFFLINE: "设备离线，暂无法确认执行效果",
  NO_DATA: "暂无可用数据",
};

const CUSTOMER_EMPTY_STATE_LABELS: Record<string, string> = {
  ROI_UNAVAILABLE: "暂无可量化价值记录",
  FIELD_MEMORY_UNAVAILABLE: "暂无可展示的地块记忆",
  PRESCRIPTION_MISSING: "未形成正式处方",
  AS_EXECUTED_MISSING: "暂无实际执行记录",
  AS_APPLIED_MISSING: "暂无覆盖记录",
  ACCEPTANCE_PENDING: "作业已完成，等待验收",
  WEATHER_UNAVAILABLE: "天气数据暂不可用",
};

const RAW_CODE_LABELS: Record<string, string> = {
  FIELD_MEMORY_WEAK_IRRIGATION_RESPONSE: "灌溉响应弱，建议复核",
  FIELD_MEMORY_EXECUTION_DEVIATION_RISK: "执行偏差风险，建议复核",
  INSUFFICIENT_EVIDENCE: "证据不足，需复核",
  PENDING_ACCEPTANCE: "待验收",
  INVALID_EXECUTION: "执行异常，建议复核作业证据",
  MEASURED: "实测值",
  ESTIMATED: "估算值",
  ASSUMPTION_BASED: "基于假设",
  HIGH: "高",
  MEDIUM: "中",
  LOW: "低",
  PASS: "通过",
  FAIL: "未通过",
  SUCCESS: "成功",
  FAILED: "失败",
};


const OPERATION_TYPE_LABELS: Record<string, string> = {
  IRRIGATE: "灌溉",
  FERTILIZE: "施肥",
  PEST_CONTROL: "病虫害处理",
  HARVEST: "采收",
};

const FORBIDDEN_CUSTOMER_CODES = new Set([
  "INVALID_EXECUTION", "PENDING_ACCEPTANCE", "SUCCESS", "FAILED", "PASS", "FAIL", "HIGH", "LOW", "MEDIUM", "IRRIGATE",
]);

export function labelOperationType(raw: unknown): string {
  const key = normalizeKey(raw);
  if (!key) return "作业";
  return OPERATION_TYPE_LABELS[key] ?? labelRawCode(raw, "作业");
}

export function customerStatusLabel(raw: unknown): string {
  const key = normalizeKey(raw);
  if (!key) return "待确认";
  return CUSTOMER_STATUS_LABELS[key] ?? labelFinalStatus(raw);
}

export function customerRiskLabel(raw: unknown): string {
  return labelRiskLevel(raw);
}

export function customerAcceptanceLabel(raw: unknown): string {
  return labelAcceptanceStatus(raw);
}

export function customerEvidenceLabel(raw: unknown): string {
  const key = normalizeKey(raw);
  if (key === "EVIDENCE_MISSING") return "证据不足，暂不能验收";
  return labelEvidenceQuality(raw);
}

export function customerRoiLabel(raw: unknown): string {
  const key = normalizeKey(raw);
  if (key === "ROI_UNAVAILABLE") return CUSTOMER_EMPTY_STATE_LABELS.ROI_UNAVAILABLE;
  return sanitizeCustomerText(raw, "暂无可量化价值记录");
}

export function customerFieldMemoryLabel(raw: unknown): string {
  const key = normalizeKey(raw);
  if (key === "FIELD_MEMORY_UNAVAILABLE") return CUSTOMER_EMPTY_STATE_LABELS.FIELD_MEMORY_UNAVAILABLE;
  return labelMemoryCode(raw);
}

export function customerPrescriptionLabel(raw: unknown): string {
  const key = normalizeKey(raw);
  if (key === "PRESCRIPTION_MISSING") return CUSTOMER_EMPTY_STATE_LABELS.PRESCRIPTION_MISSING;
  return sanitizeCustomerText(raw, "未形成正式处方");
}

export function customerExecutionLabel(raw: unknown): string {
  const key = normalizeKey(raw);
  if (key === "AS_EXECUTED_MISSING") return CUSTOMER_EMPTY_STATE_LABELS.AS_EXECUTED_MISSING;
  if (key === "AS_APPLIED_MISSING") return CUSTOMER_EMPTY_STATE_LABELS.AS_APPLIED_MISSING;
  return customerStatusLabel(raw);
}

export function customerSectionStatusLabel(raw: unknown): string {
  const key = normalizeKey(raw);
  if (CUSTOMER_EMPTY_STATE_LABELS[key]) return CUSTOMER_EMPTY_STATE_LABELS[key];
  return customerStatusLabel(raw);
}

function textOrFallback(raw: unknown, fallback = "--"): string {
  if (raw === null || raw === undefined) return fallback;
  const text = String(raw).trim();
  return text || fallback;
}

export function sanitizeCustomerText(raw: unknown, fallback = "--"): string {
  const text = textOrFallback(raw, fallback);
  const key = normalizeKey(text);
  if (FORBIDDEN_CUSTOMER_CODES.has(key)) {
    if (key === "INVALID_EXECUTION") return "执行异常，建议复核作业证据";
    if (["PASS", "SUCCESS"].includes(key)) return "验收通过";
    if (["FAIL", "FAILED"].includes(key)) return "验收未通过";
    if (key === "PENDING_ACCEPTANCE") return "等待验收";
    if (key === "HIGH") return "高风险";
    if (key === "MEDIUM") return "中风险";
    if (key === "LOW") return "低风险";
    if (key === "IRRIGATE") return "灌溉";
  }
  return text.replace(/\bIRRIGATE\b/gi, "灌溉");
}

function normalizeKey(raw: unknown): string {
  return String(raw ?? "").trim().toUpperCase();
}

export function labelRawCode(raw: unknown, fallback = "--"): string {
  const key = normalizeKey(raw);
  if (!key) return fallback;
  return RAW_CODE_LABELS[key] ?? (String(raw).trim() || fallback);
}

export function labelMemoryCode(raw: unknown): string {
  const key = normalizeKey(raw);
  if (!key) return "地块记忆待补充";
  if (key.startsWith("FIELD_MEMORY_")) return labelEvidenceQuality(key);
  return labelRawCode(raw, labelEmptyFallback(raw, "地块记忆待补充"));
}

export function labelValueType(raw: unknown): string {
  const key = normalizeKey(raw);
  if (["MEASURED", "ACTUAL", "OBSERVED"].includes(key)) return "实测值";
  if (["ESTIMATED", "PREDICTED", "MODELLED"].includes(key)) return "估算值";
  if (["ASSUMPTION_BASED", "ASSUMPTION", "HEURISTIC"].includes(key)) return "基于假设";
  return labelRawCode(raw, "估算值");
}

export function labelEmptyFallback(raw: unknown, fallback = "--"): string {
  return textOrFallback(raw, fallback);
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
  if (["PENDING_ACCEPTANCE", "WAIT_ACCEPTANCE", "TO_ACCEPT"].includes(key)) return "等待验收";
  if (["RUNNING", "IN_PROGRESS", "PROCESSING"].includes(key)) return "执行中";
  if (["INVALID_EXECUTION", "ERROR", "FAILED", "FAIL", "REJECTED", "ABNORMAL"].includes(key)) return "执行异常";
  if (["PENDING", "TODO", "NEW", "QUEUED", "UNKNOWN", ""].includes(key)) return "待确认";
  return "待确认";
}

export function labelEvidenceQuality(raw: unknown): string {
  const key = normalizeKey(raw);
  if (key === "INSUFFICIENT_EVIDENCE") return "证据不足，需复核";
  if (["FIELD_MEMORY_WEAK_IRRIGATION_RESPONSE", "WEAK_IRRIGATION_RESPONSE"].includes(key)) return "灌溉响应弱，建议复核";
  if (["FIELD_MEMORY_EXECUTION_DEVIATION_RISK", "EXECUTION_DEVIATION_RISK"].includes(key)) return "执行偏差风险，建议复核";
  if (["DEVICE_NOT_RESPONDING", "NO_DEVICE_ACK", "TIMEOUT"].includes(key)) return "设备未响应，已阻断自动执行";
  return textOrFallback(raw, "证据充分");
}

export function labelConfidenceHint(raw: unknown): string {
  const score = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(score)) return "收益为估算值，可信度有限";
  if (score < 0.6) return "收益为估算值，可信度有限";
  return "可信度较高";
}

export function labelAcceptanceStatus(raw: unknown): string {
  const key = normalizeKey(raw);
  if (["PASS", "SUCCESS", "SUCCEEDED", "APPROVED"].includes(key)) return "验收通过";
  if (["FAIL", "FAILED", "REJECTED"].includes(key)) return "验收未通过";
  if (["PENDING_ACCEPTANCE", "PENDING", "WAITING", "TODO", "UNKNOWN", ""].includes(key)) return "等待验收";
  return "等待验收";
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


export function customerTimelineStatusLabel(raw: unknown): string {
  switch (String(raw ?? "").toUpperCase()) {
    case "DONE":
    case "AVAILABLE":
      return "已形成";
    case "PENDING":
      return "等待生成";
    case "MISSING":
      return "暂无记录";
    case "NOT_APPLICABLE":
      return "不适用";
    default:
      return "待确认";
  }
}
