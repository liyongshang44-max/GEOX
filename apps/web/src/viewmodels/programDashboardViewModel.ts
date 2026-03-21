import type { ProgramPortfolioItemV1 } from "../lib/api";

export type ProgramDashboardListRow = {
  programId: string;
  seasonId: string;
  fieldId: string;
  cropCode: string;
  status: string;
  risk: string;
  nextAction: string;
  pendingPlan: string;
  pendingTask: string;
  costSummary: string;
  slaSummary: string;
  efficiencySummary: string;
  conflictKinds: string[];
  priority: string;
};

export type ProgramDashboardDetailViewModel = {
  header: { title: string; subtitle: string; status: string; risk: string };
  actionCenter: Array<{ label: string; value: string }>;
  outcomeCenter: Array<{ label: string; value: string }>;
  resourceCostSlaCenter: Array<{ label: string; value: string }>;
  mapCenter: Array<{ label: string; value: string }>;
  timelineCenter: Array<{ label: string; value: string }>;
};

function safeText(v: unknown, fallback = "数据不足"): string {
  if (v === null || v === undefined) return fallback;
  const s = String(v).trim();
  return s ? s : fallback;
}

function safeNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export function buildProgramListRows(args: {
  items: ProgramPortfolioItemV1[];
  conflictsByProgram: Map<string, string[]>;
  priorityByProgram: Map<string, string>;
}): ProgramDashboardListRow[] {
  const { items, conflictsByProgram, priorityByProgram } = args;
  return items.map((x: any) => {
    const pid = safeText(x?.program_id, "");
    const executionReliability = safeNumber(x?.execution_reliability);
    return {
      programId: pid,
      seasonId: safeText(x?.season_id),
      fieldId: safeText(x?.field_id),
      cropCode: safeText(x?.crop_code),
      status: safeText(x?.status),
      risk: safeText(x?.current_risk_summary?.level ?? x?.risk_level),
      nextAction: safeText(x?.next_action_hint?.kind),
      pendingPlan: safeText(x?.pending_operation_plan_id),
      pendingTask: safeText(x?.pending_act_task_id),
      costSummary: safeText(x?.cost_summary?.total_cost ?? x?.cost_total),
      slaSummary: safeText(x?.sla_summary?.latest_status ?? x?.sla_status),
      efficiencySummary: executionReliability == null ? "数据不足" : executionReliability.toFixed(3),
      conflictKinds: conflictsByProgram.get(pid) ?? [],
      priority: safeText(priorityByProgram.get(pid) ?? x?.next_action_hint?.priority),
    };
  });
}

export function buildProgramDashboardDetailViewModel(args: {
  programId: string;
  item: any;
  trajectories: any[];
  cost: any;
  sla: any;
  efficiency: any;
}): ProgramDashboardDetailViewModel {
  const { programId, item, trajectories, cost, sla, efficiency } = args;
  const readyTrajectoryCount = trajectories.filter((x: any) => Number(x?.payload?.point_count ?? 0) > 0).length;

  return {
    header: {
      title: safeText(item?.program_id, decodeURIComponent(programId)),
      subtitle: safeText(item?.field_id),
      status: safeText(item?.status),
      risk: safeText(item?.current_risk_summary?.level),
    },
    actionCenter: [
      { label: "下一步动作", value: safeText(item?.pending_operation_plan?.status) },
      { label: "待执行计划", value: safeText(item?.pending_operation_plan?.operation_plan_id) },
      { label: "待执行任务", value: safeText(item?.pending_operation_plan?.act_task_id) },
    ],
    outcomeCenter: [
      { label: "最新验收", value: safeText(item?.latest_acceptance_result?.verdict) },
      { label: "执行状态", value: safeText(item?.status) },
      { label: "证据导出", value: safeText(item?.latest_evidence?.artifact_uri) },
    ],
    resourceCostSlaCenter: [
      { label: "成本总额", value: safeText(cost?.total_cost) },
      { label: "SLA 合规率", value: safeNumber(sla?.compliance_rate) == null ? "数据不足" : `${(Number(sla.compliance_rate) * 100).toFixed(1)}%` },
      { label: "效率指数", value: safeNumber(efficiency?.efficiency_index) == null ? "数据不足" : Number(efficiency.efficiency_index).toFixed(3) },
    ],
    mapCenter: [
      { label: "地块内比例", value: safeNumber(item?.latest_acceptance_result?.metrics?.in_field_ratio) == null ? "数据不足" : Number(item.latest_acceptance_result.metrics.in_field_ratio).toFixed(3) },
      { label: "轨迹任务", value: trajectories.length ? String(trajectories.length) : "暂无记录" },
      { label: "可用轨迹", value: readyTrajectoryCount ? String(readyTrajectoryCount) : "暂无记录" },
    ],
    timelineCenter: [
      { label: "推荐", value: safeText(item?.latest_recommendation?.recommendation_id) },
      { label: "审批", value: safeText(item?.pending_operation_plan?.approval_request_id) },
      { label: "计划", value: safeText(item?.pending_operation_plan?.operation_plan_id) },
      { label: "任务", value: safeText(item?.pending_operation_plan?.act_task_id) },
    ],
  };
}
