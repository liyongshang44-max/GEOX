// apps/web/src/lib/customerLabels.ts
import {
  customerStatusLabel as mapStatusLabel,
  labelCustomerAcceptanceVerdict,
  labelCustomerApprovalStatus,
  labelCustomerEvidenceStatus,
  labelCustomerOperationFinalStatus,
  labelCustomerRiskStatus,
  labelCustomerRoiStatus,
} from "./customerStatusLabels";

export const CUSTOMER_SHELL_LABELS = {
  brand: "GEOX",
  navDashboard: "总览",
  navFields: "地块",
  navOperations: "作业",
  navReports: "报告",
  navExport: "导出",
  shellRole: "客户门户",
  accountFallback: "客户账户",
  scopePending: "授权范围待确认",
  searchPlaceholder: "搜索功能暂未开放",
  sidebarFooter: "客户可见报告与授权范围",
} as const;

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

const CUSTOMER_TECHNICAL_FIELD_LABELS: Record<string, string> = {
  operation_plan_id: "作业计划编号（技术排障）",
  operation_id: "作业编号（技术排障）",
  recommendation_id: "建议编号（技术排障）",
  prescription_id: "处方编号（技术排障）",
  approval_request_id: "审批请求编号（技术排障）",
  approval_id: "审批编号（技术排障）",
  act_task_id: "任务编号（技术排障）",
  receipt_id: "回执编号（技术排障）",
  acceptance_id: "验收编号（技术排障）",
  roi_id: "价值记录编号（技术排障）",
  memory_id: "田块记忆编号（技术排障）",
  field_memory_id: "田块记忆编号（技术排障）",
  skill_trace_id: "技能追踪编号（技术排障）",
  skill_trace_ref: "技能追踪编号（技术排障）",
  skill_run_id: "技能运行编号（技术排障）",
  skill_output: "技能输出摘要（技术排障）",
  raw_enum: "原始状态码（技术排障）",
  status_enum: "原始状态码（技术排障）",
  stack_trace: "错误堆栈（技术排障）",
  stacktrace: "错误堆栈（技术排障）",
  stack: "错误堆栈（技术排障）",
};

const CUSTOMER_EMPTY_STATE_LABELS: Record<string, string> = {
  ROI_UNAVAILABLE: "暂无可量化价值记录",
  FIELD_MEMORY_UNAVAILABLE: "暂无可展示的田块记忆",
  PRESCRIPTION_MISSING: "未形成正式处方",
  AS_EXECUTED_MISSING: "暂无实际执行记录",
  AS_APPLIED_MISSING: "暂无覆盖记录",
  ACCEPTANCE_PENDING: "待验收",
  WEATHER_UNAVAILABLE: "天气数据暂不可用",
};

const RAW_CODE_LABELS: Record<string, string> = {
  FIELD_MEMORY_WEAK_IRRIGATION_RESPONSE: "灌溉响应弱，建议复核",
  FIELD_MEMORY_EXECUTION_DEVIATION_RISK: "执行偏差风险，建议复核",
  DEVICE_NOT_RESPONDING: "设备未响应，已阻断自动执行",
  NO_DEVICE_ACK: "设备未确认接收",
  TIMEOUT: "设备响应超时",
  MEASURED: "实测值",
  ESTIMATED: "估算值",
  ASSUMPTION_BASED: "基于假设",
};

const OPERATION_TYPE_LABELS: Record<string, string> = {
  IRRIGATE: "灌溉",
  FERTILIZE: "施肥",
  SPRAY: "喷药",
  INSPECT: "巡检",
  PEST_DISEASE_INSPECTION: "病虫害巡检",
  PEST_CONTROL: "病虫害处理",
  HARVEST: "采收",
};

function normalizeKey(raw: unknown): string {
  return String(raw ?? "").trim().replace(/[\s/-]+/g, "_").toUpperCase();
}

function textOrFallback(raw: unknown, fallback = "暂无记录"): string {
  if (raw === null || raw === undefined) return fallback;
  const text = String(raw).trim();
  if (!text) return fallback;
  const lowered = text.toLowerCase();
  if (["--", "nan", "null", "undefined"].includes(lowered)) return fallback;
  return text;
}

export function labelOperationType(raw: unknown): string {
  const key = normalizeKey(raw);
  if (!key) return "作业";
  return OPERATION_TYPE_LABELS[key] ?? mapStatusLabel(raw, "generic", "作业");
}

export function customerStatusLabel(raw: unknown): string {
  return labelCustomerOperationFinalStatus(raw);
}

export function customerRiskLabel(raw: unknown): string {
  return labelRiskLevel(raw);
}

export function customerAcceptanceLabel(raw: unknown): string {
  return labelAcceptanceStatus(raw);
}

export function customerEvidenceLabel(raw: unknown): string {
  return labelCustomerEvidenceStatus(raw);
}

export function customerRoiLabel(raw: unknown): string {
  const key = normalizeKey(raw);
  if (key === "ROI_UNAVAILABLE") return CUSTOMER_EMPTY_STATE_LABELS.ROI_UNAVAILABLE;
  return labelCustomerRoiStatus(raw);
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
  return labelCustomerOperationFinalStatus(raw);
}

export function customerSectionStatusLabel(raw: unknown): string {
  const key = normalizeKey(raw);
  if (CUSTOMER_EMPTY_STATE_LABELS[key]) return CUSTOMER_EMPTY_STATE_LABELS[key];
  return mapStatusLabel(raw, "generic");
}

export function labelCustomerTechnicalField(raw: unknown): string {
  const original = String(raw ?? "").trim();
  if (!original) return "技术字段（技术排障）";
  const key = original.toLowerCase().replace(/[\s-]+/g, "_");
  return CUSTOMER_TECHNICAL_FIELD_LABELS[key] ?? `${original}（技术排障）`;
}

export function sanitizeCustomerText(raw: unknown, fallback = "暂无记录"): string {
  const text = textOrFallback(raw, fallback);
  const mapped = mapStatusLabel(text, "generic", text);
  return mapped || fallback;
}

export function labelRawCode(raw: unknown, fallback = "暂无记录"): string {
  const key = normalizeKey(raw);
  if (!key) return fallback;
  return RAW_CODE_LABELS[key] ?? mapStatusLabel(raw, "generic", String(raw ?? "").trim() || fallback);
}

export function labelMemoryCode(raw: unknown): string {
  const key = normalizeKey(raw);
  if (!key) return "田块记忆待补充";
  if (key.startsWith("FIELD_MEMORY_")) return labelEvidenceQuality(key);
  return labelRawCode(raw, labelEmptyFallback(raw, "田块记忆待补充"));
}

export function labelValueType(raw: unknown): string {
  const key = normalizeKey(raw);
  if (["MEASURED", "ACTUAL", "OBSERVED"].includes(key)) return "实测值";
  if (["ESTIMATED", "PREDICTED", "MODELLED"].includes(key)) return "估算值";
  if (["ASSUMPTION_BASED", "ASSUMPTION", "HEURISTIC"].includes(key)) return "基于假设";
  return labelRawCode(raw, "估算值");
}

export function labelEmptyFallback(raw: unknown, fallback = "暂无记录"): string {
  return textOrFallback(raw, fallback);
}

export function labelBooleanYesNo(raw: unknown): string {
  return raw ? "是" : "否";
}

export function labelRiskLevel(raw: unknown): string {
  return labelCustomerRiskStatus(raw);
}

export function labelFinalStatus(raw: unknown): string {
  return labelCustomerOperationFinalStatus(raw);
}

export function labelEvidenceQuality(raw: unknown): string {
  return labelCustomerEvidenceStatus(raw);
}

export function labelConfidenceHint(raw: unknown): string {
  const key = normalizeKey(raw);
  if (key === "HIGH") return "可信度高";
  if (key === "MEDIUM") return "可信度中";
  if (key === "LOW") return "可信度低";
  return textOrFallback(raw, "可信度未标注");
}

export function labelAcceptanceStatus(raw: unknown): string {
  return labelCustomerAcceptanceVerdict(raw);
}

export function labelApprovalStatus(raw: unknown): string {
  return labelCustomerApprovalStatus(raw);
}
