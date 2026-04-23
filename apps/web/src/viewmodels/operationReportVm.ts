import type { OperationReportV1 } from "../api/reports";
import {
  CUSTOMER_LABELS,
  labelAcceptanceStatus,
  labelApprovalStatus,
  labelBooleanYesNo,
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
      verdictText: kv(report.acceptance.verdict),
      missingEvidenceText: labelBooleanYesNo(report.acceptance.missing_evidence),
      generatedAtText: kv(report.acceptance.generated_at),
    },
    conclusion: {
      finalStatusText,
      resultText: finalStatusText,
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
