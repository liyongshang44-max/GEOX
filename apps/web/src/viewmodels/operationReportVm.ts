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

const REVIEW_NEEDED_TEXT = "需复核";

export type OperationReportPageVm = {
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


function mapSlaQuality(value: unknown, rawMs: unknown): string {
  const quality = String(value ?? "").trim().toUpperCase();
  if (quality === "VALID") return kv(rawMs);
  if (quality === "MISSING_DATA") return "缺失";
  if (quality === "INVALID_ORDER") return "执行异常";
  return "--";
}

export function buildOperationReportVm(report: OperationReportV1): OperationReportPageVm {
  const finalStatusText = labelFinalStatus(report.execution.final_status);
  const acceptanceStatusText = labelAcceptanceStatus(report.acceptance.status);
  const riskLabel = labelRiskLevel(report.risk.level);
  const reasonText = joinReasonTexts(report.risk.reasons);
  const reportWhy = (report as any).why ?? null;
  const reportApproval = (report as any).approval ?? null;
  const memory = (report as any).field_memory ?? {};
  const roi = (report as any).roi_ledger ?? {};

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

  return {
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
      statusText: reportApproval ? labelApprovalStatus(reportApproval?.status) : "待确认",
      actorText: kv(reportApproval?.actor_name || reportApproval?.actor_id),
      timeText: kv(reportApproval?.approved_at || reportApproval?.generated_at),
      noteText: kv(reportApproval?.note),
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
      verdictText: labelEvidenceQuality(report.acceptance.verdict),
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
      title: "系统记忆",
      items: (() => {
        const items = [
          ...((memory.field_response_memory ?? []).slice(0, 1).map(formatMemoryLine)),
          ...((memory.device_reliability_memory ?? []).slice(0, 1).map((item: any) => labelEmptyFallback(item?.summary_text, "设备可靠性记录"))),
          ...((memory.skill_performance_memory ?? []).slice(0, 1).map((item: any) => labelEmptyFallback(item?.summary_text, "技能表现记录"))),
        ];
        return items.length ? items : ["暂无可展示的系统记忆。"];
      })(),
    },
    roiLedger: { title: "", items: [], confidenceText },
    debug: {
      operationPlanId: kv(report.identifiers.operation_plan_id), operationId: kv(report.identifiers.operation_id), actTaskId: kv(report.identifiers.act_task_id), receiptId: kv(report.identifiers.receipt_id), recommendationId: kv(report.identifiers.recommendation_id), workflowOwnerId: kv(report.workflow.owner_actor_id), workflowOwnerName: kv(report.workflow.owner_name), workflowUpdatedAt: kv(report.workflow.updated_at), workflowLastNote: kv(report.workflow.last_note),
      sla: { responseTimeMs: kv(report.sla.response_time_ms), dispatchLatency: mapSlaQuality(report.sla.dispatch_latency_quality, report.sla.dispatch_latency_ms), executionDuration: mapSlaQuality(report.sla.execution_duration_quality, report.sla.execution_duration_ms), acceptanceLatency: mapSlaQuality(report.sla.acceptance_latency_quality, report.sla.acceptance_latency_ms), invalidReasons: Array.isArray(report.sla.invalid_reasons) && report.sla.invalid_reasons.length ? report.sla.invalid_reasons.map((item) => labelEmptyFallback(item)).join(" / ") : "--" },
    },
  };
}
