import { mapReceiptToVm, type ReceiptEvidenceVm } from "./evidence";
import { resolveTimelineLabel } from "./timelineLabels";
import { toOperationDetailPath } from "../lib/operationLink";

type ProgramConsoleStatus = "ok" | "risk" | "error" | "running";

export type BadgeStatus = "success" | "warning" | "failed" | "pending";
export type ProgramActionExpectation = { label: string; value: string };
export type ProgramDetailAction = { type: string; mode: string; reason: string; expectedEffect: string; expectation: ProgramActionExpectation };
export type ProgramDetailTimelineItem = { kind: string; status: string; occurredAt: string; summary: string };
export type ProgramDetailMetric = { label: string; value: string };
export type ProgramDetailViewModel = any;

type TimelineType = "recommendation" | "approval" | "execution" | "evidence";

export type ProgramConsoleViewModel = {
  title: string;
  status: ProgramConsoleStatus;
  statusLabel: string;
  stageLabel: string;
  latestActionLabel: string;

  goalSummary: Array<{ label: string; value: string }>;
  currentExecution: {
    latestRecommendation?: string;
    latestApproval?: string;
    currentTask?: string;
    currentTaskStatus?: string;
  };

  resultSummary: Array<{ label: string; value: string }>;
  latestEvidence?: ReceiptEvidenceVm;
  latestEvidenceAtLabel?: string;
  latestEvidenceDeviceLabel?: string;
  latestEvidenceResultLabel?: string;
  timeline: Array<{
    ts: number;
    label: string;
    type: TimelineType;
  }>;
};

function toText(value: unknown, fallback = "-"): string {
  if (typeof value === "string") {
    const cleaned = value.trim();
    return cleaned || fallback;
  }
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return fallback;
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function toPriorityLabel(value: unknown, fallback = "中"): string {
  const code = String(value ?? "").trim().toUpperCase();
  if (["HIGH", "P1", "STRICT", "TIGHT"].includes(code)) return "高";
  if (["LOW", "P3", "RELAXED", "LOOSE"].includes(code)) return "低";
  if (["MEDIUM", "MID", "NORMAL", "P2"].includes(code)) return "中";
  return fallback;
}

function formatDateTime(msOrText: unknown, fallback = "-"): string {
  const ms = typeof msOrText === "number" ? msOrText : Date.parse(String(msOrText ?? ""));
  if (!Number.isFinite(ms)) return fallback;
  const date = new Date(ms);
  return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function readableActionType(code: unknown): string {
  const text = String(code ?? "").toUpperCase();
  if (text.includes("IRRIGATION") || text.includes("WATER")) return "灌溉";
  if (text.includes("SPRAY")) return "喷施";
  if (text.includes("SCOUT") || text.includes("INSPECT")) return "巡检";
  return "作业";
}

function topStatus(code: unknown): { status: ProgramConsoleStatus; label: string } {
  const normalized = String(code ?? "").toUpperCase();
  if (["FAILED", "ERROR", "NOT_EXECUTED", "REJECTED", "BLOCKED"].includes(normalized)) return { status: "error", label: "异常" };
  if (["RISK", "VIOLATED", "BREACHED"].includes(normalized)) return { status: "risk", label: "风险" };
  if (["RUNNING", "PENDING", "ACTIVE", "APPROVAL_REQUIRED", "APPROVAL_REQUESTED"].includes(normalized)) return { status: "running", label: "运行中" };
  return { status: "ok", label: "正常" };
}

function mapProgramStage(data: { ops: any[]; controlPlane: any; detail: any }): string {
  const hasRunningTask = data.ops.some((op) => ["RUNNING", "IN_PROGRESS", "DISPATCHED"].includes(String(op?.final_status ?? op?.dispatch_status ?? "").toUpperCase()));
  if (hasRunningTask) return "执行中";

  const approvalCode = String(data.controlPlane?.summary?.approval?.code ?? data.detail?.latest_approval?.status ?? "").toUpperCase();
  const hasApprovedPlan = ["APPROVED", "SUCCEEDED", "READY"].includes(approvalCode);
  if (hasApprovedPlan) return "待执行";

  const hasRecommendation = Boolean(data.controlPlane?.summary?.recommendation?.code || data.detail?.latest_recommendation);
  if (hasRecommendation) return "待决策";

  return "运行中";
}

function dedupeTimeline(items: ProgramConsoleViewModel["timeline"]): ProgramConsoleViewModel["timeline"] {
  const seen = new Set<string>();
  return items
    .filter((item) => Number.isFinite(item.ts))
    .sort((a, b) => a.ts - b.ts)
    .filter((item) => {
      const key = `${item.type}_${item.ts}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export function buildProgramDetailViewModel(args: {
  programId: string;
  controlPlane: any;
  detail: any;
  ops: any[];
}): ProgramConsoleViewModel {
  const { programId, controlPlane, detail, ops } = args;
  const program = controlPlane?.program || detail || {};
  const summary = controlPlane?.summary || {};

  const displayTitle = toText(program?.title || detail?.program_name || detail?.name, "默认经营方案");
  const cropName = toText(detail?.crop_name || program?.crop_name || detail?.crop_code || program?.crop_code, "-");

  const top = topStatus(summary?.execution?.code || summary?.receipt?.code || detail?.status || program?.status?.code);
  const latestOperation = [...ops].sort((a, b) => Number(b?.last_event_ts || 0) - Number(a?.last_event_ts || 0))[0];

  const latestEvidenceRaw = detail?.latestEvidence || detail?.latest_evidence || controlPlane?.latestEvidence || controlPlane?.latest_evidence || controlPlane?.evidence?.recent_items?.[0];
  const latestEvidenceVm = latestEvidenceRaw ? mapReceiptToVm({
    ...latestEvidenceRaw,
    href: toOperationDetailPath({ ...latestEvidenceRaw, operation_plan_id: latestEvidenceRaw?.operation_plan_id ?? latestOperation?.operation_plan_id ?? latestOperation?.operation_id }),
  }) : undefined;

  const recommendationText =
    toText(controlPlane?.decision_timeline?.[0]?.summary, "") ||
    toText(detail?.latest_recommendation?.summary || detail?.current_risk_summary?.reason, "") ||
    undefined;

  const approvalText = toText(controlPlane?.summary?.approval?.label || detail?.latest_approval?.status, "") || undefined;
  const currentTask = latestOperation ? readableActionType(latestOperation?.action_type) : undefined;
  const currentTaskStatus = latestOperation ? resolveTimelineLabel({ operationPlanStatus: latestOperation?.final_status, dispatchState: latestOperation?.dispatch_status }) : undefined;

  const totalWater = ops.reduce((sum, item) => sum + (toNumber(item?.water_l) || 0), 0) + (toNumber(controlPlane?.resources?.water_l) || 0);
  const totalElectric = ops.reduce((sum, item) => sum + (toNumber(item?.electric_kwh) || 0), 0) + (toNumber(controlPlane?.resources?.electric_kwh) || 0);
  const violated = Boolean(controlPlane?.execution_result?.constraint_check?.violated || latestEvidenceRaw?.constraint_violated);

  const timeline = dedupeTimeline([
    ...((controlPlane?.decision_timeline || []).map((item: any) => ({
      ts: Number(item?.ts_ms || Date.parse(String(item?.ts_label || "")) || 0),
      label: resolveTimelineLabel({ factType: item?.fact_type || item?.type, approvalDecision: item?.decision }),
      type: "recommendation" as TimelineType,
    }))),
    ...((controlPlane?.execution_timeline || []).map((item: any) => ({
      ts: Number(item?.ts_ms || Date.parse(String(item?.ts_label || "")) || 0),
      label: resolveTimelineLabel({ factType: item?.fact_type || item?.type, operationPlanStatus: item?.status, dispatchState: item?.dispatch_state }),
      type: "execution" as TimelineType,
    }))),
    ...ops.flatMap((op) => (Array.isArray(op?.timeline) ? op.timeline : []).map((event: any) => ({
      ts: Number(event?.ts || 0),
      label: resolveTimelineLabel({ factType: event?.fact_type || event?.type, operationPlanStatus: event?.status || op?.final_status, dispatchState: event?.dispatch_state || op?.dispatch_status }),
      type: "execution" as TimelineType,
    }))),
    approvalText ? [{ ts: Date.now(), label: resolveTimelineLabel({ factType: "approval_decision_v1", approvalDecision: detail?.latest_approval?.status || controlPlane?.summary?.approval?.code }), type: "approval" as TimelineType }] : [],
    latestEvidenceRaw
      ? [{ ts: Date.parse(String(latestEvidenceRaw?.occurred_at || latestEvidenceRaw?.execution_finished_at || "")) || Date.now(), label: resolveTimelineLabel({ factType: latestEvidenceRaw?.receipt_type || latestEvidenceRaw?.type || "ao_act_receipt_v1" }), type: "evidence" as TimelineType }]
      : [],
  ]);

  const latestTimelineItem = timeline[timeline.length - 1];

  return {
    title: `${displayTitle}` ,
    status: top.status,
    statusLabel: top.label,
    stageLabel: mapProgramStage({ ops, controlPlane, detail }),
    latestActionLabel: latestTimelineItem ? `${formatDateTime(latestTimelineItem.ts)} ${latestTimelineItem.label}` : "暂无最新动作",

    goalSummary: [
      { label: "作物", value: cropName },
      { label: "目标品质", value: toPriorityLabel(detail?.goal_profile?.quality_priority || detail?.quality_priority, "高") },
      { label: "目标产量", value: toPriorityLabel(detail?.goal_profile?.yield_priority || detail?.yield_priority, "中") },
      { label: "农残限制", value: toPriorityLabel(detail?.goal_profile?.residue_priority || detail?.residue_priority, "严格") === "高" ? "严格" : "标准" },
      { label: "节水优先", value: toPriorityLabel(detail?.goal_profile?.water_saving_priority || detail?.water_saving_priority, "高") === "高" ? "是" : "否" },
      { label: "成本优先", value: toPriorityLabel(detail?.goal_profile?.cost_priority || detail?.cost_priority, "中") },
    ],

    currentExecution: {
      latestRecommendation: recommendationText,
      latestApproval: approvalText,
      currentTask,
      currentTaskStatus,
    },

    resultSummary: [
      { label: "累计作业", value: `${ops.length} 次` },
      { label: "累计用水", value: totalWater > 0 ? `${totalWater.toFixed(0)} L` : "-" },
      { label: "累计耗电", value: totalElectric > 0 ? `${totalElectric.toFixed(2)} kWh` : "-" },
      { label: "最近一次结果", value: latestEvidenceVm?.statusLabel || toText(controlPlane?.execution_result?.result_label, "等待结果") },
      { label: "约束检查", value: violated ? "存在风险" : "符合约束" },
    ],

    latestEvidence: latestEvidenceVm,
    latestEvidenceAtLabel: formatDateTime(latestEvidenceRaw?.occurred_at || latestEvidenceRaw?.execution_finished_at, "-"),
    latestEvidenceDeviceLabel: toText(latestEvidenceRaw?.device_id || latestEvidenceRaw?.executor_id, "-"),
    latestEvidenceResultLabel: latestEvidenceVm?.constraintCheckLabel,
    timeline,
  };
}
