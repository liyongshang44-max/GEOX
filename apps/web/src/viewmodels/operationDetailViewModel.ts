
import { mapReceiptToVm, type ReceiptEvidenceVm } from "./evidence";

export type OperationStoryTimelineItemVm = {
  id: string;
  kind: string;
  label: string;
  status: string;
  occurredAtLabel: string;
  actorLabel: string;
  summary: string;
  storySummary: string;
};

export type OperationDetailPageVm = {
  actionLabel: string;
  deviceLabel: string;
  technicalRefs: {
    recommendationId: string;
    approvalRequestId: string;
    operationPlanId: string;
    actTaskId: string;
  };
  operationPlanId: string;
  fieldLabel: string;
  programLabel: string;
  statusLabel: string;
  finalStatus: string;
  latestUpdatedAtLabel: string;
  expectedOutcomeLabel: string;
  actualOutcomeLabel: string;
  recommendation: {
    id: string;
    title: string;
    summary: string;
    reasonCodes: string[];
    reasonCodesLabel: string;
    triggerSummary: string;
    createdAtLabel: string;
    ruleConfidenceLabel: string;
    historyEffectivenessLabel: string;
  };
  approval: {
    requestId: string;
    decisionLabel: string;
    actorLabel: string;
    decidedAtLabel: string;
    decisionSummary: string;
  };
  businessEffect: {
    expectedImpact: string;
    riskIfNotExecute: string;
    estimatedGain: string;
  };
  agronomyDecision: {
    cropLabel: string;
    cropStageLabel: string;
    ruleId: string;
    actionLabel: string;
    reasonCodesLabel: string;
    riskIfNotExecute: string;
  };
  recommendationBasis: {
    ruleId: string;
    cropCode: string;
    cropStage: string;
    reasonCodesLabel: string;
    expectedEffectLabel: string;
  };
  expectedEffectCard: {
    effectTypeLabel: string;
    effectValueLabel: string;
    businessSummary: string;
  };
  effectEvaluation: {
    beforeLabel: string;
    afterLabel: string;
    expectedLabel: string;
    actualLabel: string;
    verdictLabel: string;
  };
  effectAssessment: {
    beforeMetricsLabel: string;
    afterMetricsLabel: string;
    actualEffectLabel: string;
    effectVerdictLabel: string;
  };
  ruleExecutionBridge: {
    cropSummary: string;
    stageSummary: string;
    ruleSummary: string;
    recommendationSummary: string;
    operationPlanSummary: string;
  };
  execution: {
    executionModeLabel: string;
    executorTypeLabel: string;
    actionType: string;
    planId: string;
    taskId: string;
    deviceId: string;
    executorLabel: string;
    executionWindowLabel: string;
    dispatchedAtLabel: string;
    ackedAtLabel: string;
    ackStatusLabel: string;
    progressLabel: string;
    finalStatus: string;
    finalStatusLabel: string;
    dispatchedChipLabel: string;
    ackChipLabel: string;
    finalChipLabel: string;
  };
  receiptEvidence?: ReceiptEvidenceVm;
  timeline: OperationStoryTimelineItemVm[];
  evidenceExport: {
    exportableLabel: string;
    latestJobId: string;
    latestJobStatus: string;
    bundleStatusLabel: string;
    latestJobStatusLabel: string;
    latestExportedAtLabel: string;
    latestBundleName: string;
    hasExportableBundle: boolean;
    downloadUrl?: string;
    jumpUrl?: string;
    missingReason: string;
    usageValueLabel: string;
    usageHintLabel: string;
    actionLabel: string;
    photoCount: number;
    metricCount: number;
    logCount: number;
    formalEvidenceCount: number;
    debugEvidenceCount: number;
    onlySimTrace: boolean;
  };
  acceptance: {
    status: "PASS" | "FAIL" | "PENDING";
    statusLabel: string;
    missingEvidenceLabel: string;
    summary: string;
  };
  invalidReason: string;
  customerView: {
    summary: string;
    todayAction: string;
    riskLevel: "low" | "medium" | "high";
    riskLevelLabel: string;
  };
  cost: {
    waterCostLabel: string;
    electricCostLabel: string;
    chemicalCostLabel: string;
    totalCostLabel: string;
  };
};

function toText(v: unknown, fallback = "-"): string {
  if (typeof v === "string") {
    const x = v.trim();
    return x ? repairMojibakeText(x) : fallback;
  }
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return fallback;
}

function repairMojibakeText(input: string): string {
  const text = String(input ?? "");
  if (!text) return text;
  const suspicious = /[ÃÂâ][\x80-\xBF]?|å|ç|æ|ï|ð/.test(text);
  if (!suspicious) return text;
  try {
    const bytes = Uint8Array.from(text, (ch) => ch.charCodeAt(0) & 0xff);
    const repaired = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
    if (/[\u4e00-\u9fff]/.test(repaired)) return repaired;
  } catch {
    return text;
  }
  return text;
}

function toDateLabel(v: unknown): string {
  const raw = typeof v === "number" ? v : Date.parse(String(v ?? ""));
  if (!Number.isFinite(raw)) return "-";
  return new Date(raw).toLocaleString();
}

function toMs(v: unknown): number | null {
  const raw = typeof v === "number" ? v : Date.parse(String(v ?? ""));
  return Number.isFinite(raw) ? raw : null;
}

function countEvidenceItems(value: unknown): number {
  return Array.isArray(value) ? value.length : 0;
}

function toMoneyLabel(v: unknown): string {
  const n = Number(v ?? 0);
  const safe = Number.isFinite(n) ? Math.max(0, n) : 0;
  return `¥${safe.toFixed(2)}`;
}

function mapRiskLevelLabel(level: string): string {
  const key = String(level || "").toLowerCase();
  if (key === "high") return "高";
  if (key === "medium") return "中";
  return "低";
}

function mapRuleConfidenceLabel(raw: unknown): string {
  const key = String(raw ?? "").trim().toLowerCase();
  if (key === "high") return "高";
  if (key === "medium") return "中";
  return "低";
}

function mapHistoryEffectivenessLabel(raw: unknown): string {
  const value = Number(raw ?? NaN);
  if (!Number.isFinite(value)) return "--";
  const normalized = Math.max(0, Math.min(1, value));
  return `${Math.round(normalized * 100)}%`;
}

function mapCropLabel(raw: unknown): string {
  const key = String(raw ?? "").trim().toLowerCase();
  if (key === "corn") return "玉米";
  if (key === "tomato") return "番茄";
  return toText(raw);
}

function mapCropStageLabel(raw: unknown): string {
  const key = String(raw ?? "").trim().toLowerCase();
  if (key === "vegetative") return "营养生长期";
  if (key === "reproductive") return "生殖生长期";
  if (key === "seedling") return "苗期";
  return toText(raw);
}

function mapExpectedEffectTypeLabel(raw: unknown): string {
  const key = String(raw ?? "").trim().toLowerCase();
  if (key === "soil_moisture_delta" || key === "soil_moisture_increase") return "土壤湿度提升";
  if (key === "moisture_increase") return "土壤湿度提升";
  if (key === "growth_boost" || key === "nutrition_boost") return "生长势提升";
  if (key === "canopy_temperature_drop") return "冠层温度下降";
  return toText(raw);
}

function mapExpectedEffectValueLabel(raw: unknown): string {
  const value = Number(raw ?? NaN);
  if (!Number.isFinite(value)) return "-";
  return `${value >= 0 ? "+" : ""}${value.toFixed(0)}%`;
}

function mapPercentLabel(raw: unknown): string {
  const value = Number(raw ?? NaN);
  if (!Number.isFinite(value)) return "--";
  return `${value.toFixed(0)}%`;
}

function mapSignedPercentLabel(raw: unknown): string {
  const value = Number(raw ?? NaN);
  if (!Number.isFinite(value)) return "--";
  return `${value >= 0 ? "+" : ""}${value.toFixed(0)}%`;
}

function mapEffectVerdictLabel(raw: unknown): string {
  const key = String(raw ?? "").trim().toUpperCase();
  if (key === "SUCCESS") return "SUCCESS（达到预期）";
  if (key === "PARTIAL") return "部分达到预期";
  if (key === "FAILED") return "FAILED（未达到预期）";
  if (key === "NO_DATA") return "NO_DATA（暂无效果数据）";
  return "暂无效果数据";
}

function buildSummaryWithCode(label: string, code: unknown): string {
  const codeText = toText(code, "");
  if (!codeText) return label;
  if (label === "-" || !label) return codeText;
  return `${label}（${codeText}）`;
}

function mapStatusLabel(raw: unknown): string {
  const key = String(raw ?? "").toUpperCase().trim();
  if (!key) return "待推进";
  if (key === "READY") return "待执行";
  if (key === "DISPATCHED") return "已下发";
  if (key === "ACKED") return "已确认执行";
  if (key === "SUCCEEDED" || key === "SUCCESS" || key === "EXECUTED") return "执行完成";
  if (key === "FAILED" || key === "ERROR") return "执行失败";
  if (key === "INVALID_EXECUTION") return "执行无效";
  if (key === "PENDING_ACCEPTANCE") return "待验收";
  if (key === "NOT_EXECUTED") return "未执行";
  return toText(raw, "待推进");
}

function normalizeFinalStatusCode(detail: any): string {
  const rawCode = String(detail?.final_status ?? "").trim().toUpperCase();
  if (rawCode) return rawCode;
  const statusLabel = String(detail?.status_label ?? "").trim();
  if (statusLabel.includes("执行无效")) return "INVALID_EXECUTION";
  if (statusLabel.includes("待验收")) return "PENDING_ACCEPTANCE";
  if (statusLabel.includes("执行失败")) return "FAILED";
  if (statusLabel.includes("执行中")) return "RUNNING";
  if (statusLabel.includes("待审批") || statusLabel.includes("待推进")) return "PENDING";
  if (statusLabel.includes("执行成功") || statusLabel.includes("已完成")) return "SUCCESS";
  if (String(detail?.invalid_reason ?? "").trim()) return "INVALID_EXECUTION";
  return "";
}

function resolveExecutionProgress(detail: any): string {
  if (!detail?.approval && !detail?.task) return "暂无执行数据";
  const finalStatus = normalizeFinalStatusCode(detail);
  if (["SUCCEEDED", "SUCCESS", "EXECUTED"].includes(finalStatus)) return "已完成并回传结果";
  if (["FAILED", "ERROR", "NOT_EXECUTED"].includes(finalStatus)) return "执行结束（异常）";

  const ackTs = toMs(detail?.task?.acked_at);
  if (ackTs != null) return "设备已确认，正在执行";

  const dispatchTs = toMs(detail?.task?.dispatched_at);
  if (dispatchTs != null) return "已下发，等待设备确认";

  return "等待下发";
}

function buildExpectedOutcomeLabel(detail: any): string {
  const action = String(detail?.task?.action_type ?? "").toUpperCase();
  if (action.includes("IRRIGATE") || action.includes("IRRIGATION")) {
    return "提升土壤湿度，缓解热胁迫，恢复作物生长状态";
  }
  if (action.includes("SPRAY")) return "降低病虫害风险，稳定作物健康状态";
  if (action.includes("FERTILIZE")) return "补充养分，改善生长势";
  return "完成系统建议的现场动作，并获得可复盘证据";
}

function mapExpectedEffectSummary(effect: any): string {
  const typeLabel = mapExpectedEffectTypeLabel(effect?.type);
  const valueLabel = mapExpectedEffectValueLabel(effect?.value);
  if (typeLabel === "-" && valueLabel === "-") return "暂无预期效果";
  if (valueLabel === "-") return typeLabel;
  return `${typeLabel}（${valueLabel}）`;
}

function buildActualOutcomeLabel(detail: any, receipt?: ReceiptEvidenceVm): string {
  if (!detail?.approval && !detail?.task) return "暂无效果评估";
  const finalStatus = normalizeFinalStatusCode(detail);
  if (finalStatus === "INVALID_EXECUTION") return "⚠️ 执行无效：当前仅收到调试日志或证据不足，无法进入正式验收";
  if (!receipt) {
    return "等待设备回传执行证据";
  }
  if (receipt.constraintCheckLabel === "符合约束") {
    return "现场已回传执行结果，系统判断本次执行符合约束";
  }
  if (receipt.violationSummary && receipt.violationSummary !== "-") {
    return `现场已回传执行结果，但存在复核提示：${receipt.violationSummary}`;
  }
  return "现场已回传执行结果，可继续查看资源消耗与完成时间";
}

function buildBusinessEffect(detail: any, finalStatusCode: string): { expectedImpact: string; riskIfNotExecute: string; estimatedGain: string } {
  if (finalStatusCode === "INVALID_EXECUTION") {
    return {
      expectedImpact: "未产生有效业务效果",
      riskIfNotExecute: "该次作业未形成有效闭环，需尽快补做以避免窗口期损失",
      estimatedGain: "-",
    };
  }
  const serverExpected = toText(detail?.business_effect?.expected_impact, "");
  const serverRisk = toText(detail?.business_effect?.risk_if_not_execute, "");
  const serverGain = toText(detail?.business_effect?.estimated_gain, "-");
  if (serverExpected && serverRisk) {
    return { expectedImpact: serverExpected, riskIfNotExecute: serverRisk, estimatedGain: serverGain || "-" };
  }

  const action = String(detail?.task?.action_type ?? "").toUpperCase();
  if (action.includes("IRRIGATE") || action.includes("IRRIGATION")) {
    return {
      expectedImpact: "预计24-72小时内缓解水分胁迫，稳定作物长势",
      riskIfNotExecute: "土壤含水持续下降，可能导致生长停滞或减产",
      estimatedGain: "减少潜在减产损失",
    };
  }
  if (action.includes("SPRAY")) {
    return {
      expectedImpact: "预计降低病害扩散风险",
      riskIfNotExecute: "病害可能扩散，影响产量与品质",
      estimatedGain: "减少病害扩散导致的品质损失",
    };
  }
  return {
    expectedImpact: "预计改善田间风险暴露并提升作业闭环质量",
    riskIfNotExecute: "风险可能持续累积并带来额外成本损失",
    estimatedGain: "-",
  };
}

function buildEvidenceBundleStatus(evidenceBundle: any): string {
  const hasBundle = Boolean(evidenceBundle?.has_bundle ?? evidenceBundle?.has_exportable_bundle);
  if (hasBundle) return "已生成，可下载与归档";
  const latestJobStatus = String(evidenceBundle?.latest_job_status ?? "").toUpperCase();
  if (latestJobStatus === "RUNNING") return "正在生成证据包";
  return "当前暂不可导出";
}

function resolveAcceptanceStatus(detail: any, receipt?: ReceiptEvidenceVm): "PASS" | "FAIL" | "PENDING" {
  if (!detail?.approval && !detail?.task) return "PENDING";
  const raw = String(
    detail?.acceptance?.verdict
    ?? "",
  ).toUpperCase();
  if (raw.includes("PASS")) return "PASS";
  if (raw.includes("FAIL")) return "FAIL";
  if (receipt?.constraintCheckLabel === "符合约束") return "PASS";
  if (receipt?.constraintCheckLabel === "存在违规") return "FAIL";
  return "PENDING";
}

function normalizeTimelineLabel(raw: unknown): string {
  const label = toText(raw, "");
  if (!label) return "";
  if (label === "assignment accepted") return "accepted";
  if (label === "receipt submitted") return "submitted";
  return label;
}

const STORY_TIMELINE_ORDER = [
  "已生成作业建议",
  "已提交审批",
  "已批准执行",
  "已创建执行计划",
  "已生成执行任务",
  "assignment created",
  "accepted",
  "arrived",
  "已下发设备",
  "设备执行中",
  "submitted",
  "已记录执行回执",
  "acceptance generated",
];

function mapExecutionModeLabel(raw: string): string {
  const key = String(raw || "").toLowerCase();
  if (key === "human" || key === "hybrid") return "人工执行";
  return "设备自动执行";
}

function normalizeAcceptanceMissingEvidence(raw: unknown): string {
  const text = toText(raw, "无");
  if (text.includes("尚未回传执行证据")) return "执行无效：未提供证据，无法完成验收";
  return text;
}

function buildStorySummary(label: string, sourceSummary: string, sourceActor: string, detail: any): string {
  if (sourceSummary !== "-" && sourceSummary !== "等待推进") return sourceSummary;
  const actor = sourceActor !== "-" ? sourceActor : "系统";
  const recommendationSummary = toText(detail?.recommendation?.summary, "暂无建议摘要");
  const deviceId = toText(detail?.task?.device_id, "目标设备");
  const finalStatus = String(detail?.final_status ?? "").toUpperCase();

  switch (label) {
    case "已生成作业建议":
      return `${actor}根据当前田间信号生成作业建议：${recommendationSummary}`;
    case "已提交审批":
      return `${actor}已将本次作业建议提交至审批流，等待管理员确认。`;
    case "已批准执行":
      return `${actor}确认执行本次作业，系统进入执行准备阶段。`;
    case "已创建执行计划":
      return `${actor}已完成执行计划拆解，明确目标设备与执行窗口。`;
    case "已生成执行任务":
      return `${actor}已生成设备任务指令，等待下发至现场执行器。`;
    case "assignment created":
      return `${actor}已创建人工执行单，等待现场人员接单。`;
    case "accepted":
      return `${actor}已接单，准备前往作业点。`;
    case "arrived":
      return `${actor}已到场，开始人工执行。`;
    case "已下发设备":
      return `任务已发送至设备 ${deviceId}，等待设备确认与执行反馈。`;
    case "设备执行中":
      return `${actor}正在执行作业任务，系统持续采集进度与资源消耗。`;
    case "submitted":
      return `${actor}已提交人工执行回执，等待系统归档。`;
    case "acceptance generated":
      return `${actor}已生成验收结论，可据此判断是否闭环。`;
    case "已记录执行回执":
      return `${actor}已回传执行完成回执，并记录资源消耗数据。`;
    case "作业已完成":
      return "本次作业流程已闭环完成，可进行后续审计与复盘。";
    case "作业执行失败":
      return "作业进入失败终态，请核查设备回执与失败原因。";
    default:
      return finalStatus === "PENDING" ? "等待推进" : `${actor}已更新作业状态。`;
  }
}

type CustomerViewStage = "待审批" | "执行中" | "待回执" | "待验收" | "已完成" | "无效执行";

function resolveCustomerViewStage(detail: any): CustomerViewStage {
  const finalStatus = normalizeFinalStatusCode(detail);
  if (finalStatus === "INVALID_EXECUTION") return "无效执行";
  if (!detail?.approval && !detail?.task) return "待审批";
  if (finalStatus === "PENDING_ACCEPTANCE" || detail?.receipt) return "待验收";
  if (["SUCCEEDED", "SUCCESS", "EXECUTED", "DONE"].includes(finalStatus) || detail?.acceptance?.verdict) return "已完成";
  if (detail?.task && !detail?.receipt) return "待回执";
  return "执行中";
}

function customerViewFallbackByStage(stage: CustomerViewStage): { summary: string; todayAction: string; riskLevel: "low" | "medium" | "high" } {
  switch (stage) {
    case "待审批":
      return { summary: "当前建议待审批，尚未进入执行阶段", todayAction: "下一步：等待审批", riskLevel: "medium" };
    case "执行中":
      return { summary: "作业执行中，系统正在持续采集进度", todayAction: "保持设备在线并关注执行状态", riskLevel: "medium" };
    case "待回执":
      return { summary: "作业已下发，等待回执数据", todayAction: "督促执行端回传回执与证据", riskLevel: "medium" };
    case "待验收":
      return { summary: "已收到执行数据，待验收确认", todayAction: "下一步：进入验收", riskLevel: "low" };
    case "已完成":
      return { summary: "作业已完成并形成闭环", todayAction: "继续观察效果并归档证据", riskLevel: "low" };
    case "无效执行":
    default:
      return { summary: "本次作业未被系统认定为有效执行", todayAction: "需重新执行或补充证据", riskLevel: "high" };
  }
}

export function buildOperationDetailViewModel(args?: {
  detail?: any;
}): OperationDetailPageVm {
  const safeArgs = args ?? {};
  const safeDetail = safeArgs.detail ?? {};
  const evidenceBundle = safeDetail?.evidence_bundle ?? {};
  const receiptSource = safeDetail?.receipt;
  const receipt = receiptSource
    ? mapReceiptToVm({ ...receiptSource, status: receiptSource?.receipt_status ?? receiptSource?.status })
    : undefined;

  const rawTimeline = Array.isArray(safeDetail?.timeline) ? safeDetail.timeline : [];
  const timelineSource = rawTimeline.map((item: any, idx: number) => {
    const rawType = String(item?.type ?? item?.kind ?? "").toUpperCase();
    const normalizedLabel = rawType === "ASSIGNMENT_CREATED"
      ? "assignment created"
      : rawType === "ASSIGNMENT_ACCEPTED"
        ? "assignment accepted"
        : rawType === "ASSIGNMENT_ARRIVED"
          ? "arrived"
          : rawType === "RECEIPT_SUBMITTED"
            ? "receipt submitted"
            : rawType === "ACCEPTANCE_GENERATED"
              ? "acceptance generated"
              : toText(item?.label);
    return {
      id: toText(item?.id, `timeline_${idx}`),
      kind: toText(item?.kind ?? item?.type),
      label: normalizedLabel,
      status: toText(item?.status),
      occurredAtLabel: toDateLabel(item?.occurred_at ?? item?.ts),
      occurredAtMs: toMs(item?.occurred_at ?? item?.ts),
      actorLabel: toText(item?.actor_label),
      summary: toText(item?.summary),
    };
  });
  const mergedTimelineSource = [...timelineSource];
  const byLabel = new Map<string, (typeof timelineSource)[number]>();
  mergedTimelineSource.forEach((item) => {
    if (item.label !== "-" && !byLabel.has(item.label)) byLabel.set(item.label, item);
  });

  const timeline: OperationStoryTimelineItemVm[] = STORY_TIMELINE_ORDER.map((label, idx) => {
    const hit = byLabel.get(label);
    const actorLabel = hit?.actorLabel ?? "-";
    const summary = hit?.summary ?? "等待推进";
    return {
      id: hit?.id ?? `story_${idx}`,
      kind: hit?.kind ?? "STORY_STAGE",
      label,
      status: hit?.status ?? "PENDING",
      occurredAtLabel: hit?.occurredAtLabel ?? "-",
      actorLabel,
      summary,
      storySummary: buildStorySummary(label, summary, actorLabel, safeDetail),
    };
  });

  const terminalLabel = ["SUCCEEDED", "SUCCESS"].includes(String(safeDetail?.final_status ?? "").toUpperCase())
    ? "作业已完成"
    : ["FAILED", "ERROR"].includes(String(safeDetail?.final_status ?? "").toUpperCase())
      ? "作业执行失败"
      : "作业状态更新中";
  const terminalSource = mergedTimelineSource.find((x) => x.label === terminalLabel);
  timeline.push({
    id: terminalSource?.id ?? "story_terminal",
    kind: terminalSource?.kind ?? "TERMINAL",
    label: terminalLabel,
    status: toText(safeDetail?.final_status, "PENDING"),
    occurredAtLabel: terminalSource?.occurredAtLabel ?? "-",
    actorLabel: terminalSource?.actorLabel ?? "-",
    summary: terminalSource?.summary ?? (terminalLabel === "作业状态更新中" ? "尚未进入终态" : terminalLabel),
    storySummary: buildStorySummary(
      terminalLabel,
      terminalSource?.summary ?? (terminalLabel === "作业状态更新中" ? "尚未进入终态" : terminalLabel),
      terminalSource?.actorLabel ?? "-",
      safeDetail,
    ),
  });

  const latestTs = mergedTimelineSource
    .map((x) => x.occurredAtMs)
    .filter((x): x is number => Number.isFinite(x))
    .sort((a, b) => b - a)[0] ?? null;

  const ackTs = toMs(safeDetail?.task?.acked_at);
  const dispatchTs = toMs(safeDetail?.task?.dispatched_at);
  const receiptStartTs = toMs(receiptSource?.execution_started_at);
  const receiptEndTs = toMs(receiptSource?.execution_finished_at);
  const windowStart = receiptStartTs ?? dispatchTs;
  const windowEnd = receiptEndTs ?? ackTs;
  const reasonCodes = Array.isArray(safeDetail?.recommendation?.reason_codes)
    ? safeDetail.recommendation.reason_codes.map((x: any) => toText(x)).filter((x: string) => x !== "-")
    : [];
  const reasonCodesLabel = reasonCodes.join(" / ") || "暂无";
  const agronomyReasonCodes = Array.isArray(safeDetail?.agronomy?.reason_codes)
    ? safeDetail.agronomy.reason_codes.map((x: any) => toText(x)).filter((x: string) => x !== "-")
    : [];
  const agronomyReasonCodesLabel = agronomyReasonCodes.join(" / ") || reasonCodesLabel;
  const actualEffectDelta = safeDetail?.agronomy?.actual_effect?.delta ?? safeDetail?.agronomy?.actual_effect?.value;
  const approvalActorLabel = toText(safeDetail?.approval?.actor_label, "系统/未知");
  const approvalDecidedAtLabel = toDateLabel(safeDetail?.approval?.decided_at);
  const ackStatusLabel = ackTs != null ? "已确认" : "待确认";
  const finalStatusCode = normalizeFinalStatusCode(safeDetail);
  const finalStatusLabel = mapStatusLabel(finalStatusCode || (safeDetail?.status_label ?? safeDetail?.final_status));
  const businessEffect = buildBusinessEffect(safeDetail, finalStatusCode);
  const executorKind = String(evidenceBundle?.executor?.kind ?? "").toLowerCase();
  const executionMode = executorKind === "human" ? "human" : executorKind === "hybrid" ? "hybrid" : "device";
  const assignmentExecutor = toText(evidenceBundle?.executor?.id, "未分配");
  const deviceExecutorName = toText(safeDetail?.task?.executor_label, toText(safeDetail?.task?.device_id, "dev_unknown"));
  const humanExecutorName = assignmentExecutor === "未分配" ? "服务队A" : assignmentExecutor;
  const latestJobStatus = Array.isArray(evidenceBundle?.artifacts) && evidenceBundle.artifacts.length > 0 ? "已聚合" : "暂无";
  const hasExportableBundle = Array.isArray(evidenceBundle?.artifacts) && evidenceBundle.artifacts.length > 0;
  const evidenceBundleStatus = buildEvidenceBundleStatus({ has_bundle: hasExportableBundle });
  const acceptanceStatus = resolveAcceptanceStatus(safeDetail, receipt);
  const photoCount = countEvidenceItems(
    safeDetail?.receipt?.photos
    ?? safeDetail?.receipt?.photo_refs
    ?? evidenceBundle?.photos
    ?? evidenceBundle?.photo_refs
  );
  const metricCount = countEvidenceItems(
    safeDetail?.receipt?.metrics
    ?? safeDetail?.receipt?.metric_refs
    ?? evidenceBundle?.metrics
    ?? evidenceBundle?.metric_refs
  );
  const logCount = countEvidenceItems(
    safeDetail?.receipt?.logs
    ?? safeDetail?.receipt?.logs_refs
    ?? evidenceBundle?.logs
    ?? evidenceBundle?.logs_refs
  );
  const evidenceLogs = Array.isArray(evidenceBundle?.logs) ? evidenceBundle.logs : [];
  const simTraceCount = evidenceLogs.filter((x: any) => String(x?.kind ?? "").toLowerCase() === "sim_trace").length;
  const debugEvidenceCount = simTraceCount;
  const formalEvidenceCount = photoCount + metricCount + Math.max(0, logCount - simTraceCount);
  const onlySimTrace = formalEvidenceCount === 0 && debugEvidenceCount > 0;
  const execution = safeDetail?.task
    ? {
      executionModeLabel: executionMode === "device" ? "设备自动执行（灌溉设备）" : `人工执行（${humanExecutorName}）`,
      executorTypeLabel: mapExecutionModeLabel(executionMode),
      actionType: toText(safeDetail?.task?.action_type),
      planId: toText(safeDetail?.operation_plan_id),
      taskId: toText(safeDetail?.task?.task_id),
      deviceId: toText(safeDetail?.task?.device_id),
      executorLabel: executionMode === "device"
        ? `设备 ${deviceExecutorName}`
        : `人工执行（${humanExecutorName}）`,
      executionWindowLabel: windowStart != null
        ? `${new Date(windowStart).toLocaleString()} ~ ${windowEnd != null ? new Date(windowEnd).toLocaleString() : "进行中"}`
        : "-",
      dispatchedAtLabel: toDateLabel(safeDetail?.task?.dispatched_at),
      ackedAtLabel: toDateLabel(safeDetail?.task?.acked_at),
      ackStatusLabel,
      progressLabel: resolveExecutionProgress(safeDetail),
      finalStatus: finalStatusCode || String(safeDetail?.final_status ?? safeDetail?.status_label ?? "").toUpperCase(),
      finalStatusLabel,
      dispatchedChipLabel: `下发时间：${toDateLabel(safeDetail?.task?.dispatched_at)}`,
      ackChipLabel: `确认状态：${ackStatusLabel}`,
      finalChipLabel: `最终结果：${finalStatusLabel}`,
    }
    : {
      executionModeLabel: "尚未执行",
      executorTypeLabel: "-",
      actionType: "",
      planId: "",
      taskId: "",
      deviceId: "",
      executorLabel: "未执行",
      executionWindowLabel: "-",
      dispatchedAtLabel: "-",
      ackedAtLabel: "-",
      ackStatusLabel: "-",
      progressLabel: "尚未执行",
      finalStatus: "PENDING",
      finalStatusLabel: "未执行",
      dispatchedChipLabel: "",
      ackChipLabel: "",
      finalChipLabel: "",
    };
  const cost = safeDetail?.cost
    ? {
      waterCostLabel: toMoneyLabel(safeDetail?.cost?.water),
      electricCostLabel: toMoneyLabel(safeDetail?.cost?.electric),
      chemicalCostLabel: toMoneyLabel(safeDetail?.cost?.chemical),
      totalCostLabel: toMoneyLabel(safeDetail?.cost?.total),
    }
    : {
      waterCostLabel: "-",
      electricCostLabel: "-",
      chemicalCostLabel: "-",
      totalCostLabel: "-",
    };
  const customerViewStage = resolveCustomerViewStage(safeDetail);
  const customerViewFallback = customerViewFallbackByStage(customerViewStage);
  const customerRiskLevel = String(safeDetail?.customer_view?.risk_level ?? customerViewFallback.riskLevel).toLowerCase();
  const normalizedCustomerRiskLevel: "low" | "medium" | "high" = customerRiskLevel === "high" ? "high" : customerRiskLevel === "medium" ? "medium" : customerViewFallback.riskLevel;

  return {
    actionLabel: toText(safeDetail?.task?.action_type, "作业"),
    deviceLabel: toText(safeDetail?.task?.device_id, "未指定设备"),
    technicalRefs: {
      recommendationId: toText(safeDetail?.recommendation?.recommendation_id),
      approvalRequestId: toText(safeDetail?.approval?.approval_request_id),
      operationPlanId: toText(safeDetail?.operation_plan_id),
      actTaskId: toText(safeDetail?.task?.task_id),
    },
    operationPlanId: toText(safeDetail?.operation_plan_id),
    fieldLabel: toText(safeDetail?.field_name, toText(safeDetail?.field_id)),
    programLabel: toText(safeDetail?.program_name, toText(safeDetail?.program_id)),
    statusLabel: mapStatusLabel(finalStatusCode || (safeDetail?.status_label ?? safeDetail?.final_status)),
    finalStatus: toText(finalStatusCode || safeDetail?.final_status),
    latestUpdatedAtLabel: latestTs != null ? new Date(latestTs).toLocaleString() : "-",
    expectedOutcomeLabel: buildExpectedOutcomeLabel(safeDetail),
    actualOutcomeLabel: buildActualOutcomeLabel(safeDetail, receipt),
    recommendation: {
      id: toText(safeDetail?.recommendation?.recommendation_id),
      title: toText(safeDetail?.recommendation?.title, "系统建议"),
      summary: toText(safeDetail?.recommendation?.summary, "暂无建议摘要"),
      reasonCodes,
      reasonCodesLabel,
      triggerSummary: "这些信号共同触发了作业建议。",
      createdAtLabel: toDateLabel(safeDetail?.recommendation?.created_at),
      ruleConfidenceLabel: mapRuleConfidenceLabel(safeDetail?.recommendation?.rule_confidence),
      historyEffectivenessLabel: mapHistoryEffectivenessLabel(safeDetail?.recommendation?.rule_score),
    },
    approval: {
      requestId: toText(safeDetail?.approval?.approval_request_id),
      decisionLabel: toText(safeDetail?.approval?.decision_label, toText(safeDetail?.approval?.decision, "待审批")),
      actorLabel: approvalActorLabel,
      decidedAtLabel: approvalDecidedAtLabel,
      decisionSummary: `由 ${approvalActorLabel} · ${approvalDecidedAtLabel}`,
    },
    businessEffect,
    agronomyDecision: {
      cropLabel: mapCropLabel(safeDetail?.agronomy?.crop_code),
      cropStageLabel: mapCropStageLabel(safeDetail?.agronomy?.crop_stage),
      ruleId: toText(safeDetail?.agronomy?.rule_id),
      actionLabel: toText(safeDetail?.agronomy?.action_label, toText(safeDetail?.task?.action_type, "作业")),
      reasonCodesLabel: agronomyReasonCodesLabel,
      riskIfNotExecute: toText(safeDetail?.agronomy?.risk_if_not_execute, businessEffect.riskIfNotExecute),
    },
    recommendationBasis: {
      ruleId: toText(safeDetail?.agronomy?.rule_id),
      cropCode: toText(safeDetail?.agronomy?.crop_code),
      cropStage: toText(safeDetail?.agronomy?.crop_stage),
      reasonCodesLabel: agronomyReasonCodesLabel,
      expectedEffectLabel: mapExpectedEffectSummary(safeDetail?.agronomy?.expected_effect),
    },
    expectedEffectCard: {
      effectTypeLabel: mapExpectedEffectTypeLabel(safeDetail?.agronomy?.expected_effect?.type),
      effectValueLabel: mapExpectedEffectValueLabel(safeDetail?.agronomy?.expected_effect?.value),
      businessSummary: toText(safeDetail?.agronomy?.expected_effect?.business_summary, businessEffect.expectedImpact),
    },
    effectEvaluation: {
      beforeLabel: mapPercentLabel(safeDetail?.agronomy?.before_metrics?.soil_moisture),
      afterLabel: mapPercentLabel(safeDetail?.agronomy?.after_metrics?.soil_moisture),
      expectedLabel: mapSignedPercentLabel(safeDetail?.agronomy?.expected_effect?.value),
      actualLabel: mapSignedPercentLabel(actualEffectDelta),
      verdictLabel: mapEffectVerdictLabel(safeDetail?.agronomy?.effect_verdict),
    },
    effectAssessment: {
      beforeMetricsLabel: `执行前土壤湿度：${mapPercentLabel(safeDetail?.agronomy?.before_metrics?.soil_moisture)}`,
      afterMetricsLabel: `执行后土壤湿度：${mapPercentLabel(safeDetail?.agronomy?.after_metrics?.soil_moisture)}`,
      actualEffectLabel: `实际效果：${mapSignedPercentLabel(actualEffectDelta)}`,
      effectVerdictLabel: `效果结论：${mapEffectVerdictLabel(safeDetail?.agronomy?.effect_verdict)}`,
    },
    ruleExecutionBridge: {
      cropSummary: buildSummaryWithCode(mapCropLabel(safeDetail?.agronomy?.crop_code), safeDetail?.agronomy?.crop_code),
      stageSummary: buildSummaryWithCode(mapCropStageLabel(safeDetail?.agronomy?.crop_stage), safeDetail?.agronomy?.crop_stage),
      ruleSummary: toText(safeDetail?.agronomy?.rule_id),
      recommendationSummary: toText(safeDetail?.recommendation?.recommendation_id),
      operationPlanSummary: toText(safeDetail?.operation_plan_id),
    },
    execution,
    receiptEvidence: receipt,
    timeline,
    evidenceExport: {
      exportableLabel: hasExportableBundle ? "可导出" : "暂不可导出",
      latestJobId: toText(safeDetail?.operation_plan_id),
      latestJobStatus,
      bundleStatusLabel: evidenceBundleStatus,
      latestJobStatusLabel: `最近任务：${latestJobStatus}`,
      latestExportedAtLabel: latestTs != null ? new Date(latestTs).toLocaleString() : "-",
      latestBundleName: hasExportableBundle ? "内聚证据包" : "暂无证据包",
      hasExportableBundle,
      missingReason: hasExportableBundle ? "无" : "暂无回执证据",
      usageValueLabel: "用于留痕、复验与交付",
      usageHintLabel: `证据件数：${Array.isArray(evidenceBundle?.artifacts) ? evidenceBundle.artifacts.length : 0}`,
      actionLabel: "证据由详情接口统一返回",
      photoCount,
      metricCount,
      logCount,
      formalEvidenceCount,
      debugEvidenceCount,
      onlySimTrace,
    },
    acceptance: {
      status: acceptanceStatus,
      statusLabel: acceptanceStatus,
      missingEvidenceLabel: toText(
        normalizeAcceptanceMissingEvidence(safeDetail?.acceptance?.missing_evidence),
        "无"
      ),
      summary: toText(
        safeDetail?.acceptance?.summary,
        receipt?.violationSummary && receipt.violationSummary !== "-"
          ? receipt.violationSummary
          : receipt
            ? "已回传执行证据，等待最终验收结论。"
            : "等待设备回传执行证据。",
      ),
    },
    invalidReason: toText(safeDetail?.invalid_reason, ""),
    customerView: {
      summary: toText(
        safeDetail?.customer_view?.summary,
        customerViewFallback.summary,
      ),
      todayAction: toText(
        safeDetail?.customer_view?.today_action,
        customerViewFallback.todayAction,
      ),
      riskLevel: normalizedCustomerRiskLevel,
      riskLevelLabel: mapRiskLevelLabel(normalizedCustomerRiskLevel),
    },
    cost,
  };
}
