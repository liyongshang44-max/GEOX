import type { ProgramPortfolioItemV1 } from "../lib/api";

export type BadgeTone = "neutral" | "success" | "warning" | "danger";

export type DisplayBadge = {
  text: string;
  tone: BadgeTone;
};

export type MetricBlock = {
  labelKey: string;
  value: string;
  tone?: BadgeTone;
};

export type ProgramListCardVM = {
  title: string;
  subtitleParts: { field: string; crop: string; status: string };
  statusBadge: DisplayBadge;
  riskBadge: DisplayBadge;
  primaryActionKey: string;
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
  titleKey: string;
  statusText: string;
  idText: string;
  descriptionKey: string;
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
  nextActions: Array<{ titleKey: string; value: string; descriptionKey: string }>;
  outcomeCenter: Array<{ titleKey: string; value: string; descriptionKey: string }>;
  resourceCenter: Array<{ titleKey: string; value: string; descriptionKey: string }>;
  mapCenter: {
    titleKey: string;
    descriptionKey: string;
    metrics: Array<{ titleKey: string; value: string }>;
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

function nextActionKey(kind: unknown): string {
  const s = String(kind ?? "").toUpperCase();
  if (s === "CHECK_DEVICE_PATH_OR_BINDING") return "program.nextAction.checkDeviceBinding";
  if (s === "REVIEW_IRRIGATION_PLAN") return "program.nextAction.reviewIrrigationPlan";
  if (s === "ON_TRACK") return "program.nextAction.onTrack";
  if (s === "STABLE_EXECUTION") return "program.nextAction.stableExecution";
  if (s === "DATA_INSUFFICIENT") return "program.nextAction.dataInsufficient";
  return "program.nextAction.unknown";
}

function slaText(status: unknown, insufficientText: string): string {
  const s = String(status ?? "").toUpperCase();
  if (!s) return insufficientText;
  if (s === "MET" || s === "PASSED") return "program.sla.met";
  if (s === "BREACHED" || s === "FAILED") return "program.sla.breached";
  if (s === "UNKNOWN") return "program.sla.unknown";
  return s;
}

function dataStatusText(status: unknown, insufficientText: string): string {
  const s = String(status ?? "").toUpperCase();
  if (!s) return insufficientText;
  if (s === "INSUFFICIENT_DATA") return "program.dataStatus.insufficient";
  if (s === "READY") return "program.dataStatus.ready";
  if (s === "PENDING") return "program.dataStatus.pending";
  return s;
}

function riskBadge(level: unknown): DisplayBadge {
  const s = String(level ?? "").toUpperCase();
  if (s === "HIGH") return { text: "program.risk.high", tone: "danger" };
  if (s === "MEDIUM") return { text: "program.risk.medium", tone: "warning" };
  if (s === "LOW") return { text: "program.risk.low", tone: "success" };
  return { text: "program.risk.insufficient", tone: "neutral" };
}

function statusBadge(status: unknown, fallback: string): DisplayBadge {
  const s = String(status ?? "").toUpperCase();
  if (s === "SUCCEEDED" || s === "SUCCESS" || s === "MET" || s === "PASSED") return { text: s || fallback, tone: "success" };
  if (s === "FAILED" || s === "BREACHED" || s === "REJECTED") return { text: s || fallback, tone: "danger" };
  if (s === "RUNNING" || s === "PENDING" || s === "APPROVAL_REQUESTED" || s === "ACTIVE") return { text: s || fallback, tone: "warning" };
  return { text: s || fallback, tone: "neutral" };
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

    return {
      title: safeText(x?.program_id, noRecordText),
      subtitleParts: {
        field: safeText(x?.field_id, insufficientText),
        crop: safeText(x?.crop_code, insufficientText),
        status: statusText,
      },
      statusBadge: statusBadge(statusText, insufficientText),
      riskBadge: riskBadge(rawRisk),
      primaryActionKey: nextActionKey(x?.next_action_hint?.kind),
      pendingPlan: toShortId(x?.pending_operation_plan_id, noRecordText),
      pendingTask: toShortId(x?.pending_act_task_id, noRecordText),
      metrics: [
        { labelKey: "portfolio.cost", value: costValue == null ? insufficientText : costValue.toFixed(2) },
        { labelKey: "portfolio.sla", value: slaText(rawSla, insufficientText), tone: slaSortRank(rawSla) === 0 ? "danger" : "neutral" },
        { labelKey: "portfolio.efficiency", value: efficiencyValue == null ? insufficientText : efficiencyValue.toFixed(3), tone: efficiencyValue != null && efficiencyValue < 0.6 ? "warning" : "neutral" },
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

  return {
    header: {
      title: safeText(item?.program_id, decodeURIComponent(programId)),
      subtitle: `${safeText(item?.field_id, insufficientText)} / ${safeText(item?.season_id, insufficientText)} / ${safeText(item?.crop_code, insufficientText)}`,
      statusBadge: statusBadge(item?.status, insufficientText),
      riskBadge: riskBadge(item?.current_risk_summary?.level),
      updatedAtText: safeText(item?.updated_at ?? item?.updatedAt, insufficientText),
    },
    currentIssue: {
      riskHeadline: safeText(item?.current_risk_summary?.headline, noRecordText),
      stageText: safeText(item?.status, insufficientText),
      reasonText: safeText(item?.current_risk_summary?.reason ?? item?.latest_acceptance_result?.summary, noRecordText),
    },
    nextActions: [
      { titleKey: "program.nextAction.title", value: nextActionKey(item?.next_action_hint?.kind), descriptionKey: "program.nextAction.desc" },
      { titleKey: "program.pendingPlan.title", value: toShortId(item?.pending_operation_plan?.operation_plan_id, noRecordText), descriptionKey: "program.pendingPlan.desc" },
      {
        titleKey: "program.pendingTaskAndConflict.title",
        value: `${toShortId(item?.pending_operation_plan?.act_task_id, noRecordText)} / ${conflicts.length ? conflicts.join(", ") : noRecordText}`,
        descriptionKey: "program.pendingTaskAndConflict.desc",
      },
    ],
    outcomeCenter: [
      { titleKey: "program.outcome.acceptance", value: safeText(item?.latest_acceptance_result?.verdict, insufficientText), descriptionKey: "program.outcome.acceptanceDesc" },
      { titleKey: "program.outcome.coverage", value: inField == null ? insufficientText : `${(inField * 100).toFixed(1)}%`, descriptionKey: "program.outcome.coverageDesc" },
      { titleKey: "program.outcome.stability", value: stable == null ? insufficientText : stable.toFixed(3), descriptionKey: "program.outcome.stabilityDesc" },
      { titleKey: "program.outcome.summary", value: safeText(item?.latest_acceptance_result?.summary, noRecordText), descriptionKey: "program.outcome.summaryDesc" },
    ],
    resourceCenter: [
      { titleKey: "program.resource.cost", value: safeNumber(cost?.total_cost) == null ? insufficientText : Number(cost.total_cost).toFixed(2), descriptionKey: "program.resource.costDesc" },
      { titleKey: "program.resource.sla", value: slaText(sla?.latest_status, insufficientText), descriptionKey: "program.resource.slaDesc" },
      { titleKey: "program.resource.efficiency", value: stable == null ? insufficientText : stable.toFixed(3), descriptionKey: "program.resource.efficiencyDesc" },
      { titleKey: "program.resource.dataStatus", value: dataStatusText(efficiency?.data_status, insufficientText), descriptionKey: "program.resource.dataStatusDesc" },
    ],
    mapCenter: {
      titleKey: "program.map.notIntegrated",
      descriptionKey: "program.map.notIntegratedDesc",
      metrics: [
        { titleKey: "program.map.trajectoryTasks", value: trajectories.length ? String(trajectories.length) : noRecordText },
        { titleKey: "program.map.inFieldRatio", value: inField == null ? insufficientText : `${(inField * 100).toFixed(1)}%` },
      ],
    },
    timelineCenter: [
      { key: "recommendation", titleKey: "program.timeline.recommendation", statusText: "program.timeline.status.recommendation", idText: toShortId(item?.latest_recommendation?.recommendation_id, noRecordText), descriptionKey: "program.timeline.recommendationDesc" },
      { key: "plan", titleKey: "program.timeline.plan", statusText: "program.timeline.status.plan", idText: toShortId(item?.pending_operation_plan?.operation_plan_id, noRecordText), descriptionKey: "program.timeline.planDesc" },
      { key: "task", titleKey: "program.timeline.task", statusText: safeText(item?.status, insufficientText), idText: toShortId(item?.pending_operation_plan?.act_task_id, noRecordText), descriptionKey: "program.timeline.taskDesc" },
      { key: "receipt", titleKey: "program.timeline.receipt", statusText: safeText(item?.latest_evidence?.status, insufficientText), idText: toShortId(item?.latest_evidence?.artifact_uri, noRecordText), descriptionKey: "program.timeline.receiptDesc" },
      { key: "acceptance", titleKey: "program.timeline.acceptance", statusText: safeText(item?.latest_acceptance_result?.verdict, insufficientText), idText: toShortId(item?.latest_acceptance_result?.acceptance_id, noRecordText), descriptionKey: "program.timeline.acceptanceDesc" },
    ],
  };
}
