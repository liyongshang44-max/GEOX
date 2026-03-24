export type BadgeStatus = "success" | "warning" | "failed" | "pending";

export type ProgramActionMode = "AUTO" | "APPROVAL_REQUIRED" | "BLOCKED" | "PENDING";

export type ProgramActionExpectation = {
  label: "下一次评估时间" | "触发条件";
  value: string;
};

export type ProgramDetailAction = {
  type: string;
  mode: ProgramActionMode;
  reason: string;
  expectedEffect: string;
  expectation: ProgramActionExpectation;
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
  noActionExpectation: ProgramActionExpectation;
  timeline: ProgramDetailTimelineItem[];
  metrics: ProgramDetailMetric[];
};

export function missingDataExplanation(subject: string, followUp: string): string {
  return `当前缺少${subject}，暂无法判断，${followUp}。`;
}

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

function buildExpectation(item: any): ProgramActionExpectation {
  const nextEvaluateAt = safeText(item?.next_action_hint?.next_evaluate_at ?? item?.next_evaluation_at, "");
  if (nextEvaluateAt) {
    return {
      label: "下一次评估时间",
      value: shortDate(nextEvaluateAt, missingDataExplanation("轨迹数据", "下一轮采集后重新评估")),
    };
  }

  const triggerCondition = safeText(item?.next_action_hint?.trigger_condition, "");
  if (triggerCondition) {
    return {
      label: "触发条件",
      value: triggerCondition,
    };
  }

  return {
    label: "触发条件",
    value: missingDataExplanation("设备回执", "收到设备回执后更新状态"),
  };
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

  const subtitleFallback = missingDataExplanation("土壤湿度数据", "下一轮采集后重新评估");
  const titleId = decodeURIComponent(programId || "");
  const actionMode = toMode(item?.next_action_hint?.mode ?? item?.next_action_hint?.decision_mode);
  const expectation = buildExpectation(item);

  const missingRiskReason = missingDataExplanation("最近执行结果", "当前作业完成后重新计算建议");
  const primaryAction: ProgramDetailAction = {
    type: toActionType(item?.next_action_hint?.kind),
    mode: actionMode,
    reason: safeText(item?.current_risk_summary?.reason ?? item?.latest_acceptance_result?.summary, missingRiskReason),
    expectedEffect: safeText(item?.next_action_hint?.expected_effect, "执行后预计降低当前风险，并提高任务执行稳定性。"),
    expectation,
  };

  const inFieldRatio = asNumber(item?.latest_acceptance_result?.metrics?.in_field_ratio);
  const efficiencyIndex = asNumber(efficiency?.efficiency_index ?? item?.execution_reliability);
  const costTotal = asNumber(cost?.total_cost);

  return {
    header: {
      title: titleId || safeText(item?.program_id, "Program"),
      subtitle: `${safeText(item?.crop_code, subtitleFallback)} · ${safeText(item?.field_id, subtitleFallback)} · ${safeText(item?.status, subtitleFallback)}`,
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
    actions: primaryAction.reason === missingRiskReason ? [] : [primaryAction],
    noActionExpectation: expectation,
    timeline: [
      {
        kind: "推荐生成",
        status: safeText(item?.latest_recommendation?.status ?? item?.status, subtitleFallback),
        occurredAt: shortDate(item?.latest_recommendation?.occurred_at ?? item?.updated_at, subtitleFallback),
        summary: safeText(item?.latest_recommendation?.summary, "系统已给出下一步动作建议"),
      },
      {
        kind: "执行反馈",
        status: safeText(item?.latest_evidence?.status, missingDataExplanation("设备回执", "收到设备回执后更新状态")),
        occurredAt: shortDate(item?.latest_evidence?.occurred_at ?? item?.updated_at, subtitleFallback),
        summary: safeText(item?.latest_acceptance_result?.summary, "等待最新执行结果回传"),
      },
      {
        kind: "验收结论",
        status: safeText(item?.latest_acceptance_result?.verdict, subtitleFallback),
        occurredAt: shortDate(item?.latest_acceptance_result?.occurred_at ?? item?.updated_at, subtitleFallback),
        summary: safeText(item?.latest_acceptance_result?.summary, missingDataExplanation("最近执行结果", "当前作业完成后重新计算建议")),
      },
    ],
    metrics: [
      { label: "累计成本", value: costTotal == null ? missingDataExplanation("轨迹数据", "当前作业完成后重新计算建议") : `${costTotal.toFixed(2)}` },
      { label: "SLA", value: safeText(sla?.latest_status, missingDataExplanation("设备回执", "收到设备回执后更新状态")) },
      { label: "执行稳定度", value: efficiencyIndex == null ? missingDataExplanation("土壤湿度数据", "下一轮采集后重新评估") : efficiencyIndex.toFixed(3) },
      { label: "在田覆盖率", value: inFieldRatio == null ? missingDataExplanation("轨迹数据", "当前作业完成后重新计算建议") : `${(inFieldRatio * 100).toFixed(1)}%` },
      { label: "轨迹任务数", value: trajectories.length > 0 ? String(trajectories.length) : "0" },
    ],
  };
}
