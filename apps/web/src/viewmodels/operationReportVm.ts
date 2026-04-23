import type { OperationReportV1 } from "../api/reports";

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

function mapFinalStatusToCustomerText(raw: unknown): string {
  const key = String(raw ?? "").trim().toUpperCase();
  if (["SUCCESS", "SUCCEEDED", "PASS"].includes(key)) return "作业已完成并通过验收";
  if (key === "PENDING_ACCEPTANCE") return "作业已完成，等待验收";
  if (["INVALID_EXECUTION", "FAIL", "FAILED", "ERROR"].includes(key)) return "作业未达到预期效果";
  if (["RUNNING", "PENDING"].includes(key)) return "作业执行中";
  return "作业状态待确认";
}

function mapGenericLabel(raw: unknown): string {
  const key = String(raw ?? "").trim().toUpperCase();
  if (!key) return "--";
  const dict: Record<string, string> = {
    PASS: "已通过",
    FAIL: "未通过",
    SUCCESS: "已完成",
    SUCCEEDED: "已完成",
    PENDING_ACCEPTANCE: "等待验收",
    INVALID_EXECUTION: "执行无效",
    LOW: "低风险",
    MEDIUM: "中风险",
    HIGH: "高风险",
    VALID: "有效",
    MISSING_DATA: "缺失",
    INVALID_ORDER: "异常",
  };
  return dict[key] ?? key;
}

function kv(value: unknown, fallback = "--"): string {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value);
}

function joinReasonTexts(reasons: string[]): string {
  if (!Array.isArray(reasons) || reasons.length === 0) return "暂无明确风险原因";
  return reasons.map((item) => mapGenericLabel(item)).join("、");
}

function mapSlaQuality(value: unknown, rawMs: unknown): string {
  const quality = String(value ?? "").trim().toUpperCase();
  if (quality === "VALID") return kv(rawMs);
  if (quality === "MISSING_DATA") return "缺失";
  if (quality === "INVALID_ORDER") return "异常";
  return "--";
}

export function buildOperationReportVm(report: OperationReportV1): OperationReportPageVm {
  const finalStatusText = mapFinalStatusToCustomerText(report.execution.final_status);
  const acceptanceStatusText = mapGenericLabel(report.acceptance.status);
  const riskLabel = mapGenericLabel(report.risk.level);
  const reasonText = joinReasonTexts(report.risk.reasons);

  const internalId = kv(report.identifiers.operation_id || report.identifiers.operation_plan_id);

  return {
    header: {
      title: "田间作业闭环",
      subtitle: finalStatusText,
      internalId,
    },
    why: {
      summary: `当前作业用于处理本次地块作业需求，目标是降低${riskLabel}相关问题并完成闭环处置。`,
      riskLabel,
      reasonText,
    },
    approval: {
      statusText: "当前版本未提供审批详情投影",
      actorText: "--",
      timeText: "--",
      noteText: "--",
      available: false,
    },
    execution: {
      ownerText: kv(report.workflow.owner_name || report.workflow.owner_actor_id),
      startedAtText: kv(report.execution.execution_started_at),
      finishedAtText: kv(report.execution.execution_finished_at),
      invalidExecutionText: report.execution.invalid_execution ? "是" : "否",
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
      missingEvidenceText: report.acceptance.missing_evidence ? "是" : "否",
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
            ? report.sla.invalid_reasons.join(" / ")
            : "--",
      },
    },
  };
}
