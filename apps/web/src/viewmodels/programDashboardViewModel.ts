import type { ProgramPortfolioItemV1 } from "../lib/api";

export type BadgeTone = "neutral" | "success" | "warning" | "danger";

export type DisplayBadge = {
  text: string;
  tone: BadgeTone;
};

export type MetricBlock = {
  label: string;
  value: string;
  tone?: BadgeTone;
};

export type ProgramListCardVM = {
  title: string;
  subtitle: string;
  statusBadge: DisplayBadge;
  riskBadge: DisplayBadge;
  primaryAction: string;
  pendingPlan: string;
  pendingTask: string;
  metrics: [MetricBlock, MetricBlock, MetricBlock];
  conflictTags: string[];
  href: string;
  seasonId: string;
  sortRiskRank: number;
  sortPriorityRank: number;
  sortCostValue: number | null;
  sortSlaRank: number;
  sortEfficiencyValue: number | null;
};

export type ProgramTimelineEvent = {
  key: string;
  title: string;
  statusText: string;
  idText: string;
  description: string;
};

export type ProgramDetailDashboardVM = {
  header: {
    title: string;
    subtitle: string;
    statusBadge: DisplayBadge;
    riskBadge: DisplayBadge;
    updatedAtText: string;
  };
  currentIssue: {
    riskHeadline: string;
    stageText: string;
    reasonText: string;
  };
  nextActions: Array<{ title: string; value: string; description: string }>;
  outcomeCenter: Array<{ title: string; value: string; description: string }>;
  resourceCenter: Array<{ title: string; value: string; description: string }>;
  mapCenter: {
    title: string;
    description: string;
    metrics: Array<{ title: string; value: string }>;
  };
  timelineCenter: ProgramTimelineEvent[];
};

function safeText(v: unknown, fallback: string): string {
  if (v === null || v === undefined) return fallback;
  const s = String(v).trim();
  return s || fallback;
}

function safeNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function toShortId(v: unknown, fallback: string): string {
  const raw = safeText(v, fallback);
  if (raw === fallback) return fallback;
  if (raw.length <= 14) return raw;
  return `${raw.slice(0, 6)}...${raw.slice(-4)}`;
}

function translateNextAction(kind: unknown, insufficientText: string): string {
  const s = String(kind ?? "").toUpperCase();
  if (!s) return insufficientText;
  if (s === "CHECK_DEVICE_PATH_OR_BINDING") return "检查设备路径或绑定";
  if (s === "REVIEW_IRRIGATION_PLAN") return "复核灌溉计划";
  if (s === "ON_TRACK") return "维持当前执行";
  if (s === "STABLE_EXECUTION") return "执行稳定";
  if (s === "DATA_INSUFFICIENT") return "数据不足";
  return s;
}

function translateSla(status: unknown, insufficientText: string): string {
  const s = String(status ?? "").toUpperCase();
  if (!s) return insufficientText;
  if (s === "MET" || s === "PASSED") return "达标";
  if (s === "BREACHED" || s === "FAILED") return "违约";
  if (s === "UNKNOWN") return "暂无结果";
  return s;
}

function translateDataStatus(status: unknown, insufficientText: string): string {
  const s = String(status ?? "").toUpperCase();
  if (!s) return insufficientText;
  if (s === "INSUFFICIENT_DATA") return "数据不足";
  if (s === "READY") return "可计算";
  if (s === "PENDING") return "待补数";
  return s;
}

function statusBadge(status: unknown, fallback: string): DisplayBadge {
  const s = String(status ?? "").toUpperCase();
  if (s === "SUCCEEDED" || s === "SUCCESS" || s === "MET" || s === "PASSED") return { text: s || fallback, tone: "success" };
  if (s === "FAILED" || s === "BREACHED" || s === "REJECTED") return { text: s || fallback, tone: "danger" };
  if (s === "RUNNING" || s === "PENDING" || s === "APPROVAL_REQUESTED" || s === "ACTIVE") return { text: s || fallback, tone: "warning" };
  return { text: s || fallback, tone: "neutral" };
}

function riskBadge(level: unknown, fallback: string): DisplayBadge {
  const s = String(level ?? "").toUpperCase();
  if (s === "HIGH") return { text: "高风险", tone: "danger" };
  if (s === "MEDIUM") return { text: "中风险", tone: "warning" };
  if (s === "LOW") return { text: "低风险", tone: "success" };
  return { text: "风险：数据不足", tone: "neutral" };
}

export function riskSortRank(v: unknown): number {
  const s = String(v ?? "").toUpperCase();
  if (s === "HIGH") return 0;
  if (s === "MEDIUM") return 1;
  if (s === "LOW") return 2;
  return 3;
}

export function prioritySortRank(v: unknown): number {
  const s = String(v ?? "").toUpperCase();
  if (s === "HIGH") return 0;
  if (s === "MEDIUM") return 1;
  if (s === "LOW") return 2;
  return 3;
}

export function slaSortRank(v: unknown): number {
  const s = String(v ?? "").toUpperCase();
  if (s.includes("BREACH") || s === "FAILED") return 0;
  if (s === "MET" || s === "PASSED") return 2;
  return 3;
}

export function buildProgramListCards(args: {
  items: ProgramPortfolioItemV1[];
  conflictsByProgram: Map<string, string[]>;
  priorityByProgram: Map<string, string>;
  insufficientText: string;
  noRecordText: string;
}): ProgramListCardVM[] {
  const { items, conflictsByProgram, priorityByProgram, insufficientText, noRecordText } = args;
  return items.map((x: any) => {
    const rawRisk = safeText(x?.current_risk_summary?.level ?? x?.risk_level, insufficientText);
    const rawSla = safeText(x?.sla_summary?.latest_status ?? x?.sla_status, insufficientText);
    const costValue = safeNumber(x?.cost_summary?.total_cost ?? x?.cost_total);
    const efficiencyValue = safeNumber(x?.execution_reliability ?? x?.efficiency_index);
    const statusText = safeText(x?.status, insufficientText);
    const primaryAction = translateNextAction(x?.next_action_hint?.kind, insufficientText);

    return {
      title: safeText(x?.program_id, noRecordText),
      subtitle: `${safeText(x?.field_id, insufficientText)} · ${safeText(x?.crop_code, insufficientText)} · ${statusText}`,
      statusBadge: statusBadge(statusText, insufficientText),
      riskBadge: riskBadge(rawRisk, insufficientText),
      primaryAction,
      pendingPlan: toShortId(x?.pending_operation_plan_id, noRecordText),
      pendingTask: toShortId(x?.pending_act_task_id, noRecordText),
      metrics: [
        { label: "成本", value: costValue == null ? insufficientText : costValue.toFixed(2) },
        { label: "SLA", value: translateSla(rawSla, insufficientText), tone: slaSortRank(rawSla) === 0 ? "danger" : "neutral" },
        { label: "效率", value: efficiencyValue == null ? insufficientText : efficiencyValue.toFixed(3), tone: efficiencyValue != null && efficiencyValue < 0.6 ? "warning" : "neutral" },
      ],
      conflictTags: conflictsByProgram.get(String(x?.program_id ?? "")) ?? [],
      href: `/programs/${encodeURIComponent(String(x?.program_id ?? ""))}`,
      seasonId: safeText(x?.season_id, noRecordText),
      sortRiskRank: riskSortRank(rawRisk),
      sortPriorityRank: prioritySortRank(priorityByProgram.get(String(x?.program_id ?? "")) ?? "LOW"),
      sortCostValue: costValue,
      sortSlaRank: slaSortRank(rawSla),
      sortEfficiencyValue: efficiencyValue,
    };
  });
}

export function buildProgramDetailDashboardVM(args: {
  programId: string;
  item: any;
  trajectories: any[];
  cost: any;
  sla: any;
  efficiency: any;
  conflicts: string[];
  insufficientText: string;
  noRecordText: string;
}): ProgramDetailDashboardVM {
  const { programId, item, trajectories, cost, sla, efficiency, conflicts, insufficientText, noRecordText } = args;
  const stable = safeNumber(efficiency?.efficiency_index);
  const inField = safeNumber(item?.latest_acceptance_result?.metrics?.in_field_ratio);
  const riskHeadline = safeText(item?.current_risk_summary?.headline, noRecordText);
  const riskLevel = safeText(item?.current_risk_summary?.level, insufficientText);
  const stageText = safeText(item?.status, insufficientText);

  return {
    header: {
      title: safeText(item?.program_id, decodeURIComponent(programId)),
      subtitle: `${safeText(item?.field_id, insufficientText)} / ${safeText(item?.season_id, insufficientText)} / ${safeText(item?.crop_code, insufficientText)}`,
      statusBadge: statusBadge(stageText, insufficientText),
      riskBadge: riskBadge(riskLevel, insufficientText),
      updatedAtText: safeText(item?.updated_at ?? item?.updatedAt, insufficientText),
    },
    currentIssue: {
      riskHeadline,
      stageText,
      reasonText: safeText(item?.current_risk_summary?.reason ?? item?.latest_acceptance_result?.summary, noRecordText),
    },
    nextActions: [
      { title: "下一步建议", value: translateNextAction(item?.next_action_hint?.kind, insufficientText), description: "优先执行该动作可降低当前风险。" },
      { title: "待执行计划", value: toShortId(item?.pending_operation_plan?.operation_plan_id, noRecordText), description: "最新待推进计划。" },
      {
        title: "待执行任务 / 冲突",
        value: `${toShortId(item?.pending_operation_plan?.act_task_id, noRecordText)} / ${conflicts.length ? conflicts.join("、") : noRecordText}`,
        description: "任务与冲突一起看，避免推进受阻。",
      },
    ],
    outcomeCenter: [
      { title: "最近验收结果", value: safeText(item?.latest_acceptance_result?.verdict, insufficientText), description: "最近一次验收结论。" },
      { title: "空间覆盖率", value: inField == null ? insufficientText : `${(inField * 100).toFixed(1)}%`, description: "轨迹在目标地块内的覆盖比例。" },
      { title: "稳定性", value: stable == null ? insufficientText : stable.toFixed(3), description: "执行稳定性指数。" },
      { title: "最近结果说明", value: safeText(item?.latest_acceptance_result?.summary, noRecordText), description: "用于快速理解验收结果背景。" },
    ],
    resourceCenter: [
      { title: "总成本", value: safeNumber(cost?.total_cost) == null ? insufficientText : Number(cost.total_cost).toFixed(2), description: "累计成本汇总。" },
      { title: "最新 SLA 状态", value: translateSla(sla?.latest_status, insufficientText), description: "最近 SLA 检查状态。" },
      { title: "效率指数", value: stable == null ? insufficientText : stable.toFixed(3), description: "用于横向比较程序效率。" },
      { title: "数据状态", value: translateDataStatus(efficiency?.data_status, insufficientText), description: "数据完整性与可计算状态。" },
    ],
    mapCenter: {
      title: "地图暂未接入本页",
      description: "当前仅展示关键空间指标，后续接入地图联动。",
      metrics: [
        { title: "轨迹任务数", value: trajectories.length ? String(trajectories.length) : noRecordText },
        { title: "地块内比例", value: inField == null ? insufficientText : `${(inField * 100).toFixed(1)}%` },
      ],
    },
    timelineCenter: [
      { key: "recommendation", title: "推荐", statusText: "已生成 recommendation", idText: toShortId(item?.latest_recommendation?.recommendation_id, noRecordText), description: "触发后续计划编排。" },
      { key: "plan", title: "计划", statusText: "已创建 operation plan", idText: toShortId(item?.pending_operation_plan?.operation_plan_id, noRecordText), description: "等待排程执行。" },
      { key: "task", title: "任务", statusText: safeText(item?.status, insufficientText), idText: toShortId(item?.pending_operation_plan?.act_task_id, noRecordText), description: "下发执行任务。" },
      { key: "receipt", title: "回执 / 证据", statusText: safeText(item?.latest_evidence?.status, insufficientText), idText: toShortId(item?.latest_evidence?.artifact_uri, noRecordText), description: "执行回执与证据。" },
      { key: "acceptance", title: "验收", statusText: safeText(item?.latest_acceptance_result?.verdict, insufficientText), idText: toShortId(item?.latest_acceptance_result?.acceptance_id, noRecordText), description: "验收结果与闭环状态。" },
    ],
  };
}
