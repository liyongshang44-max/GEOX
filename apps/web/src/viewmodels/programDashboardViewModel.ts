import type { ProgramPortfolioItemV1 } from "../lib/api";

export type BadgeTone = "neutral" | "success" | "warning" | "danger";

export type DisplayBadge = {
  text: string;
  tone: BadgeTone;
};

export type ProgramListCardVM = {
  title: string;
  subtitle: string;
  statusBadge: DisplayBadge;
  riskBadge: DisplayBadge;
  nextActionText: string;
  pendingPlanText: string;
  pendingTaskText: string;
  costText: string;
  slaText: string;
  efficiencyText: string;
  conflictTags: string[];
  href: string;
  seasonId: string;
  sortRiskKey: string;
  sortCostValue: number | null;
  sortSlaKey: string;
  sortEfficiencyValue: number | null;
};

export type ProgramTimelineEvent = {
  key: string;
  title: string;
  value: string;
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
  actionCenter: Array<{ title: string; value: string; description: string }>;
  outcomeCenter: Array<{ title: string; value: string; description: string }>;
  resourceCenter: Array<{ title: string; value: string; description: string }>;
  mapCenter: {
    mapAvailable: boolean;
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

function statusBadge(status: string, fallback: string): DisplayBadge {
  const s = String(status ?? "").toUpperCase();
  if (s === "SUCCEEDED" || s === "SUCCESS" || s === "MET" || s === "PASSED") return { text: s, tone: "success" };
  if (s === "FAILED" || s === "BREACHED" || s === "REJECTED") return { text: s, tone: "danger" };
  if (s === "RUNNING" || s === "PENDING" || s === "APPROVAL_REQUESTED") return { text: s, tone: "warning" };
  return { text: s || fallback, tone: "neutral" };
}

function riskBadge(level: string, fallback: string): DisplayBadge {
  const s = String(level ?? "").toUpperCase();
  if (s === "HIGH") return { text: s, tone: "danger" };
  if (s === "MEDIUM") return { text: s, tone: "warning" };
  if (s === "LOW") return { text: s, tone: "success" };
  return { text: s || fallback, tone: "neutral" };
}

export function riskSortRank(v: string): number {
  const s = String(v ?? "").toUpperCase();
  if (s === "HIGH") return 0;
  if (s === "MEDIUM") return 1;
  if (s === "LOW") return 2;
  return 3;
}

export function slaSortRank(v: string): number {
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
  const { items, conflictsByProgram, insufficientText, noRecordText } = args;
  return items.map((x: any) => {
    const programId = safeText(x?.program_id, noRecordText);
    const statusText = safeText(x?.status, insufficientText);
    const riskText = safeText(x?.current_risk_summary?.level ?? x?.risk_level, insufficientText);
    const costValue = safeNumber(x?.cost_summary?.total_cost ?? x?.cost_total);
    const efficiencyValue = safeNumber(x?.execution_reliability ?? x?.efficiency_index);
    const slaText = safeText(x?.sla_summary?.latest_status ?? x?.sla_status, insufficientText);

    return {
      title: programId,
      subtitle: `${safeText(x?.field_id, insufficientText)} / ${safeText(x?.crop_code, insufficientText)} / ${statusText}`,
      statusBadge: statusBadge(statusText, insufficientText),
      riskBadge: riskBadge(riskText, insufficientText),
      nextActionText: safeText(x?.next_action_hint?.kind, insufficientText),
      pendingPlanText: safeText(x?.pending_operation_plan_id, insufficientText),
      pendingTaskText: safeText(x?.pending_act_task_id, insufficientText),
      costText: costValue == null ? insufficientText : costValue.toFixed(2),
      slaText,
      efficiencyText: efficiencyValue == null ? insufficientText : efficiencyValue.toFixed(3),
      conflictTags: conflictsByProgram.get(String(x?.program_id ?? "")) ?? [],
      href: `/programs/${encodeURIComponent(String(x?.program_id ?? ""))}`,
      seasonId: safeText(x?.season_id, noRecordText),
      sortRiskKey: riskText,
      sortCostValue: costValue,
      sortSlaKey: slaText,
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
  insufficientText: string;
  noRecordText: string;
}): ProgramDetailDashboardVM {
  const { programId, item, trajectories, cost, sla, efficiency, insufficientText, noRecordText } = args;
  const stable = safeNumber(efficiency?.efficiency_index);
  const inField = safeNumber(item?.latest_acceptance_result?.metrics?.in_field_ratio);
  const updatedAt = safeText(item?.updated_at ?? item?.updatedAt, insufficientText);

  return {
    header: {
      title: safeText(item?.program_id, decodeURIComponent(programId)),
      subtitle: `${safeText(item?.field_id, insufficientText)} / ${safeText(item?.season_id, insufficientText)} / ${safeText(item?.crop_code, insufficientText)}`,
      statusBadge: statusBadge(safeText(item?.status, insufficientText), insufficientText),
      riskBadge: riskBadge(safeText(item?.current_risk_summary?.level, insufficientText), insufficientText),
      updatedAtText: updatedAt,
    },
    actionCenter: [
      { title: "下一步建议", value: safeText(item?.next_action_hint?.kind, insufficientText), description: "用于快速推进经营动作。" },
      { title: "待执行计划", value: safeText(item?.pending_operation_plan?.operation_plan_id, insufficientText), description: "当前最需要推进的计划。" },
      { title: "待执行任务 / 冲突", value: `${safeText(item?.pending_operation_plan?.act_task_id, insufficientText)} / ${safeText(item?.current_risk_summary?.headline, noRecordText)}`, description: "任务与阻塞一并查看。" },
    ],
    outcomeCenter: [
      { title: "验收结果", value: safeText(item?.latest_acceptance_result?.verdict, insufficientText), description: "最近一次验收结论。" },
      { title: "空间覆盖", value: inField == null ? insufficientText : `${(inField * 100).toFixed(1)}%`, description: "轨迹在目标地块内的覆盖率。" },
      { title: "稳定性", value: stable == null ? insufficientText : stable.toFixed(3), description: "执行稳定性指数。" },
      { title: "最近结果说明", value: safeText(item?.latest_acceptance_result?.summary, noRecordText), description: "结果摘要，便于快速研判。" },
    ],
    resourceCenter: [
      { title: "成本", value: safeNumber(cost?.total_cost) == null ? insufficientText : Number(cost.total_cost).toFixed(2), description: "累计成本汇总。" },
      { title: "SLA", value: safeText(sla?.latest_status, insufficientText), description: "最近 SLA 检查状态。" },
      { title: "效率", value: stable == null ? insufficientText : stable.toFixed(3), description: "效率指数，用于横向比较。" },
      { title: "数据状态", value: safeText(efficiency?.data_status, insufficientText), description: "数据完整性与可计算状态。" },
    ],
    mapCenter: {
      mapAvailable: false,
      title: "地图中心",
      description: "当前无可用地图组件，已提供占位说明。",
      metrics: [
        { title: "轨迹任务", value: trajectories.length ? String(trajectories.length) : noRecordText },
        { title: "地块内比例", value: inField == null ? insufficientText : `${(inField * 100).toFixed(1)}%` },
      ],
    },
    timelineCenter: [
      { key: "recommendation", title: "recommendation", value: safeText(item?.latest_recommendation?.recommendation_id, insufficientText), description: "推荐生成" },
      { key: "plan", title: "plan", value: safeText(item?.pending_operation_plan?.operation_plan_id, insufficientText), description: "计划生成/待执行" },
      { key: "task", title: "task", value: safeText(item?.pending_operation_plan?.act_task_id, insufficientText), description: "任务下发" },
      { key: "receipt", title: "receipt", value: safeText(item?.latest_evidence?.artifact_uri, insufficientText), description: "回执与证据" },
      { key: "acceptance", title: "acceptance", value: safeText(item?.latest_acceptance_result?.verdict, insufficientText), description: "验收结果" },
    ],
  };
}
