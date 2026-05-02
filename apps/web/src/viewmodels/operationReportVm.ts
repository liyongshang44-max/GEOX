import type { OperationReportV1 } from "../api/reports";
import {
  CUSTOMER_LABELS,
  labelAcceptanceStatus,
  labelApprovalStatus,
  labelBooleanYesNo,
  labelConfidenceHint,
  labelEvidenceQuality,
  labelEmptyFallback,
  labelFinalStatus,
  labelRiskLevel,
} from "../lib/customerLabels";

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
    operationPlanId: string;
    operationId: string;
    actTaskId: string;
    receiptId: string;
    recommendationId: string;
    workflowOwnerId: string;
    workflowOwnerName: string;
    workflowUpdatedAt: string;
    workflowLastNote: string;
    sla: {
      responseTimeMs: string;
      dispatchLatency: string;
      executionDuration: string;
      acceptanceLatency: string;
      invalidReasons: string;
    };
  };
};

function kv(value: unknown, fallback = "--"): string {
  return labelEmptyFallback(value, fallback);
}

function toNum(v: unknown): number | null {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
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
  return `${labelEmptyFallback(item?.summary_text, "地块响应记录")}（灌前${before ?? "--"} → 灌后${after ?? "--"}，${statusText}）`;
}

function formatRoiLine(item: any): string {
  const baseline = toNum(item?.baseline_value);
  const delta = toNum(item?.delta_value);
  const unit = labelEmptyFallback(item?.unit, "--");
  return `${labelEmptyFallback(item?.customer_text, "价值记录")}（数值${delta ?? "--"}${unit}，baseline ${baseline ?? "--"}）`;
}

function joinReasonTexts(reasons: string[]): string {
  if (!Array.isArray(reasons) || reasons.length === 0) return "暂无明确风险原因";
  return reasons.map((item) => labelEmptyFallback(item)).join("、");
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

  return {
    header: {
      title: kv((report as any).customer_title || (report as any).operation_title, CUSTOMER_LABELS.operationReportTitle),
      subtitle: finalStatusText,
      internalId,
    },
    why: {
      summary: kv(
        reportWhy?.explain_human,
        `当前作业用于处理本次地块作业需求，目标是降低${riskLabel}相关问题并完成闭环处置。`
      ),
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
      statusText: finalStatusText,
    },
    evidence: {
      artifactsText: kv(report.evidence.artifacts_count, "0"),
      logsText: kv(report.evidence.logs_count, "0"),
      mediaText: kv(report.evidence.media_count, "0"),
      metricsText: kv(report.evidence.metrics_count, "0"),
    },
    acceptance: {
      statusText: acceptanceStatusText,
      verdictText: labelEvidenceQuality(report.acceptance.verdict),
      missingEvidenceText: report.acceptance.missing_evidence ? "证据不足，建议人工复核" : labelBooleanYesNo(report.acceptance.missing_evidence),
      generatedAtText: kv(report.acceptance.generated_at),
    },
    conclusion: {
      finalStatusText,
      resultText: finalStatusText,
    },
    fieldMemory: {
      title: "系统记住了什么",
      items: (() => {
        const items = [
          ...((memory.field_response_memory ?? []).slice(0, 1).map(formatMemoryLine)),
          ...((memory.device_reliability_memory ?? []).slice(0, 1).map((item: any) => `${labelEmptyFallback(item?.summary_text, "设备可靠性记录")}（阀门响应、超时与回执完整性见证据）`)),
          ...((memory.skill_performance_memory ?? []).slice(0, 1).map((item: any) => `${labelEmptyFallback(item?.summary_text, "Skill 表现记录")}（诊断采纳与验收结果见证据）`)),
        ];
        return items.length ? items : ["暂无可展示的 Field Memory。本次闭环尚未形成可用于客户报告的地块记忆。"];
      })(),
    },
    roiLedger: {
      title: "本次价值账本",
      items: (() => {
        const items = [
          ...((roi.water_saved ?? []).slice(0, 1).map(formatRoiLine)),
          ...((roi.labor_saved ?? []).slice(0, 1).map((item: any) => `${formatRoiLine(item)}，计算方法：${labelEmptyFallback(item?.calculation_method, "后端口径")}`)),
          ...((roi.early_warning_lead_time ?? []).slice(0, 1).map((item: any) => labelEmptyFallback(item?.customer_text, "异常提前发现：暂无可展示数据"))),
          ...((roi.first_pass_acceptance_rate ?? []).slice(0, 1).map((item: any) => `验收一次通过：${labelEmptyFallback(item?.customer_text, "待补充证据")}`)),
        ];
        return items.length ? items : ["暂无可展示的 ROI Ledger。本次闭环尚未形成带基准线和可信度的价值记录。"];
      })(),
      confidenceText: labelConfidenceHint((roi.low_confidence_items ?? [])[0]?.confidence?.score),
    },
    debug: {
      operationPlanId: kv(report.identifiers.operation_plan_id),
      operationId: kv(report.identifiers.operation_id),
      actTaskId: kv(report.identifiers.act_task_id),
      receiptId: kv(report.identifiers.receipt_id),
      recommendationId: kv(report.identifiers.recommendation_id),
      workflowOwnerId: kv(report.workflow.owner_actor_id),
      workflowOwnerName: kv(report.workflow.owner_name),
      workflowUpdatedAt: kv(report.workflow.updated_at),
      workflowLastNote: kv(report.workflow.last_note),
      sla: {
        responseTimeMs: kv(report.sla.response_time_ms),
        dispatchLatency: mapSlaQuality(report.sla.dispatch_latency_quality, report.sla.dispatch_latency_ms),
        executionDuration: mapSlaQuality(report.sla.execution_duration_quality, report.sla.execution_duration_ms),
        acceptanceLatency: mapSlaQuality(report.sla.acceptance_latency_quality, report.sla.acceptance_latency_ms),
        invalidReasons:
          Array.isArray(report.sla.invalid_reasons) && report.sla.invalid_reasons.length
            ? report.sla.invalid_reasons.map((item) => labelEmptyFallback(item)).join(" / ")
            : "--",
      },
    },
  };
}
