export type CustomerStatusDomain =
  | "operation_final_status"
  | "acceptance_verdict"
  | "evidence_status"
  | "roi_status"
  | "crop_context_status"
  | "observability_status"
  | "approval_status"
  | "dispatch_status"
  | "receipt_status"
  | "chain_integrity"
  | "risk_status"
  | "generic";

const REVIEW_REQUIRED = "需复核";
const RECORD_AVAILABLE = "已有记录，需复核";

const GENERIC_STATUS_LABELS: Record<string, string> = {
  COMPLETE: "完整",
  COMPLETED: REVIEW_REQUIRED,
  DONE: REVIEW_REQUIRED,
  SUCCESS: REVIEW_REQUIRED,
  SUCCEEDED: REVIEW_REQUIRED,
  VALID: REVIEW_REQUIRED,
  PASS: REVIEW_REQUIRED,
  PASSED: REVIEW_REQUIRED,
  APPROVED: RECORD_AVAILABLE,
  FAIL: "未通过",
  FAILED: "未通过",
  PENDING: "待处理",
  PENDING_ACCEPTANCE: "待验收",
  UNKNOWN: "未确认",
  USER_DECLARED: "人工声明",
  OBSERVED: "已接入观测",
  PARTIALLY_OBSERVED: "部分接入观测",
  UNOBSERVED: "尚未接入观测",
  HIGH: "高风险",
  MEDIUM: "中风险",
  LOW: "低风险",
  IRRIGATE: "灌溉",
  BASELINE_MISSING: "缺少收益基线",
  HYPOTHESIS_ONLY: "仅形成价值假设",
  PROJECTED: "已有投入产出预测，待结果验证",
  INTERIM_SUPPORTED: "阶段证据支持，不作为正式收益",
  INTERIM_NOT_SUPPORTED: "阶段证据不支持",
  PLANTED_CONFIRMED: "种植记录已接入，需复核",
  PLANTED_UNCONFIRMED: "已种植待确认",
  PRE_PLANT: "播种前",
};

const DOMAIN_STATUS_LABELS: Record<CustomerStatusDomain, Record<string, string>> = {
  generic: GENERIC_STATUS_LABELS,
  operation_final_status: {
    SUCCESS: REVIEW_REQUIRED,
    SUCCEEDED: REVIEW_REQUIRED,
    COMPLETE: REVIEW_REQUIRED,
    COMPLETED: REVIEW_REQUIRED,
    DONE: REVIEW_REQUIRED,
    VALID: REVIEW_REQUIRED,
    PASS: REVIEW_REQUIRED,
    PASSED: REVIEW_REQUIRED,
    PENDING_ACCEPTANCE: "待验收",
    WAIT_ACCEPTANCE: "待验收",
    RUNNING: "执行中",
    IN_PROGRESS: "执行中",
    PROCESSING: "执行中",
    INVALID_EXECUTION: "执行异常",
    ERROR: "执行异常",
    FAIL: "执行异常",
    FAILED: "执行异常",
    UNKNOWN: "未确认",
  },
  acceptance_verdict: {
    PASS: REVIEW_REQUIRED,
    PASSED: REVIEW_REQUIRED,
    SUCCESS: REVIEW_REQUIRED,
    SUCCEEDED: REVIEW_REQUIRED,
    VALID: REVIEW_REQUIRED,
    APPROVED: RECORD_AVAILABLE,
    FAIL: "未通过",
    FAILED: "未通过",
    REJECTED: "未通过",
    PENDING: "待验收",
    PENDING_ACCEPTANCE: "待验收",
    WAITING: "待验收",
    UNKNOWN: "未确认",
  },
  evidence_status: {
    COMPLETE: "证据记录完整性待复核",
    COMPLETED: "证据记录完整性待复核",
    AVAILABLE: "已记录",
    PACK_SUMMARY: "证据包已形成",
    RECORDS_WITHOUT_SUMMARY: "证据已记录",
    MISSING: "暂无记录",
    NO_EVIDENCE: "暂无证据",
    EVIDENCE_MISSING: "证据不足",
    INSUFFICIENT_EVIDENCE: "证据不足",
    UNKNOWN: "未确认",
  },
  roi_status: {
    BASELINE_MISSING: "缺少收益基线",
    HYPOTHESIS_ONLY: "仅形成价值假设",
    PROJECTED: "已有投入产出预测，待结果验证",
    EXECUTED_PENDING_RESPONSE: "已执行，等待响应证据",
    INTERIM_SUPPORTED: "阶段证据支持，不作为正式收益",
    INTERIM_NOT_SUPPORTED: "阶段证据不支持",
    EXCLUDED_WEATHER: "受天气干扰，不进入效果学习",
    REALIZED: "已有结果记录，需正式价值门禁确认",
    UNKNOWN: "未确认",
  },
  crop_context_status: {
    PLANTED_CONFIRMED: "种植记录已接入，需复核",
    PLANTED_UNCONFIRMED: "已种植待确认",
    PRE_PLANT: "播种前",
    FALLOW: "休耕",
    AVAILABLE: "已接入，需复核",
    UNKNOWN: "未确认",
  },
  observability_status: {
    OBSERVED: "已接入观测",
    PARTIALLY_OBSERVED: "部分接入观测",
    UNOBSERVED: "尚未接入观测",
    AVAILABLE: "已接入观测",
    UNAVAILABLE: "尚未接入观测",
    UNKNOWN: "未确认",
  },
  approval_status: {
    APPROVED: "审批记录已接入，需复核",
    PASS: "审批记录已接入，需复核",
    PASSED: "审批记录已接入，需复核",
    SUCCESS: "审批记录已接入，需复核",
    SUCCEEDED: "审批记录已接入，需复核",
    DONE: "审批记录已接入，需复核",
    VALID: "审批记录已接入，需复核",
    REJECTED: "已拒绝",
    FAIL: "已拒绝",
    FAILED: "已拒绝",
    PENDING: "待审批",
    REQUESTED: "待审批",
    UNKNOWN: "未确认",
  },
  dispatch_status: {
    DISPATCHED: "已派发",
    ACKED: "已确认接收",
    ACCEPTED: "已确认接收",
    QUEUED: "待派发",
    PENDING: "待派发",
    RUNNING: "执行中",
    FAILED: "派发失败",
    UNKNOWN: "未确认",
  },
  receipt_status: {
    RECEIVED: "已收到回执",
    ACKED: "已收到回执",
    COMPLETE: "回执完整性待复核",
    COMPLETED: "回执完整性待复核",
    SUCCESS: "回执记录已接入，需复核",
    PASS: "回执记录已接入，需复核",
    VALID: "回执记录已接入，需复核",
    MISSING: "暂无回执",
    FAILED: "回执异常",
    UNKNOWN: "未确认",
  },
  chain_integrity: {
    COMPLETE: "链路完整性待复核",
    PARTIAL: "不完整",
    LEGACY_OR_MANUAL: "历史/人工链路",
    MISSING: "记录不足",
    UNKNOWN: "未确认",
  },
  risk_status: {
    HIGH: "高风险",
    MEDIUM: "中风险",
    LOW: "低风险",
    UNKNOWN: "未确认",
  },
};

function normalizeStatusKey(value: unknown): string {
  return String(value ?? "").trim().replace(/[\s/-]+/g, "_").toUpperCase();
}

export function customerStatusLabel(value: unknown, domain: CustomerStatusDomain = "generic", fallback = "未确认"): string {
  const key = normalizeStatusKey(value);
  if (!key) return fallback;
  return DOMAIN_STATUS_LABELS[domain]?.[key] ?? GENERIC_STATUS_LABELS[key] ?? fallback;
}

export function labelCustomerOperationFinalStatus(value: unknown): string {
  return customerStatusLabel(value, "operation_final_status");
}

export function labelCustomerAcceptanceVerdict(value: unknown): string {
  return customerStatusLabel(value, "acceptance_verdict");
}

export function labelCustomerEvidenceStatus(value: unknown): string {
  return customerStatusLabel(value, "evidence_status");
}

export function labelCustomerRoiStatus(value: unknown): string {
  return customerStatusLabel(value, "roi_status");
}

export function labelCustomerCropContextStatus(value: unknown): string {
  return customerStatusLabel(value, "crop_context_status");
}

export function labelCustomerObservabilityStatus(value: unknown): string {
  return customerStatusLabel(value, "observability_status");
}

export function labelCustomerApprovalStatus(value: unknown): string {
  return customerStatusLabel(value, "approval_status");
}

export function labelCustomerDispatchStatus(value: unknown): string {
  return customerStatusLabel(value, "dispatch_status");
}

export function labelCustomerReceiptStatus(value: unknown): string {
  return customerStatusLabel(value, "receipt_status");
}

export function labelCustomerChainIntegrity(value: unknown): string {
  return customerStatusLabel(value, "chain_integrity");
}

export function labelCustomerRiskStatus(value: unknown): string {
  return customerStatusLabel(value, "risk_status");
}
