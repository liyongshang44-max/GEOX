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
type ProgramActiveRule = {
  ruleId: string;
  priorityLabel: string;
  performanceLabel: string;
  effectivenessLabel: string;
  actionLabel: string;
  reasonCodesLabel: string;
  riskIfNotExecute: string;
};
type ProgramRecommendationItem = {
  timeLabel: string;
  stageLabel: string;
  actionLabel: string;
  summary: string;
  statusLabel: string;
};

export type ProgramConsoleViewModel = {
  title: string;
  fieldId?: string;
  currentOperationPlanId?: string;
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
  cropInsight: {
    cropLabel: string;
    cropStage: string;
    keyMetrics: Array<{ label: string; value: string }>;
    activeRuleCount: number;
  };
  programAgronomy: {
    cropCode: string;
    cropLabel: string;
    cropStage: string;
    cropStageLabel: string;
    stageSummary: string;
    stageGoal: string;
  };
  currentMetrics: {
    soilMoistureLabel: string;
    temperatureLabel: string;
    humidityLabel: string;
    updatedAtLabel: string;
  };
  activeRules: ProgramActiveRule[];
  recentRecommendations: ProgramRecommendationItem[];
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

function toRulePerformanceLabel(value: unknown): string {
  const key = String(value ?? "").trim().toLowerCase();
  if (key === "high") return "高";
  if (key === "medium") return "中";
  return "低";
}

function toRuleEffectivenessLabel(value: unknown): string {
  const score = toNumber(value);
  if (!Number.isFinite(score)) return "--";
  const normalized = Math.max(0, Math.min(1, Number(score)));
  return `${Math.round(normalized * 100)}%`;
}

function formatDateTime(msOrText: unknown, fallback = "-"): string {
  const ms = typeof msOrText === "number" ? msOrText : Date.parse(String(msOrText ?? ""));
  if (!Number.isFinite(ms)) return fallback;
  const date = new Date(ms);
  return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function cropDisplayName(code: unknown): string {
  const normalized = String(code ?? "").trim().toLowerCase();
  if (normalized === "corn") return "玉米";
  if (normalized === "tomato") return "番茄";
  return normalized || "-";
}

function metricValueText(value: unknown, suffix = ""): string {
  const n = toNumber(value);
  if (!Number.isFinite(n)) return "暂无数据";
  return `${n}${suffix}`;
}

function normalizeStageCode(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

function cropStageDisplayLabel(stageCode: unknown): string {
  const normalized = normalizeStageCode(stageCode);
  if (["vegetative", "veg", "v"].includes(normalized)) return "营养生长期（vegetative）";
  if (["reproductive", "repr", "r"].includes(normalized)) return "生殖生长期（reproductive）";
  if (["seedling", "emergence"].includes(normalized)) return "苗期（seedling）";
  if (["maturity", "ripening"].includes(normalized)) return "成熟期（maturity）";
  return normalized || "-";
}

function cropStageSummary(stageCode: unknown): string {
  const normalized = normalizeStageCode(stageCode);
  if (["vegetative", "veg", "v"].includes(normalized)) return "当前重点关注土壤含水、温度与长势稳定性。";
  if (["reproductive", "repr", "r"].includes(normalized)) return "当前重点关注授粉/坐果相关环境，避免水分和温度波动。";
  if (["seedling", "emergence"].includes(normalized)) return "当前重点关注出苗整齐度、土壤墒情和早期病虫风险。";
  if (["maturity", "ripening"].includes(normalized)) return "当前重点关注成熟一致性、含水控制和收获窗口。";
  return "当前重点关注关键环境指标稳定，避免影响作物阶段推进。";
}

function cropStageGoal(stageCode: unknown): string {
  const normalized = normalizeStageCode(stageCode);
  if (["vegetative", "veg", "v"].includes(normalized)) return "保持水分在安全区间，避免缺水抑制营养生长。";
  if (["reproductive", "repr", "r"].includes(normalized)) return "保障生殖生长环境稳定，降低落花落果与减产风险。";
  if (["seedling", "emergence"].includes(normalized)) return "确保苗齐苗壮，为后续生长建立稳定群体基础。";
  if (["maturity", "ripening"].includes(normalized)) return "稳住后期品质与产量，按计划进入采收节奏。";
  return "保持阶段关键指标在安全范围内，降低异常波动风险。";
}

function readableActionType(code: unknown): string {
  const text = String(code ?? "").toUpperCase();
  if (text.includes("IRRIGATION") || text.includes("WATER")) return "灌溉";
  if (text.includes("SPRAY")) return "喷施";
  if (text.includes("SCOUT") || text.includes("INSPECT")) return "巡检";
  return "作业";
}

function riskIfNotExecuteByAction(actionLabel: string): string {
  if (actionLabel === "灌溉") return "土壤含水继续下降，可能抑制长势并造成后续减产风险";
  if (actionLabel === "喷施") return "病虫害风险可能扩大，影响后续品质和产量稳定性";
  if (actionLabel === "巡检") return "异常问题可能无法及时发现，导致处置窗口延误";
  return "风险可能持续累积，并带来额外生产成本损失";
}

function buildActiveRules(detail: any): ProgramActiveRule[] {
  const recommendation = detail?.latest_recommendation ?? {};
  const activeRulesRaw = Array.isArray(recommendation?.active_rules)
    ? recommendation.active_rules
    : Array.isArray(recommendation?.rule_hit)
      ? recommendation.rule_hit
      : [];

  return activeRulesRaw.map((rule: any) => {
    const actionLabel = readableActionType(
      rule?.action_type
      || rule?.suggested_action
      || recommendation?.suggested_action?.action_type
      || recommendation?.action_type
      || ""
    );
    const reasonCodes = Array.isArray(rule?.reason_codes)
      ? rule.reason_codes.map((v: unknown) => toText(v, "")).filter(Boolean)
      : [];
    const reasonCodesLabel = toText(
      reasonCodes.join(" / ")
      || rule?.reason_code
      || rule?.reason
      || recommendation?.reason_codes?.join(" / "),
      "暂无数据"
    );

    return {
      ruleId: toText(rule?.rule_id || rule?.id, "暂无数据"),
      priorityLabel: toPriorityLabel(rule?.priority ?? recommendation?.priority, "中"),
      performanceLabel: toRulePerformanceLabel(rule?.rule_confidence ?? recommendation?.rule_confidence),
      effectivenessLabel: toRuleEffectivenessLabel(rule?.rule_score ?? recommendation?.rule_score),
      actionLabel: actionLabel || "作业",
      reasonCodesLabel,
      riskIfNotExecute: toText(
        rule?.risk_if_not_execute || recommendation?.business_effect?.risk_if_not_execute,
        riskIfNotExecuteByAction(actionLabel)
      ),
    };
  });
}

function toRecommendationStatusLabel(value: unknown): string {
  const code = String(value ?? "").trim().toUpperCase();
  if (["APPROVED", "SUCCEEDED", "DONE"].includes(code)) return "已通过";
  if (["REJECTED", "FAILED"].includes(code)) return "已拒绝";
  if (["RUNNING", "IN_PROGRESS"].includes(code)) return "执行中";
  if (["PENDING", "APPROVAL_REQUIRED", "APPROVAL_REQUESTED", ""].includes(code)) return "待审批";
  return "待审批";
}

function buildRecentRecommendations(detail: any, controlPlane: any): ProgramRecommendationItem[] {
  const recommendation = detail?.latest_recommendation ?? {};
  const recommendationEvents = Array.isArray(controlPlane?.decision_timeline)
    ? controlPlane.decision_timeline.filter((item: any) => String(item?.fact_type || item?.type || "").toLowerCase().includes("recommend"))
    : [];
  const fallbackList = Array.isArray(detail?.recommendations) ? detail.recommendations : [];

  const baseItems = [
    ...recommendationEvents,
    ...fallbackList,
  ];
  const normalized = baseItems.map((item: any) => {
    const actionCode =
      item?.action_type
      || item?.suggested_action?.action_type
      || recommendation?.suggested_action?.action_type
      || recommendation?.action_type
      || "";
    return {
      timeMs: Number(item?.ts_ms || Date.parse(String(item?.created_at || item?.ts_label || item?.time || "")) || 0),
      timeLabel: formatDateTime(item?.ts_ms || item?.created_at || item?.ts_label || item?.time, "暂无数据"),
      stageLabel: cropStageDisplayLabel(item?.crop_stage || recommendation?.crop_stage),
      actionLabel: readableActionType(actionCode),
      summary: toText(item?.summary || item?.reason || recommendation?.summary, "暂无数据"),
      statusLabel: toRecommendationStatusLabel(item?.status || detail?.latest_approval?.status || controlPlane?.summary?.approval?.code),
    };
  });

  const withLatest = normalized.length
    ? normalized
    : [{
      timeMs: Date.parse(String(recommendation?.created_at || recommendation?.updated_at || "")) || 0,
      timeLabel: formatDateTime(recommendation?.created_at || recommendation?.updated_at, "暂无数据"),
      stageLabel: cropStageDisplayLabel(recommendation?.crop_stage),
      actionLabel: readableActionType(recommendation?.suggested_action?.action_type || recommendation?.action_type),
      summary: toText(recommendation?.summary, "暂无数据"),
      statusLabel: toRecommendationStatusLabel(detail?.latest_approval?.status || controlPlane?.summary?.approval?.code),
    }];

  return withLatest
    .filter((item) => item.summary !== "暂无数据" || item.actionLabel !== "作业")
    .sort((a, b) => b.timeMs - a.timeMs)
    .slice(0, 5)
    .map(({ timeMs: _timeMs, ...item }) => item);
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
  const cropCode = toText(detail?.crop_code || program?.crop_code, "-");
  const cropName = toText(detail?.crop_name || program?.crop_name || cropDisplayName(cropCode), "-");
  const cropStage = toText(
    detail?.crop_stage
    || detail?.latest_recommendation?.crop_stage
    || detail?.latest_recommendation?.suggested_action?.parameters?.crop_stage
    || "-",
    "-"
  );
  const stageSummary = toText(
    detail?.crop_stage_summary || detail?.latest_recommendation?.crop_stage_summary,
    cropStageSummary(cropStage)
  );
  const stageGoal = toText(
    detail?.crop_stage_goal || detail?.latest_recommendation?.crop_stage_goal,
    cropStageGoal(cropStage)
  );

  const metricsSource =
    detail?.latest_recommendation?.current_metrics
    ?? detail?.current_metrics
    ?? detail?.latest_metrics
    ?? {};
  const metricsUpdatedAt =
    detail?.latest_recommendation?.current_metrics_updated_at
    ?? detail?.latest_recommendation?.updated_at
    ?? detail?.current_metrics_updated_at
    ?? detail?.latest_metrics_updated_at
    ?? detail?.updated_at
    ?? null;
  const keyMetrics = [
    { label: "土壤湿度", value: metricValueText(metricsSource?.soil_moisture ?? metricsSource?.soil_moisture_pct, "%") },
    { label: "温度", value: metricValueText(metricsSource?.temperature ?? metricsSource?.air_temperature, "℃") },
    { label: "湿度", value: metricValueText(metricsSource?.humidity ?? metricsSource?.air_humidity, "%") },
  ];
  const activeRuleCount = Number(
    detail?.latest_recommendation?.active_rule_count
    ?? detail?.latest_recommendation?.rule_count
    ?? (Array.isArray(detail?.latest_recommendation?.rule_hit) ? detail.latest_recommendation.rule_hit.length : NaN)
  );
  const activeRules = buildActiveRules(detail);
  const recentRecommendations = buildRecentRecommendations(detail, controlPlane);

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
    fieldId: toText(program?.field_id || detail?.field_id, "") || undefined,
    currentOperationPlanId: toText(latestOperation?.operation_plan_id, "") || undefined,
    status: top.status,
    statusLabel: top.label,
    stageLabel: mapProgramStage({ ops, controlPlane, detail }),
    latestActionLabel: latestTimelineItem ? `${formatDateTime(latestTimelineItem.ts)} ${latestTimelineItem.label}` : "暂无最新动作",

    goalSummary: [
      { label: "作物", value: cropName },
      { label: "作物编码", value: cropCode },
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
    cropInsight: {
      cropLabel: cropName,
      cropStage,
      keyMetrics,
      activeRuleCount: Number.isFinite(activeRuleCount) ? activeRuleCount : 0,
    },
    programAgronomy: {
      cropCode,
      cropLabel: cropName,
      cropStage,
      cropStageLabel: cropStageDisplayLabel(cropStage),
      stageSummary,
      stageGoal,
    },
    currentMetrics: {
      soilMoistureLabel: metricValueText(metricsSource?.soil_moisture ?? metricsSource?.soil_moisture_pct, "%"),
      temperatureLabel: metricValueText(metricsSource?.temperature ?? metricsSource?.air_temperature, "℃"),
      humidityLabel: metricValueText(metricsSource?.humidity ?? metricsSource?.air_humidity, "%"),
      updatedAtLabel: formatDateTime(metricsUpdatedAt, "暂无数据"),
    },
    activeRules,
    recentRecommendations,
    timeline,
  };
}
