export type BadgeStatus = "success" | "warning" | "failed" | "pending";

export type ProgramActionMode = "AUTO" | "APPROVAL_REQUIRED" | "BLOCKED" | "PENDING";

export type ProgramDetailAction = {
  type: string;
  mode: ProgramActionMode;
  reason: string;
  expectedEffect: string;
};

export type ProgramDetailTimelineItem = {
  kind: string;
  status: string;
  occurredAt: string;
  summary: string;
};

export type ProgramDetailMetric = {
  label: string;
  value: string;
};

export type ProgramDetailViewModel = {
  header: {
    title: string;
    subtitle: string;
    status: BadgeStatus;
  };
  goals: Array<{ label: string; value: string }>;
  constraints: Array<{ label: string; value: string }>;
  actions: ProgramDetailAction[];
  timeline: ProgramDetailTimelineItem[];
  metrics: ProgramDetailMetric[];
};

function safeText(value: unknown, fallback: string): string {
  if (typeof value === "string") {
    const text = value.trim();
    return text || fallback;
  }
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return fallback;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function toBadgeStatus(status: unknown): BadgeStatus {
  const normalized = String(status ?? "").toUpperCase();
  if (["SUCCEEDED", "SUCCESS", "MET", "PASSED", "READY", "STABLE"].includes(normalized)) return "success";
  if (["APPROVAL_REQUIRED", "PENDING", "RUNNING", "ACTIVE", "APPROVAL_REQUESTED"].includes(normalized)) return "warning";
  if (["FAILED", "BREACHED", "BLOCKED", "REJECTED"].includes(normalized)) return "failed";
  return "pending";
}

function toMode(mode: unknown): ProgramActionMode {
  const normalized = String(mode ?? "").toUpperCase();
  if (normalized === "AUTO") return "AUTO";
  if (normalized === "APPROVAL_REQUIRED") return "APPROVAL_REQUIRED";
  if (normalized === "BLOCKED") return "BLOCKED";
  return "PENDING";
}

function toActionType(kind: unknown): string {
  const normalized = String(kind ?? "").toUpperCase();
  if (normalized === "CHECK_DEVICE_PATH_OR_BINDING") return "检查设备路径与绑定";
  if (normalized === "REVIEW_IRRIGATION_PLAN") return "复核灌溉计划";
  if (normalized === "STABLE_EXECUTION" || normalized === "ON_TRACK") return "维持当前执行";
  if (normalized === "DATA_INSUFFICIENT") return "补充关键数据";
  return "系统建议动作";
}

function toHumanMode(mode: ProgramActionMode): string {
  if (mode === "APPROVAL_REQUIRED") return "需人工确认";
  if (mode === "BLOCKED") return "当前不可执行";
  if (mode === "AUTO") return "可自动执行";
  return "待确认";
}

function shortDate(value: unknown, fallback: string): string {
  const text = safeText(value, "");
  if (!text) return fallback;
  const ms = Date.parse(text);
  if (!Number.isFinite(ms)) return text;
  return new Date(ms).toLocaleString();
}

export function buildProgramDetailViewModel(args: {
  programId: string;
  item: any;
  trajectories: any[];
  cost: any;
  sla: any;
  efficiency: any;
  conflicts: string[];
}): ProgramDetailViewModel {
  const { programId, item, trajectories, cost, sla, efficiency, conflicts } = args;

  const fallbackData = "暂无足够数据支持判断";
  const titleId = decodeURIComponent(programId || "");
  const actionMode = toMode(item?.next_action_hint?.mode ?? item?.next_action_hint?.decision_mode);
  const primaryAction: ProgramDetailAction = {
    type: toActionType(item?.next_action_hint?.kind),
    mode: actionMode,
    reason: safeText(item?.current_risk_summary?.reason ?? item?.latest_acceptance_result?.summary, fallbackData),
    expectedEffect: safeText(item?.next_action_hint?.expected_effect, "执行后将降低风险并提升执行稳定性"),
  };

  const inFieldRatio = asNumber(item?.latest_acceptance_result?.metrics?.in_field_ratio);
  const efficiencyIndex = asNumber(efficiency?.efficiency_index ?? item?.execution_reliability);
  const costTotal = asNumber(cost?.total_cost);

  return {
    header: {
      title: titleId || safeText(item?.program_id, "Program"),
      subtitle: `${safeText(item?.crop_code, fallbackData)} · ${safeText(item?.field_id, fallbackData)} · ${safeText(item?.status, fallbackData)}`,
      status: toBadgeStatus(item?.status),
    },
    goals: [
      { label: "节水", value: safeText(item?.intent?.water_saving_target, "保持在目标区间") },
      { label: "稳产", value: safeText(item?.intent?.yield_stability_target, "降低波动") },
      { label: "无农药", value: safeText(item?.intent?.pesticide_free_target, "按约束执行") },
    ],
    constraints: [
      { label: "执行模式", value: toHumanMode(actionMode) },
      { label: "调度冲突", value: conflicts.length > 0 ? conflicts.join("，") : "无" },
    ],
    actions: primaryAction.reason === fallbackData ? [] : [primaryAction],
    timeline: [
      {
        kind: "推荐生成",
        status: safeText(item?.latest_recommendation?.status ?? item?.status, fallbackData),
        occurredAt: shortDate(item?.latest_recommendation?.occurred_at ?? item?.updated_at, fallbackData),
        summary: safeText(item?.latest_recommendation?.summary, "系统已给出下一步动作建议"),
      },
      {
        kind: "执行反馈",
        status: safeText(item?.latest_evidence?.status, fallbackData),
        occurredAt: shortDate(item?.latest_evidence?.occurred_at ?? item?.updated_at, fallbackData),
        summary: safeText(item?.latest_acceptance_result?.summary, "等待最新执行结果回传"),
      },
      {
        kind: "验收结论",
        status: safeText(item?.latest_acceptance_result?.verdict, fallbackData),
        occurredAt: shortDate(item?.latest_acceptance_result?.occurred_at ?? item?.updated_at, fallbackData),
        summary: safeText(item?.latest_acceptance_result?.summary, fallbackData),
      },
    ],
    metrics: [
      { label: "累计成本", value: costTotal == null ? fallbackData : `${costTotal.toFixed(2)}` },
      { label: "SLA", value: safeText(sla?.latest_status, fallbackData) },
      { label: "执行稳定度", value: efficiencyIndex == null ? fallbackData : efficiencyIndex.toFixed(3) },
      { label: "在田覆盖率", value: inFieldRatio == null ? fallbackData : `${(inFieldRatio * 100).toFixed(1)}%` },
      { label: "轨迹任务数", value: trajectories.length > 0 ? String(trajectories.length) : "0" },
    ],
  };
}
