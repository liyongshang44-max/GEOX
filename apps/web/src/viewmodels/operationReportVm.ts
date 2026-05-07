import type { OperationReportV1 } from "../api/customerReports";
import {
  CUSTOMER_LABELS,
  labelAcceptanceStatus,
  labelApprovalStatus,
  labelBooleanYesNo,
  labelConfidenceHint,
  labelEvidenceQuality,
  labelEmptyFallback,
  labelFinalStatus,
  labelMemoryCode,
  labelRiskLevel,
  labelValueType,
} from "../lib/customerLabels";
import { getCustomerEmptyState } from "../lib/customerEmptyStates";

const REVIEW_NEEDED_TEXT = "需复核";

export type OperationReportPageVm = {
  operation: { operationId: string; title: string; fieldName: string; fieldId: string; finalStatusLabel: string; finalStatusTone: string; updatedAtText: string };
  sections: CustomerReportSectionVm[];
  timeline: Array<{ key: string; label: string; status: "DONE" | "PENDING" | "MISSING" | "NOT_APPLICABLE"; timeText?: string }>;
  exportHref: string;
  technicalFoldout?: { rows: Array<{ label: string; value: string }> };
  header: {
    title: string;
    subtitle: string;
    internalId: string;
  };
  why: {
    summary: string;
    riskLabel: string;
    reasonText: string;
  };
  approval: {
    statusText: string;
    actorText: string;
    timeText: string;
    noteText: string;
    available: boolean;
  };
  execution: {
    ownerText: string;
    startedAtText: string;
    finishedAtText: string;
    invalidExecutionText: string;
    statusText: string;
  };
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
  acceptance: {
    statusText: string;
    verdictText: string;
    missingEvidenceText: string;
    generatedAtText: string;
  };
  value: {
    valueText: string;
    methodText: string;
    evidenceText: string;
    confidenceText: string;
    fallbackText: string;
    useFallback: boolean;
  };
  conclusion: {
    finalStatusText: string;
    resultText: string;
  };
  fieldMemory: {
    title: string;
    items: string[];
  };
  roiLedger: {
    title: string;
    items: string[];
    confidenceText: string;
  };
  debug: {
    operationPlanId: string; operationId: string; actTaskId: string; receiptId: string; recommendationId: string; workflowOwnerId: string; workflowOwnerName: string; workflowUpdatedAt: string; workflowLastNote: string;
    sla: { responseTimeMs: string; dispatchLatency: string; executionDuration: string; acceptanceLatency: string; invalidReasons: string; };
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
  technical?: { title: string; rows: Array<{ label: string; value: string }> };
};

function kv(value: unknown, fallback = "--"): string {
  return labelEmptyFallback(value, fallback);
}
function toNum(v: unknown): number | null {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}
function mapEvidenceStatusLabel(value: unknown): string {
  const count = toNum(value);
  if (count == null) return "需复核";
  if (count <= 0) return "缺失";
  return "已采集";
}

export function mapOperationStatusToCustomerLabel(value: unknown): string {
  const status = String(value ?? "").trim().toUpperCase();
  if (!status) return "待确认";
  if (["SUCCESS", "DONE", "COMPLETED", "APPROVED", "PASS", "VALID"].includes(status)) return "已完成";
  if (["FAILED", "REJECTED", "ERROR", "INVALID"].includes(status)) return "异常";
  if (["PENDING", "WAITING", "QUEUED", "RUNNING", "IN_PROGRESS"].includes(status)) return "进行中";
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
  return `${labelMemoryCode(item?.memory_code ?? item?.code ?? item?.memory_type)}：${labelEmptyFallback(item?.summary_text, "地块响应记录")}（灌前${before ?? "--"} → 灌后${after ?? "--"}，${statusText}）`;
}

function formatRoiLine(item: any): string {
  const baseline = toNum(item?.baseline_value);
  const delta = toNum(item?.delta_value);
  const unit = labelEmptyFallback(item?.unit, "--");
  return `${labelEmptyFallback(item?.customer_text, "价值记录")}（${labelValueType(item?.value_type)}，数值${delta ?? "--"}${unit}，baseline ${baseline ?? "--"}）`;
}


function mapAcceptanceCopy(value: unknown): string {
  const status = String(value ?? "").trim().toUpperCase();
  if (status === "PASS") return "验收通过";
  if (status === "FAIL") return "未达到预期效果";
  if (status === "PENDING") return "验收结果尚未生成";
  return "验收结果尚未生成";
}

function mapApprovalStatusForCustomer(value: unknown): string {
  const raw = String(value ?? "").trim();
  const normalized = raw.toUpperCase();
  if (!raw) return "--";
  if (normalized.includes("AUTO")) return "系统自动状态";
  return labelApprovalStatus(raw);
}

function mapSlaQuality(value: unknown, rawMs: unknown): string {
  const quality = String(value ?? "").trim().toUpperCase();
  if (quality === "VALID") return kv(rawMs);
  if (quality === "MISSING_DATA") return "缺失";
  if (quality === "INVALID_ORDER") return "执行异常";
  return "--";
}

export function buildOperationReportVm(report: OperationReportV1): OperationReportPageVm {
  const finalStatusText = labelFinalStatus(report.execution.final_status);
  const acceptanceStatusText = mapAcceptanceCopy(report.acceptance.status);
  const riskLabel = labelRiskLevel(report.risk.level);
  const reasonText = joinReasonTexts(report.risk.reasons);
  const reportWhy = (report as any).why ?? null;
  const reportApproval = (report as any).approval ?? null;
  const memory = (report as any).field_memory ?? {};
  const roi = (report as any).roi_ledger ?? {};
  const recommendationData = (report as any).recommendation ?? null;
  const recommendationReason = kv(recommendationData?.reason ?? reportWhy?.objective_text, "--");
  const explainText = kv(recommendationData?.explain ?? reportWhy?.explain_human, "--");
  const sourceFactRefs = Array.isArray(recommendationData?.source_fact_refs)
    ? recommendationData.source_fact_refs.map((item: unknown) => labelEmptyFallback(item)).filter(Boolean).join("、")
    : "--";
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
  const asExecutedData = (report as any).as_executed ?? null;
  const asAppliedData = (report as any).as_applied ?? null;
  const operationType = String((report as any).operation_type ?? prescriptionData?.operation_type ?? "").trim().toUpperCase();
  const isVariableOperation = operationType.includes("VARIABLE");
  const executionTarget = kv(asExecutedData?.target ?? asExecutedData?.execution_target ?? executionData?.target, "--");
  const executorText = kv(asExecutedData?.executor ?? asExecutedData?.actor ?? report.workflow.owner_name, "--");
  const executionParamsText = kv(asExecutedData?.params_summary ?? asExecutedData?.parameters ?? executionData?.parameters, "--");
  const asExecutedSummary = kv(asExecutedData?.summary ?? asExecutedData?.result_summary, "--");
  const asAppliedSummary = !isVariableOperation
    ? "该作业不适用覆盖记录"
    : kv(asAppliedData?.summary ?? asAppliedData?.coverage_summary, "暂无覆盖记录");
  const hasAsExecuted = Boolean(report.execution.execution_started_at || asExecutedData);

  const evidencePackSummary = (report as any).evidence_pack_summary ?? null;
  const evidenceMediaSummary = kv(evidencePackSummary?.photos_logs_metrics_trace_summary ?? evidencePackSummary?.summary, "--");
  const evidenceStatus = kv(evidencePackSummary?.status ?? ((toNum(report.evidence.artifacts_count) ?? 0) > 0 || (toNum(report.evidence.logs_count) ?? 0) > 0 || (toNum(report.evidence.media_count) ?? 0) > 0 || (toNum(report.evidence.metrics_count) ?? 0) > 0 ? "已采集" : "--"), "--");
  const evidenceInsufficientReason = Array.isArray(report.acceptance.missing_items) && report.acceptance.missing_items.length
    ? report.acceptance.missing_items.map((item) => labelEmptyFallback(item)).join("、")
    : kv(evidencePackSummary?.insufficient_reason, "--");
  const hasEvidencePackSummary = Boolean(evidencePackSummary && evidenceMediaSummary !== "--");

  const internalId = kv(report.identifiers.operation_id || report.identifiers.operation_plan_id);

  const valueItems = [
    ...((roi.water_saved ?? []).slice(0, 1)),
    ...((roi.labor_saved ?? []).slice(0, 1)),
    ...((roi.early_warning_lead_time ?? []).slice(0, 1)),
    ...((roi.first_pass_acceptance_rate ?? []).slice(0, 1)),
  ];
  const valueItem = valueItems[0] ?? null;
  const valueNumber = toNum(valueItem?.delta_value);
  const valueUnit = labelEmptyFallback(valueItem?.unit, "");
  const valueText = valueNumber == null ? REVIEW_NEEDED_TEXT : `${valueNumber}${valueUnit}`;
  const methodText = kv(valueItem?.calculation_method, REVIEW_NEEDED_TEXT);
  const valueEvidence = labelEmptyFallback(valueItem?.customer_text, "");
  const evidenceText = valueEvidence || REVIEW_NEEDED_TEXT;
  const confidenceText = labelConfidenceHint((roi.low_confidence_items ?? [])[0]?.confidence?.score);
  const useFallback = valueNumber == null || /估算值|可信度有限/.test(confidenceText);
  const memoryItems = [
    ...((memory.field_response_memory ?? []).slice(0, 1).map(formatMemoryLine)),
    ...((memory.device_reliability_memory ?? []).slice(0, 1).map((item: any) => labelEmptyFallback(item?.summary_text, "设备可靠性记录"))),
    ...((memory.skill_performance_memory ?? []).slice(0, 1).map((item: any) => labelEmptyFallback(item?.summary_text, "技能表现记录"))),
  ];
  const noEvidence = [report.evidence.artifacts_count, report.evidence.logs_count, report.evidence.media_count, report.evidence.metrics_count]
    .every((value) => (toNum(value) ?? 0) <= 0);
  const sections: CustomerReportSectionVm[] = [
    { key: "RECOMMENDATION", status: hasRecommendationData ? "AVAILABLE" : "MISSING", title: "建议", summary: hasRecommendationData ? recommendationReason : "暂无正式建议记录", items: hasRecommendationData ? [{ label: "建议原因", value: recommendationReason }, { label: "农艺解释", value: explainText }, { label: "风险等级", value: riskLabel }, { label: "数据依据摘要", value: recommendationSummary }] : [], emptyState: hasRecommendationData ? undefined : { title: "暂无正式建议记录", description: "当前缺少 recommendation/explain/risk 字段。" } },
    { key: "PRESCRIPTION", status: hasPrescriptionData ? "AVAILABLE" : "MISSING", title: "处方合同", summary: hasPrescriptionData ? "已形成正式处方" : "未形成正式处方", items: prescriptionItems, emptyState: hasPrescriptionData ? undefined : { title: "未形成正式处方", description: "当前没有处方记录。" } },
    { key: "APPROVAL", status: reportApproval ? "AVAILABLE" : "MISSING", title: "审批", summary: reportApproval ? mapApprovalStatusForCustomer(reportApproval?.status) : "审批记录暂不可用", items: reportApproval ? [{ label: "审批状态", value: mapApprovalStatusForCustomer(reportApproval?.status) }, { label: "审批人客户化名称", value: kv(reportApproval?.actor_name, "--") }, { label: "审批时间", value: kv(reportApproval?.approved_at || reportApproval?.generated_at, "--") }, { label: "审批意见", value: kv(reportApproval?.note, "--") }, { label: "权限提示", value: kv(reportApproval?.permission_hint || reportApproval?.permission_note, "--") }] : [], emptyState: reportApproval ? undefined : { title: "审批记录暂不可用", description: "当前尚未生成可展示的审批记录。" } },
    { key: "EXECUTION", status: hasAsExecuted ? "AVAILABLE" : "MISSING", title: "执行 / as-executed", summary: hasAsExecuted ? mapOperationStatusToCustomerLabel(report.execution.final_status) : "暂无实际执行记录", items: hasAsExecuted ? [{ label: "执行对象", value: executionTarget }, { label: "人/设备", value: executorText }, { label: "开始时间", value: kv(report.execution.execution_started_at, "--") }, { label: "结束时间", value: kv(report.execution.execution_finished_at, "--") }, { label: "执行参数", value: executionParamsText }, { label: "As-executed 摘要", value: asExecutedSummary }, { label: "As-applied 空态或摘要", value: asAppliedSummary }] : [], emptyState: hasAsExecuted ? undefined : { title: "暂无实际执行记录", description: "当前尚无 as-executed 记录。" } },
    { key: "EVIDENCE", status: hasEvidencePackSummary ? "AVAILABLE" : "MISSING", title: "证据", summary: hasEvidencePackSummary ? evidenceStatus : "暂无证据包摘要", items: hasEvidencePackSummary ? [{ label: "照片/日志/指标/轨迹摘要", value: evidenceMediaSummary }, { label: "证据状态", value: evidenceStatus }, { label: "证据不足原因", value: evidenceInsufficientReason }] : [], emptyState: hasEvidencePackSummary ? undefined : { title: "暂无证据包摘要", description: "当前没有 evidence-pack-summary。" } },
    { key: "ACCEPTANCE", status: report.acceptance.generated_at ? "AVAILABLE" : "PENDING", title: "验收", summary: acceptanceStatusText, items: report.acceptance.generated_at ? [{ label: "验收结论", value: acceptanceStatusText }, { label: "验收依据", value: kv(report.acceptance.verdict, "--") }, { label: "未通过原因", value: report.acceptance.status === "FAIL" ? kv(report.execution.invalid_reason, "--") : "--" }, { label: "证据不足原因", value: Array.isArray(report.acceptance.missing_items) && report.acceptance.missing_items.length ? report.acceptance.missing_items.map((item) => labelEmptyFallback(item)).join("、") : "--" }, { label: "复核提示", value: report.acceptance.missing_evidence ? "证据不足，建议补齐后复核" : "--" }] : [], emptyState: report.acceptance.generated_at ? undefined : { title: "验收结果尚未生成", description: "当前验收结论待生成。" } },
    { key: "ROI", status: valueNumber == null ? "MISSING" : "AVAILABLE", title: "ROI", summary: valueNumber == null ? "暂无可量化价值记录" : valueText, items: [{ label: "价值", value: valueText }, { label: "方法", value: methodText }, { label: "可信度", value: confidenceText }], emptyState: valueNumber == null ? { title: "暂无可量化价值记录", description: "当前未形成可审计 ROI。" } : undefined },
    { key: "MEMORY", status: memoryItems.length ? "AVAILABLE" : "MISSING", title: "田块记忆 / Skill trace", summary: memoryItems[0] ?? "暂无可展示的地块记忆", items: memoryItems.map((line) => ({ label: "记忆", value: line })), emptyState: memoryItems.length ? undefined : { title: "暂无可展示的地块记忆", description: "当前没有可复用记忆条目。" } },
  ];
  const timeline = sections.map((s) => ({ key: s.key, label: s.title, status: s.status === "AVAILABLE" ? "DONE" as const : (s.status === "PENDING" ? "PENDING" as const : s.status === "MISSING" ? "MISSING" as const : "NOT_APPLICABLE" as const) }));

  return {
    operation: {
      operationId: kv(report.identifiers.operation_id || report.identifiers.operation_plan_id),
      title: kv((report as any).customer_title || (report as any).operation_title, CUSTOMER_LABELS.operationReportTitle),
      fieldName: kv((report as any).field_name, "地块"),
      fieldId: kv((report as any).field_id, "--"),
      finalStatusLabel: finalStatusText,
      finalStatusTone: /异常|失败/.test(finalStatusText) ? "danger" : (/等待|进行中/.test(finalStatusText) ? "warning" : "neutral"),
      updatedAtText: kv(report.workflow.updated_at),
    },
    sections,
    timeline,
    exportHref: `/customer/operations/${encodeURIComponent(kv(report.identifiers.operation_id || report.identifiers.operation_plan_id))}/export`,
    technicalFoldout: { rows: [
      { label: "operation_id", value: kv(report.identifiers.operation_id) },
      { label: "operation_plan_id", value: kv(report.identifiers.operation_plan_id) },
      { label: "recommendation_id", value: kv(report.identifiers.recommendation_id) },
      { label: "rule_id", value: kv(recommendationData?.rule_id ?? recommendationData?.ruleId) },
      { label: "source fact refs", value: sourceFactRefs },
      { label: "skill_trace_ref", value: kv(recommendationData?.skill_trace_ref ?? recommendationData?.skillTraceRef ?? (report as any).field_memory?.skill_trace_ref) },
    ] },
    header: {
      title: kv((report as any).customer_title || (report as any).operation_title, CUSTOMER_LABELS.operationReportTitle),
      subtitle: finalStatusText,
      internalId,
    },
    why: {
      summary: kv(reportWhy?.explain_human, `当前作业用于处理本次地块作业需求，目标是降低${riskLabel}相关问题并完成闭环处置。`),
      riskLabel,
      reasonText: kv(reportWhy?.objective_text, reasonText),
    },
    approval: {
      statusText: reportApproval ? mapApprovalStatusForCustomer(reportApproval?.status) : "待确认",
      actorText: kv(reportApproval?.actor_name, "--"),
      timeText: kv(reportApproval?.approved_at || reportApproval?.generated_at, "--"),
      noteText: kv(reportApproval?.note, "--"),
      available: Boolean(reportApproval),
    },
    execution: {
      ownerText: kv(report.workflow.owner_name || report.workflow.owner_actor_id),
      startedAtText: kv(report.execution.execution_started_at),
      finishedAtText: kv(report.execution.execution_finished_at),
      invalidExecutionText: labelBooleanYesNo(report.execution.invalid_execution),
      statusText: mapOperationStatusToCustomerLabel(report.execution.final_status),
    },
    evidence: {
      executionReceipt: mapEvidenceStatusLabel(report.evidence.artifacts_count),
      executionRecord: mapEvidenceStatusLabel(report.evidence.logs_count),
      postIrrigationMonitoring: mapEvidenceStatusLabel(report.evidence.metrics_count),
      onSitePhotos: mapEvidenceStatusLabel(report.evidence.media_count),
      acceptanceItems: report.acceptance.missing_evidence ? "需复核" : "无缺失",
      hasAnyMissing: Boolean(report.acceptance.missing_evidence),
      artifactsText: mapEvidenceStatusLabel(report.evidence.artifacts_count),
      logsText: mapEvidenceStatusLabel(report.evidence.logs_count),
      mediaText: mapEvidenceStatusLabel(report.evidence.media_count),
      metricsText: mapEvidenceStatusLabel(report.evidence.metrics_count),
    },
    acceptance: {
      statusText: acceptanceStatusText,
      verdictText: kv(report.acceptance.verdict, "--"),
      missingEvidenceText: report.acceptance.missing_evidence ? REVIEW_NEEDED_TEXT : "无",
      generatedAtText: kv(report.acceptance.generated_at),
    },
    value: {
      valueText,
      methodText,
      evidenceText,
      confidenceText,
      fallbackText: "本次作业的量化价值仍在积累中，当前可确认价值为：作业完成并完成验收。",
      useFallback,
    },
    conclusion: {
      finalStatusText,
      resultText: finalStatusText,
    },
    fieldMemory: {
      title: "田块记忆 / Skill trace",
      items: memoryItems.length ? memoryItems : [getCustomerEmptyState("NO_FIELD_MEMORY").title],
    },
    roiLedger: { title: "", items: [], confidenceText },
    debug: {
      operationPlanId: kv(report.identifiers.operation_plan_id), operationId: kv(report.identifiers.operation_id), actTaskId: kv(report.identifiers.act_task_id), receiptId: kv(report.identifiers.receipt_id), recommendationId: kv(report.identifiers.recommendation_id), workflowOwnerId: kv(report.workflow.owner_actor_id), workflowOwnerName: kv(report.workflow.owner_name), workflowUpdatedAt: kv(report.workflow.updated_at), workflowLastNote: kv(report.workflow.last_note),
      sla: { responseTimeMs: kv(report.sla.response_time_ms), dispatchLatency: mapSlaQuality(report.sla.dispatch_latency_quality, report.sla.dispatch_latency_ms), executionDuration: mapSlaQuality(report.sla.execution_duration_quality, report.sla.execution_duration_ms), acceptanceLatency: mapSlaQuality(report.sla.acceptance_latency_quality, report.sla.acceptance_latency_ms), invalidReasons: Array.isArray(report.sla.invalid_reasons) && report.sla.invalid_reasons.length ? report.sla.invalid_reasons.map((item) => labelEmptyFallback(item)).join(" / ") : "--" },
    },
  };
}
