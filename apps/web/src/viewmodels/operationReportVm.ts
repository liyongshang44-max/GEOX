import type { OperationReportV1 } from "../api/customerReports";
import {
  CUSTOMER_LABELS,
  customerTimelineStatusLabel,
  labelApprovalStatus,
  labelBooleanYesNo,
  labelConfidenceHint,
  labelEmptyFallback,
  labelMemoryCode,
  labelOperationType,
  labelRiskLevel,
  labelValueType,
  sanitizeCustomerText,
} from "../lib/customerLabels";
import { getCustomerEmptyState } from "../lib/customerEmptyStates";
import { buildFormalScenarioVm } from "../lib/formalScenarioViewModel";

const REVIEW_NEEDED_TEXT = "需复核";

const MAIN_VIEW_BLOCK_PATTERNS = [
  /skill\s*run/i,
  /skill_run/i,
  /skill_trace/i,
  /irrigation_soil_moisture_threshold/i,
  /\b[A-Z][A-Z0-9_]{3,}\b/,
];

const EVIDENCE_PRIVATE_TEXT_PATTERNS = [
  /\bsha256\b/i,
  /\bmanifest\b/i,
  /\bdownload\b/i,
  /s3:\/\//i,
  /minio:\/\//i,
  /https?:\/\//i,
  /(^|\s)\/[\w./-]+/,
  /[A-Z]:\\[\w\\.-]+/i,
];

export type OperationEvidenceSummaryState = "NO_EVIDENCE" | "RECORDS_WITHOUT_SUMMARY" | "PACK_SUMMARY";

export type OperationEvidenceSummaryVm = {
  state: OperationEvidenceSummaryState;
  statusText: string;
  summary: string;
  detail: string;
  sourceText: string;
  privacyText: string;
  items: Array<{ label: string; value: string }>;
};

export type OperationReportPageVm = {
  generatedAtText: string;
  operation: { operationId: string; title: string; fieldName: string; fieldId: string; finalStatusLabel: string; finalStatusTone: string; updatedAtText: string };
  sections: CustomerReportSectionVm[];
  timeline: Array<{ key: string; label: string; status: "DONE" | "AVAILABLE" | "PENDING" | "MISSING" | "NOT_APPLICABLE"; timeText?: string }>;
  exportHref: string;
  technicalFoldout?: { rows: Array<{ label: string; value: string }> };
  header: { title: string; subtitle: string; internalId: string };
  why: { summary: string; riskLabel: string; reasonText: string };
  approval: { statusText: string; actorText: string; timeText: string; noteText: string; available: boolean };
  execution: { ownerText: string; startedAtText: string; finishedAtText: string; invalidExecutionText: string; statusText: string };
  evidence: {
    executionReceipt: string;
    executionRecord: string;
    postIrrigationMonitoring: string;
    onSitePhotos: string;
    acceptanceItems: string;
    hasAnyMissing: boolean;
    artifactsText: string;
    logsText: string;
    mediaText: string;
    metricsText: string;
  };
  evidenceSummary: OperationEvidenceSummaryVm;
  acceptance: { statusText: string; verdictText: string; missingEvidenceText: string; generatedAtText: string };
  value: { valueText: string; methodText: string; evidenceText: string; confidenceText: string; fallbackText: string; useFallback: boolean };
  conclusion: { finalStatusText: string; resultText: string };
  fieldMemory: { title: string; items: string[] };
  roiLedger: { title: string; items: string[]; confidenceText: string };
  drawerRefs: { prescriptionId: string; recommendationId: string; operationId: string; fieldId: string };
  // customer-boundary-allow: debug 字段仅用于导出技术折叠，不进入主叙事
  debug: {
    operationPlanId: string; operationId: string; actTaskId: string; receiptId: string; recommendationId: string; workflowOwnerId: string; workflowOwnerName: string; workflowUpdatedAt: string; workflowLastNote: string;
    sla: { responseTimeMs: string; dispatchLatency: string; executionDuration: string; acceptanceLatency: string; invalidReasons: string };
  };
};

export type CustomerReportSectionStatus = "AVAILABLE" | "MISSING" | "PENDING" | "NOT_APPLICABLE";
export type CustomerReportSectionVm = {
  key: "RECOMMENDATION" | "PRESCRIPTION" | "APPROVAL" | "EXECUTION" | "EVIDENCE" | "ACCEPTANCE" | "ROI" | "MEMORY";
  status: CustomerReportSectionStatus;
  title: string;
  summary: string;
  items: Array<{ label: string; value: string; tone?: string }>;
  emptyState?: { title: string; description: string };
  statusText?: string;
  technical?: { title: string; rows: Array<{ label: string; value: string }> };
};


function formatCustomerDateTime(value: unknown, fallback = "暂无更新时间"): string {
  const raw = String(value ?? "").trim();
  if (!raw) return fallback;
  const ms = Date.parse(raw);
  if (!Number.isFinite(ms) || ms <= 0) return fallback;
  const d = new Date(ms);
  if (d.getUTCFullYear() <= 1970) return fallback;
  return d.toLocaleString("zh-CN", { hour12: false });
}

function isEngineeringOnlyText(value: unknown): boolean {
  const text = String(value ?? "").trim();
  if (!text) return false;
  return MAIN_VIEW_BLOCK_PATTERNS.some((pattern) => pattern.test(text));
}

function kv(value: unknown, fallback = "暂无记录"): string {
  const text = labelEmptyFallback(value, fallback);
  if (["--", "NaN", "undefined", "null"].includes(text)) return fallback;
  const ms = Date.parse(text);
  if (Number.isFinite(ms) && ms <= 0) return "暂无更新时间";
  if (Number.isFinite(ms) && new Date(ms).getUTCFullYear() <= 1970) return "暂无更新时间";
  return text;
}


function firstUsableId(...values: unknown[]): string {
  for (const value of values) {
    const raw = String(value ?? "").trim();
    if (raw && raw !== "--" && raw !== "暂无记录") return raw;
  }
  return "";
}

function toNum(v: unknown): number | null {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function positiveCount(v: unknown): number {
  const n = toNum(v);
  return n != null && n > 0 ? n : 0;
}

function countStatus(value: unknown): string {
  return positiveCount(value) > 0 ? "已采集" : "暂无记录";
}

function evidenceObjectSummary(value: unknown): string {
  if (!value || typeof value !== "object") return "";
  const obj = value as Record<string, unknown>;
  const candidate = obj.customer_text ?? obj.summary_text ?? obj.summary ?? obj.text ?? obj.description;
  if (candidate != null) return sanitizeEvidenceText(candidate);
  return "";
}

function sanitizeEvidenceText(value: unknown): string {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeEvidenceText(item)).filter(Boolean).join("；");
  }
  if (value && typeof value === "object") return evidenceObjectSummary(value);
  const text = String(value ?? "").trim();
  if (!text || text === "--" || text === "[object Object]") return "";
  if (EVIDENCE_PRIVATE_TEXT_PATTERNS.some((pattern) => pattern.test(text))) {
    return "证据包摘要已形成，文件明细已隐藏。";
  }
  return sanitizeCustomerText(text, "");
}

function evidenceTextOrFallback(value: unknown, fallback: string): string {
  return sanitizeEvidenceText(value) || fallback;
}

function mapEvidenceStatusLabel(value: unknown): string {
  const count = toNum(value);
  if (count == null) return "需复核";
  if (count <= 0) return "缺失";
  return "已采集";
}

function backendChainValidation(report: OperationReportV1): any {
  return (report as any).chain_validation ?? (report as any).guarded_projection ?? null;
}

function backendChainPassed(report: OperationReportV1): boolean {
  const chain_validation = backendChainValidation(report);
  const visible = (report as any).customer_visible_eligible;
  return chain_validation?.passed === true && visible !== false;
}

function backendNeedsReview(report: OperationReportV1): boolean {
  return !backendChainPassed(report) || (report as any).needs_review === true;
}

export function buildOperationEvidenceSummaryVm(report: OperationReportV1): OperationEvidenceSummaryVm {
  const evidence = report.evidence ?? {
    artifacts_count: 0,
    logs_count: 0,
    media_count: 0,
    metrics_count: 0,
    receipt_present: false,
    acceptance_present: false,
  };
  const chainPassed = backendChainPassed(report);
  const recordCount = positiveCount(evidence.artifacts_count) + positiveCount(evidence.logs_count) + positiveCount(evidence.media_count) + positiveCount(evidence.metrics_count);
  const hasEvidenceRecords = chainPassed && recordCount > 0;
  const packSummary = (report as unknown as { evidence_pack_summary?: { summary?: unknown; photos_logs_metrics_trace_summary?: unknown; status?: unknown; insufficient_reason?: unknown } }).evidence_pack_summary;
  const summaryText = chainPassed ? sanitizeEvidenceText(packSummary?.photos_logs_metrics_trace_summary ?? packSummary?.summary) : "";
  const sourceText = "证据来源：作业报告摘要";
  const privacyText = "客户层仅展示证据摘要，不展示内部存储路径或文件校验信息。";

  if (!hasEvidenceRecords && !summaryText) {
    return {
      state: "NO_EVIDENCE",
      statusText: chainPassed ? "暂无证据" : "需复核",
      summary: chainPassed ? "暂无有效证据。" : "该证据链尚未通过后端正式链路校验。",
      detail: chainPassed ? "当前未查询到可用于验收的证据记录。" : "执行回执或验收记录存在也不能单独证明证据包完整，需等待正式链路校验通过。",
      sourceText,
      privacyText,
      items: [],
    };
  }

  if (!summaryText) {
    return {
      state: "RECORDS_WITHOUT_SUMMARY",
      statusText: "证据已记录",
      summary: "已有证据记录，暂无证据包摘要。",
      detail: "证据包摘要能力尚未接入，当前只展示报告内嵌证据记录。",
      sourceText,
      privacyText,
      items: [
        { label: "执行回执", value: countStatus(evidence.artifacts_count) },
        { label: "执行记录", value: countStatus(evidence.logs_count) },
        { label: "现场照片", value: countStatus(evidence.media_count) },
        { label: "监测数据", value: countStatus(evidence.metrics_count) },
        { label: "验收记录", value: "以后端链路校验为准" },
      ],
    };
  }

  return {
    state: "PACK_SUMMARY",
    statusText: "证据包已形成",
    summary: "证据包已形成，可查看摘要。",
    detail: "当前展示客户可读证据包摘要，不提供文件下载入口。",
    sourceText,
    privacyText,
    items: [
      { label: "证据包摘要", value: summaryText },
      { label: "证据状态", value: evidenceTextOrFallback(packSummary?.status, "已形成") },
      { label: "证据不足说明", value: evidenceTextOrFallback(packSummary?.insufficient_reason, "暂无补充说明") },
    ],
  };
}

export function mapOperationStatusToCustomerLabel(value: unknown): string {
  const status = String(value ?? "").trim().toUpperCase();
  if (!status) return "待确认";
  if (["SUCCESS", "DONE", "COMPLETED", "APPROVED", "PASS", "VALID"].includes(status)) return "已完成";
  if (["FAILED", "REJECTED", "ERROR", "INVALID", "INVALID_EXECUTION"].includes(status)) return "异常";
  if (["PENDING", "WAITING", "QUEUED", "RUNNING", "IN_PROGRESS", "PENDING_ACCEPTANCE"].includes(status)) return "进行中";
  return "待确认";
}

function joinReasonTexts(reasons: string[]): string {
  if (!Array.isArray(reasons) || reasons.length === 0) return "暂无明确风险原因";
  return reasons.map((item) => labelEmptyFallback(item)).join("、");
}

function formatMemoryLine(item: any): string {
  const before = toNum(item?.before_value);
  const after = toNum(item?.after_value);
  const min = toNum(item?.target_range?.min);
  const max = toNum(item?.target_range?.max);
  const hasTargetRange = min != null || max != null;
  let statusText = "湿度变化待确认";
  if (hasTargetRange) {
    const hitMin = min == null || (after != null && after >= min);
    const hitMax = max == null || (after != null && after <= max);
    statusText = hitMin && hitMax ? "达到目标区间" : "未达到目标区间";
  } else if (before != null && after != null) {
    statusText = after > before ? "湿度已回升" : "湿度未回升";
  }
  return `${labelMemoryCode(item?.memory_code ?? item?.code ?? item?.memory_type)}：${labelEmptyFallback(item?.summary_text, "地块响应记录")}（灌前${before ?? "待生成"} → 灌后${after ?? "待生成"}，${statusText}）`;
}

function mapApprovalStatusForCustomer(value: unknown): string {
  const raw = String(value ?? "").trim();
  const normalized = raw.toUpperCase();
  if (!raw) return "暂无记录";
  if (normalized.includes("AUTO")) return "系统自动状态";
  return labelApprovalStatus(raw);
}

function mapSlaQuality(value: unknown, rawMs: unknown): string {
  const quality = String(value ?? "").trim().toUpperCase();
  if (quality === "VALID") return kv(rawMs);
  if (quality === "MISSING_DATA") return "缺失";
  if (quality === "INVALID_ORDER") return "执行异常";
  return "暂无记录";
}

export function buildOperationReportVm(report: OperationReportV1): OperationReportPageVm {
  const formalScenarioVm = buildFormalScenarioVm(report);
  const chain_validation = backendChainValidation(report);
  const chainPassed = backendChainPassed(report);
  const needsReview = backendNeedsReview(report);
  const trustLevel = String((report as any).trust_level ?? (report as any).guarded_projection?.trust_level ?? "").trim();
  const finalStatusText = formalScenarioVm.chainText;
  const acceptanceStatusText = formalScenarioVm.acceptanceText;
  const riskLabel = labelRiskLevel(report.risk.level);
  const reasonText = joinReasonTexts(report.risk.reasons);
  const reportWhy = (report as any).why ?? null;
  const reportApproval = (report as any).approval ?? null;
  const memory = chainPassed ? ((report as any).field_memory ?? {}) : {};
  const roi = chainPassed ? ((report as any).roi_ledger ?? {}) : {};
  const recommendationData = (report as any).recommendation ?? null;
  const recommendationReason = kv(recommendationData?.reason ?? reportWhy?.objective_text, "--");
  const explainText = kv(recommendationData?.explain ?? reportWhy?.explain_human, "--");
  const recommendationSummary = kv(recommendationData?.data_summary ?? recommendationData?.summary ?? reportWhy?.objective_text, "--");
  const hasRecommendationData = [recommendationReason, explainText, riskLabel, recommendationSummary].some((value) => value !== "--");

  const prescriptionData = (report as any).prescription ?? null;
  const prescriptionItems: Array<{ label: string; value: string }> = [];
  const pushPrescription = (label: string, value: unknown) => {
    const text = kv(value, "--");
    if (text !== "--") prescriptionItems.push({ label, value: text });
  };
  pushPrescription("做什么", prescriptionData?.action ?? prescriptionData?.operation_type);
  pushPrescription("在哪里做", prescriptionData?.location ?? prescriptionData?.spatial_scope);
  pushPrescription("做多少", prescriptionData?.amount ?? prescriptionData?.operation_amount);
  pushPrescription("何时做", prescriptionData?.timing ?? prescriptionData?.timing_window);
  pushPrescription("设备要求", prescriptionData?.device_requirements);
  pushPrescription("风险等级", prescriptionData?.risk_level ?? prescriptionData?.risk);
  pushPrescription("验收条件", prescriptionData?.acceptance_conditions);
  const hasPrescriptionData = prescriptionItems.length > 0;

  const executionData = (report as any).execution ?? {};
  const asExecutedData = chainPassed ? ((report as any).as_executed ?? null) : null;
  const asAppliedData = chainPassed ? ((report as any).as_applied ?? null) : null;
  const operationType = String((report as any).operation_type ?? prescriptionData?.operation_type ?? "").trim().toUpperCase();
  const isVariableOperation = operationType.includes("VARIABLE");
  const executionTarget = kv(asExecutedData?.operation_id ?? asExecutedData?.target ?? asExecutedData?.execution_target ?? executionData?.target, "--");
  const executorText = kv(
    asExecutedData?.operator_id
    ?? asExecutedData?.device_id
    ?? asExecutedData?.executor
    ?? asExecutedData?.actor
    ?? report.workflow.owner_name,
    "--",
  );
  const executionParamsText = kv(asExecutedData?.actual_params ?? asExecutedData?.params_summary ?? asExecutedData?.parameters, "--");
  const asExecutedSummary = kv(asExecutedData?.deviation_summary ?? asExecutedData?.summary ?? asExecutedData?.result_summary, "--");
  const asAppliedCoverageStatus = String(asAppliedData?.coverage_status ?? "").trim().toUpperCase();
  const hasCoverageGeoJson = Boolean(asAppliedData?.coverage_geojson);
  const hasDeviationEvidenceRef = Boolean(String(asAppliedData?.evidence_ref ?? "").trim());
  const deviationText = hasDeviationEvidenceRef ? kv(asAppliedData?.planned_vs_actual_deviation, "--") : "待补充证据来源";
  const asAppliedSummary = !isVariableOperation
    ? "该作业不适用覆盖记录"
    : (asAppliedCoverageStatus === "AVAILABLE" && hasCoverageGeoJson
      ? kv(asAppliedData?.applied_amount_summary ?? asAppliedData?.summary, "已记录覆盖")
      : "暂无覆盖记录");
  const hasAsExecuted = Boolean(
    chainPassed
    && asExecutedData
    && (
      asExecutedData?.started_at
      || asExecutedData?.finished_at
      || asExecutedData?.operation_id
      || asExecutedData?.actual_params
      || asExecutedData?.device_id
      || asExecutedData?.operator_id
    ),
  );

  const evidenceSummary = buildOperationEvidenceSummaryVm(report);

  const valueItems = chainPassed ? [
    ...((roi.water_saved ?? []).slice(0, 1)),
    ...((roi.labor_saved ?? []).slice(0, 1)),
    ...((roi.early_warning_lead_time ?? []).slice(0, 1)),
    ...((roi.first_pass_acceptance_rate ?? []).slice(0, 1)),
    ...((roi.items ?? []).slice(0, 1)),
  ] : [];
  const valueItem = valueItems[0] ?? null;
  const valueNumber = toNum(valueItem?.delta_value);
  const valueUnit = labelEmptyFallback(valueItem?.unit, "");
  const baselineValue = toNum(valueItem?.baseline_value);
  const evidenceNote = kv(valueItem?.customer_text, "--");
  const hasEvidenceNote = evidenceNote !== "--";
  const roiValueType = labelValueType(valueItem?.value_type ?? valueItem?.value_kind);
  const confidenceText = labelConfidenceHint((roi.low_confidence_items ?? [])[0]?.confidence?.score ?? valueItem?.confidence?.score);
  const isAssumption = /假设|assumption/i.test(String(valueItem?.value_type ?? valueItem?.value_kind ?? "")) || /假设|可信度有限/.test(confidenceText);
  const isMeasured = baselineValue != null && hasEvidenceNote && !isAssumption;
  const roiNatureText = isMeasured ? "实测" : (isAssumption ? "假设" : "估算");
  const valueText = valueNumber == null ? REVIEW_NEEDED_TEXT : `${valueNumber}${valueUnit}`;
  const methodText = kv(valueItem?.calculation_method, REVIEW_NEEDED_TEXT);
  const useFallback = valueNumber == null || !hasEvidenceNote || baselineValue == null;

  const fieldResponseSummary = (memory.field_response_memory ?? []).slice(0, 1).map(formatMemoryLine)[0] ?? "--";
  const deviceReliabilitySummary = (memory.device_reliability_memory ?? []).slice(0, 1).map((item: any) => kv(item?.summary_text, "--"))[0] ?? "--";
  const skillPerformanceSummary = (memory.skill_performance_memory ?? []).slice(0, 1).map((item: any) => kv(item?.summary_text, "--"))[0] ?? "--";
  const sanitizedSkillPerformanceSummary = skillPerformanceSummary !== "--" && isEngineeringOnlyText(skillPerformanceSummary)
    ? "暂无可展示的技能表现摘要"
    : skillPerformanceSummary;
  const hasMemoryData = chainPassed && [fieldResponseSummary, deviceReliabilitySummary, sanitizedSkillPerformanceSummary].some((item) => item !== "--");
  const memoryItems = hasMemoryData
    ? [
      { label: "本次结果是否进入田块记忆", value: kv(memory?.ingested ?? memory?.recorded ?? memory?.entered, "--") },
      { label: "历史响应摘要", value: fieldResponseSummary },
      { label: "设备可靠性摘要", value: deviceReliabilitySummary },
      { label: "技能表现摘要", value: sanitizedSkillPerformanceSummary },
    ]
    : [];

  const rawSections: CustomerReportSectionVm[] = [
    { key: "RECOMMENDATION", status: hasRecommendationData ? "AVAILABLE" : "MISSING", title: "建议", summary: hasRecommendationData ? recommendationReason : "暂无正式建议记录", items: hasRecommendationData ? [{ label: "建议原因", value: recommendationReason }, { label: "农艺解释", value: explainText }, { label: "风险等级", value: riskLabel }, { label: "数据依据摘要", value: recommendationSummary }] : [], emptyState: hasRecommendationData ? undefined : { title: "暂无正式建议记录", description: "当前缺少建议、解释或风险依据。" } },
    { key: "PRESCRIPTION", status: hasPrescriptionData ? "AVAILABLE" : "MISSING", title: "处方", summary: hasPrescriptionData ? "已形成正式处方" : "未形成正式处方", items: prescriptionItems, emptyState: hasPrescriptionData ? undefined : { title: "未形成正式处方", description: "当前没有正式处方记录。" } },
    { key: "APPROVAL", status: reportApproval ? "AVAILABLE" : "MISSING", title: "审批", summary: reportApproval ? mapApprovalStatusForCustomer(reportApproval?.status) : "审批记录暂不可用", items: reportApproval ? [{ label: "审批状态", value: mapApprovalStatusForCustomer(reportApproval?.status) }, { label: "审批人", value: kv(reportApproval?.actor_name, "--") }, { label: "审批时间", value: kv(reportApproval?.approved_at || reportApproval?.generated_at, "--") }, { label: "审批意见", value: kv(reportApproval?.note, "--") }] : [], emptyState: reportApproval ? undefined : { title: "审批记录暂不可用", description: "当前尚未生成可展示的审批记录。" } },
    { key: "EXECUTION", status: hasAsExecuted ? "AVAILABLE" : "MISSING", title: "执行", summary: hasAsExecuted ? formalScenarioVm.chainText : "暂无实际执行记录", items: hasAsExecuted ? [{ label: "执行对象", value: executionTarget }, { label: "人/设备", value: executorText }, { label: "开始时间", value: kv(asExecutedData?.started_at ?? report.execution.execution_started_at, "--") }, { label: "结束时间", value: kv(asExecutedData?.finished_at ?? report.execution.execution_finished_at, "--") }, { label: "执行参数", value: executionParamsText }, { label: "执行摘要", value: asExecutedSummary }, { label: "覆盖状态", value: kv(asAppliedData?.coverage_status, !isVariableOperation ? "NOT_APPLICABLE" : "MISSING") }, { label: "覆盖记录", value: asAppliedSummary }, { label: "计划-实际偏差", value: deviationText }, { label: "偏差证据来源", value: kv(asAppliedData?.evidence_ref, "--") }] : [], emptyState: hasAsExecuted ? undefined : { title: "暂无实际执行记录", description: needsReview ? "后端链路校验未通过，执行记录暂不作为客户正式结论。" : "当前尚无实际执行记录。" } },
    { key: "EVIDENCE", status: evidenceSummary.state === "PACK_SUMMARY" ? "AVAILABLE" : (evidenceSummary.state === "RECORDS_WITHOUT_SUMMARY" ? "PENDING" : "MISSING"), title: "证据", summary: evidenceSummary.summary, items: evidenceSummary.items, emptyState: evidenceSummary.state === "PACK_SUMMARY" ? undefined : { title: evidenceSummary.summary, description: evidenceSummary.detail } },
    { key: "ACCEPTANCE", status: chainPassed && report.acceptance.generated_at ? "AVAILABLE" : "PENDING", title: "验收", summary: acceptanceStatusText, items: chainPassed && report.acceptance.generated_at ? [{ label: "验收结论", value: acceptanceStatusText }, { label: "验收依据", value: kv(report.acceptance.verdict, "--") }, { label: "未通过原因", value: report.acceptance.status === "FAIL" ? kv(report.execution.invalid_reason, "--") : "--" }, { label: "证据不足原因", value: Array.isArray(report.acceptance.missing_items) && report.acceptance.missing_items.length ? report.acceptance.missing_items.map((item) => labelEmptyFallback(item)).join("、") : "--" }, { label: "复核提示", value: report.acceptance.missing_evidence ? "证据不足，建议补齐后复核" : "--" }] : [], emptyState: chainPassed && report.acceptance.generated_at ? undefined : { title: REVIEW_NEEDED_TEXT, description: "验收结论需以后端正式链路校验为准。" } },
    { key: "ROI", status: valueNumber == null ? "MISSING" : "AVAILABLE", title: "价值记录", summary: valueNumber == null ? "暂无可量化价值记录" : `${roiNatureText} · ${valueText}`, items: valueNumber == null ? [] : [{ label: "价值类型", value: roiValueType }, { label: "实测/估算/假设", value: roiNatureText }, { label: "数值摘要", value: valueText }, { label: "可信度", value: confidenceText }, { label: "证据说明", value: evidenceNote }], emptyState: valueNumber == null ? { title: "暂无可量化价值记录", description: chainPassed ? "当前未形成可审计价值记录。" : "后端链路校验未通过，价值记录暂不作为客户可信收益。" } : undefined },
    { key: "MEMORY", status: hasMemoryData ? "AVAILABLE" : "MISSING", title: "记忆", summary: hasMemoryData ? "已生成记忆摘要" : "暂无可展示的田块记忆", items: memoryItems, emptyState: hasMemoryData ? undefined : { title: "暂无可展示的田块记忆", description: chainPassed ? "当前没有可复用记忆条目。" : "后端链路校验未通过，田块记忆暂不作为客户学习闭环。" } },
  ];
  const sections = rawSections.map((section) => ({ ...section, statusText: customerTimelineStatusLabel(section.status) }));
  const timeline = sections.map((s) => ({ key: s.key, label: s.title, status: s.status === "AVAILABLE" ? "DONE" as const : (s.status === "PENDING" ? "PENDING" as const : s.status === "MISSING" ? "MISSING" as const : "NOT_APPLICABLE" as const) }));
  // customer-boundary-allow: 兼容历史 operation_plan_id 字段映射为客户可读内部编号
  const internalId = kv(report.identifiers.operation_id || report.identifiers.operation_plan_id);
  const operationTitle = kv((report as any).customer_title || (report as any).operation_title || labelOperationType((report as any).operation_type), CUSTOMER_LABELS.operationReportTitle);

  return {
    generatedAtText: formatCustomerDateTime(report.generated_at),
    operation: {
      // customer-boundary-allow: 兼容历史 operation_plan_id 字段映射为客户作业标识
      operationId: kv(report.identifiers.operation_id || report.identifiers.operation_plan_id),
      title: operationTitle,
      fieldName: kv((report as any).field_name, "地块"),
      fieldId: kv((report as any).field_id ?? report.identifiers.field_id, "--"),
      finalStatusLabel: finalStatusText,
      finalStatusTone: /异常|失败/.test(finalStatusText) ? "danger" : (/等待|进行中|复核/.test(finalStatusText) ? "warning" : "neutral"),
      updatedAtText: kv(report.workflow.updated_at),
    },
    sections,
    timeline,
    // customer-boundary-allow: 导出链接兼容历史 operation_plan_id 字段
    exportHref: `/customer/operations/${encodeURIComponent(kv(report.identifiers.operation_id || report.identifiers.operation_plan_id))}/export`,
    technicalFoldout: { rows: [
      { label: "operation_id", value: kv(report.identifiers.operation_id) },
      // customer-boundary-allow: 技术折叠需兼容 recommendation_id 便于运营排查
      { label: "recommendation_id", value: kv(report.identifiers.recommendation_id) },
      { label: "prescription_id", value: kv((report.identifiers as any).prescription_id ?? prescriptionData?.prescription_id) },
      { label: "approval_request_id", value: kv(report.identifiers.approval_id ?? reportApproval?.request_id) },
      { label: "act_task_id", value: kv(report.identifiers.act_task_id) },
      // customer-boundary-allow: 技术折叠需兼容 receipt_id 便于运营排查
      { label: "receipt_id", value: kv(report.identifiers.receipt_id) },
      { label: "acceptance_id", value: kv((report as any).acceptance?.acceptance_id ?? (report as any).acceptance_id) },
      { label: "roi_id", value: kv((report as any).roi_ledger?.roi_id ?? valueItem?.roi_id) },
      { label: "memory_id", value: kv((report as any).field_memory?.memory_id) },
      { label: "chain_validation", value: kv(chain_validation ? JSON.stringify(chain_validation) : "--") },
      { label: "trust_level", value: kv(trustLevel, "--") },
      // customer-boundary-allow: 技术折叠需兼容 trace_id 相关字段用于诊断
      { label: "skill_trace_ref", value: kv(recommendationData?.skill_trace_ref ?? recommendationData?.skillTraceRef ?? report.identifiers.skill_trace_id ?? (report as any).field_memory?.skill_trace_ref) },
      { label: "skill_run_id", value: kv(recommendationData?.skill_run_id ?? recommendationData?.skillRunId ?? (report as any).skill_run_id) },
      { label: "skill_output", value: kv(recommendationData?.skill_output ?? (report as any).skill_output) },
      { label: "raw_enum", value: kv((report as any).raw_enum ?? (report as any).status_enum ?? report.execution.final_status) },
    ] },
    header: { title: operationTitle, subtitle: finalStatusText, internalId },
    why: { summary: `${kv(reportWhy?.explain_human, `当前作业用于处理本次地块作业需求，目标是降低${riskLabel}相关问题并完成闭环处置。`)}｜${formalScenarioVm.scenarioLabel}｜${formalScenarioVm.chainText}｜${formalScenarioVm.evidenceText}`, riskLabel, reasonText: kv(reportWhy?.objective_text, reasonText) },
    approval: { statusText: reportApproval ? mapApprovalStatusForCustomer(reportApproval?.status) : "待确认", actorText: kv(reportApproval?.actor_name, "--"), timeText: kv(reportApproval?.approved_at || reportApproval?.generated_at, "--"), noteText: kv(reportApproval?.note, "--"), available: Boolean(reportApproval) },
    execution: { ownerText: kv(report.workflow.owner_name || report.workflow.owner_actor_id), startedAtText: chainPassed ? kv(report.execution.execution_started_at) : REVIEW_NEEDED_TEXT, finishedAtText: chainPassed ? kv(report.execution.execution_finished_at) : REVIEW_NEEDED_TEXT, invalidExecutionText: labelBooleanYesNo(report.execution.invalid_execution), statusText: formalScenarioVm.chainText },
    evidence: {
      executionReceipt: chainPassed ? mapEvidenceStatusLabel(report.evidence.artifacts_count) : REVIEW_NEEDED_TEXT,
      executionRecord: chainPassed ? mapEvidenceStatusLabel(report.evidence.logs_count) : REVIEW_NEEDED_TEXT,
      postIrrigationMonitoring: chainPassed ? mapEvidenceStatusLabel(report.evidence.metrics_count) : REVIEW_NEEDED_TEXT,
      onSitePhotos: chainPassed ? mapEvidenceStatusLabel(report.evidence.media_count) : REVIEW_NEEDED_TEXT,
      acceptanceItems: chainPassed ? (report.acceptance.missing_evidence ? "需复核" : "无缺失") : REVIEW_NEEDED_TEXT,
      hasAnyMissing: Boolean(report.acceptance.missing_evidence || needsReview),
      artifactsText: chainPassed ? mapEvidenceStatusLabel(report.evidence.artifacts_count) : REVIEW_NEEDED_TEXT,
      logsText: chainPassed ? mapEvidenceStatusLabel(report.evidence.logs_count) : REVIEW_NEEDED_TEXT,
      mediaText: chainPassed ? mapEvidenceStatusLabel(report.evidence.media_count) : REVIEW_NEEDED_TEXT,
      metricsText: chainPassed ? mapEvidenceStatusLabel(report.evidence.metrics_count) : REVIEW_NEEDED_TEXT,
    },
    evidenceSummary,
    acceptance: { statusText: acceptanceStatusText, verdictText: chainPassed ? kv(report.acceptance.verdict, "--") : REVIEW_NEEDED_TEXT, missingEvidenceText: report.acceptance.missing_evidence || needsReview ? REVIEW_NEEDED_TEXT : "无", generatedAtText: chainPassed ? formatCustomerDateTime(report.acceptance.generated_at) : REVIEW_NEEDED_TEXT },
    value: { valueText, methodText, evidenceText: chainPassed ? evidenceNote : REVIEW_NEEDED_TEXT, confidenceText, fallbackText: chainPassed ? "本次作业的量化价值仍在积累中，当前可确认价值为：作业完成并完成验收。" : "后端正式链路校验未通过，当前不展示可信收益。", useFallback: useFallback || !chainPassed },
    conclusion: { finalStatusText, resultText: [formalScenarioVm.acceptanceText, formalScenarioVm.failSafeText, formalScenarioVm.manualTakeoverText, formalScenarioVm.zoneSummaryText].filter(Boolean).join("｜") || finalStatusText },
    fieldMemory: { title: "田块记忆", items: hasMemoryData ? memoryItems.map((item) => item.value) : [chainPassed ? getCustomerEmptyState("NO_FIELD_MEMORY").title : "后端链路校验未通过，暂不进入客户学习闭环"] },
    roiLedger: { title: "", items: [], confidenceText },
    drawerRefs: {
      prescriptionId: firstUsableId((report.identifiers as any).prescription_id, prescriptionData?.prescription_id, (report as any).prescription_id),
      // customer-boundary-allow: drawerRefs 需兼容 recommendation_id 字段
      recommendationId: firstUsableId(report.identifiers.recommendation_id, recommendationData?.recommendation_id, (report as any).recommendation_id),
      // customer-boundary-allow: drawerRefs 需兼容 operation_plan_id 字段
      operationId: firstUsableId(report.identifiers.operation_id, report.identifiers.operation_plan_id, (report as any).operation_id),
      fieldId: firstUsableId((report as any).field_id, report.identifiers.field_id),
    },
    // customer-boundary-allow: debug 字段仅用于技术折叠排查不进入客户主叙事
    debug: {
      // customer-boundary-allow: debug 折叠兼容 operation_plan_id/receipt_id/recommendation_id
      operationPlanId: kv(report.identifiers.operation_plan_id), operationId: kv(report.identifiers.operation_id), actTaskId: kv(report.identifiers.act_task_id), receiptId: kv(report.identifiers.receipt_id), recommendationId: kv(report.identifiers.recommendation_id), workflowOwnerId: kv(report.workflow.owner_actor_id), workflowOwnerName: kv(report.workflow.owner_name), workflowUpdatedAt: kv(report.workflow.updated_at), workflowLastNote: kv(report.workflow.last_note),
      sla: { responseTimeMs: kv(report.sla.response_time_ms), dispatchLatency: mapSlaQuality(report.sla.dispatch_latency_quality, report.sla.dispatch_latency_ms), executionDuration: mapSlaQuality(report.sla.execution_duration_quality, report.sla.execution_duration_ms), acceptanceLatency: mapSlaQuality(report.sla.acceptance_latency_quality, report.sla.acceptance_latency_ms), invalidReasons: Array.isArray(report.sla.invalid_reasons) && report.sla.invalid_reasons.length ? report.sla.invalid_reasons.map((item) => labelEmptyFallback(item)).join(" / ") : "--" },
    },
  };
}
