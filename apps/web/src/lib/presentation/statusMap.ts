export type BadgeTone = "success" | "warning" | "neutral" | "danger" | "info";

export type StatusPresentation = {
  label: string;
  tone: BadgeTone;
  raw: string;
};

function normalize(raw: string | null | undefined): string {
  return String(raw || "UNKNOWN").toUpperCase().trim();
}

function build(rawStatus: string, mapping: Record<string, Omit<StatusPresentation, "raw">>, fallback: Omit<StatusPresentation, "raw">): StatusPresentation {
  const raw = normalize(rawStatus);
  const hit = mapping[raw] || fallback;
  return { ...hit, raw };
}

const CANONICAL_STATUS = {
  success: { label: "已完成", tone: "success" as const },
  info: { label: "进行中", tone: "info" as const },
  warning: { label: "待处理", tone: "warning" as const },
  danger: { label: "风险", tone: "danger" as const },
};

const DEFAULT_PENDING = CANONICAL_STATUS.warning;
const DEFAULT_UNKNOWN = CANONICAL_STATUS.warning;

export function mapRecommendationStatus(raw: string | null | undefined): StatusPresentation {
  return build(String(raw), {
    PROPOSED: CANONICAL_STATUS.warning,
    PENDING: CANONICAL_STATUS.warning,
    ACTIVE: CANONICAL_STATUS.info,
    BLOCKED: CANONICAL_STATUS.danger,
  }, DEFAULT_UNKNOWN);
}

export function mapApprovalStatus(raw: string | null | undefined): StatusPresentation {
  return build(String(raw), {
    APPROVE: CANONICAL_STATUS.success,
    APPROVED: CANONICAL_STATUS.success,
    PASS: CANONICAL_STATUS.success,
    PENDING: CANONICAL_STATUS.warning,
    REJECTED: CANONICAL_STATUS.danger,
    FAIL: CANONICAL_STATUS.danger,
  }, DEFAULT_PENDING);
}

export function mapOperationPlanStatus(raw: string | null | undefined): StatusPresentation {
  return build(String(raw), {
    READY: CANONICAL_STATUS.warning,
    DISPATCHED: CANONICAL_STATUS.info,
    ACTIVE: CANONICAL_STATUS.info,
    BLOCKED: CANONICAL_STATUS.danger,
    SUCCEEDED: CANONICAL_STATUS.success,
    SUCCESS: CANONICAL_STATUS.success,
    FAILED: CANONICAL_STATUS.danger,
    ERROR: CANONICAL_STATUS.danger,
    NOT_EXECUTED: CANONICAL_STATUS.warning,
  }, DEFAULT_UNKNOWN);
}

export function mapTaskStatus(raw: string | null | undefined): StatusPresentation {
  return build(String(raw), {
    READY: CANONICAL_STATUS.warning,
    CREATED: CANONICAL_STATUS.warning,
    QUEUED: CANONICAL_STATUS.warning,
    DISPATCHED: CANONICAL_STATUS.info,
    ACKED: CANONICAL_STATUS.info,
    RUNNING: CANONICAL_STATUS.info,
    ACTIVE: CANONICAL_STATUS.info,
    SUCCEEDED: CANONICAL_STATUS.success,
    SUCCESS: CANONICAL_STATUS.success,
    EXECUTED: CANONICAL_STATUS.success,
    DONE: CANONICAL_STATUS.success,
    FAILED: CANONICAL_STATUS.danger,
    ERROR: CANONICAL_STATUS.danger,
    BLOCKED: CANONICAL_STATUS.danger,
    NOT_EXECUTED: CANONICAL_STATUS.warning,
  }, DEFAULT_UNKNOWN);
}

export function mapReceiptStatus(raw: string | null | undefined): StatusPresentation {
  return build(String(raw), {
    ACKED: CANONICAL_STATUS.info,
    SUCCEEDED: CANONICAL_STATUS.success,
    SUCCESS: CANONICAL_STATUS.success,
    EXECUTED: CANONICAL_STATUS.success,
    FAILED: CANONICAL_STATUS.danger,
    PENDING: CANONICAL_STATUS.warning,
    NOT_EXECUTED: CANONICAL_STATUS.warning,
  }, DEFAULT_PENDING);
}

export function mapEvidenceStatus(raw: string | null | undefined): StatusPresentation {
  return build(String(raw), {
    DONE: CANONICAL_STATUS.success,
    AVAILABLE: CANONICAL_STATUS.success,
    RUNNING: CANONICAL_STATUS.info,
    PENDING: CANONICAL_STATUS.warning,
    FAILED: CANONICAL_STATUS.danger,
  }, DEFAULT_PENDING);
}

export function mapGenericStatus(raw: string | null | undefined): StatusPresentation {
  const key = normalize(raw);
  if (["PROPOSED", "APPROVED", "PENDING"].includes(key)) return mapApprovalStatus(key);
  if (["READY", "DISPATCHED", "ACKED", "SUCCEEDED", "SUCCESS", "EXECUTED", "FAILED", "NOT_EXECUTED"].includes(key)) return mapTaskStatus(key);
  if (["DONE", "AVAILABLE", "RUNNING"].includes(key)) return mapEvidenceStatus(key);
  if (key === "ACTIVE" || key === "BLOCKED") return mapOperationPlanStatus(key);
  return build(key, {}, DEFAULT_UNKNOWN);
}
