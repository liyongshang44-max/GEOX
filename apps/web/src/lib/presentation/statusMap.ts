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

const DEFAULT_PENDING = { label: "待处理", tone: "warning" as const };
const DEFAULT_UNKNOWN = { label: "状态未知", tone: "neutral" as const };

export function mapRecommendationStatus(raw: string | null | undefined): StatusPresentation {
  return build(String(raw), {
    PROPOSED: { label: "已提出建议", tone: "info" },
    PENDING: { label: "待处理", tone: "warning" },
    ACTIVE: { label: "运行中", tone: "success" },
    BLOCKED: { label: "已阻塞", tone: "danger" },
  }, DEFAULT_UNKNOWN);
}

export function mapApprovalStatus(raw: string | null | undefined): StatusPresentation {
  return build(String(raw), {
    APPROVE: { label: "审批通过", tone: "success" },
    APPROVED: { label: "已批准", tone: "success" },
    PENDING: { label: "审批中", tone: "warning" },
    REJECTED: { label: "审批拒绝", tone: "danger" },
  }, DEFAULT_PENDING);
}

export function mapOperationPlanStatus(raw: string | null | undefined): StatusPresentation {
  return build(String(raw), {
    READY: { label: "待执行", tone: "warning" },
    DISPATCHED: { label: "已下发", tone: "info" },
    ACTIVE: { label: "运行中", tone: "success" },
    BLOCKED: { label: "已阻塞", tone: "danger" },
    NOT_EXECUTED: { label: "未执行", tone: "neutral" },
  }, DEFAULT_UNKNOWN);
}

export function mapTaskStatus(raw: string | null | undefined): StatusPresentation {
  return build(String(raw), {
    READY: { label: "待执行", tone: "warning" },
    DISPATCHED: { label: "已下发", tone: "info" },
    ACKED: { label: "已确认", tone: "info" },
    SUCCEEDED: { label: "执行成功", tone: "success" },
    SUCCESS: { label: "执行成功", tone: "success" },
    EXECUTED: { label: "已执行", tone: "success" },
    FAILED: { label: "执行失败", tone: "danger" },
    NOT_EXECUTED: { label: "未执行", tone: "neutral" },
  }, DEFAULT_UNKNOWN);
}

export function mapReceiptStatus(raw: string | null | undefined): StatusPresentation {
  return build(String(raw), {
    ACKED: { label: "已回执", tone: "success" },
    SUCCEEDED: { label: "执行成功", tone: "success" },
    SUCCESS: { label: "执行成功", tone: "success" },
    EXECUTED: { label: "已执行", tone: "success" },
    FAILED: { label: "执行失败", tone: "danger" },
    PENDING: { label: "待回执", tone: "warning" },
  }, DEFAULT_PENDING);
}

export function mapEvidenceStatus(raw: string | null | undefined): StatusPresentation {
  return build(String(raw), {
    DONE: { label: "证据已生成", tone: "success" },
    AVAILABLE: { label: "证据可用", tone: "success" },
    RUNNING: { label: "证据生成中", tone: "info" },
    PENDING: { label: "证据待生成", tone: "warning" },
    FAILED: { label: "证据生成失败", tone: "danger" },
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
