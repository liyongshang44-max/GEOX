
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
  };
  approval: {
    requestId: string;
    decisionLabel: string;
    actorLabel: string;
    decidedAtLabel: string;
    decisionSummary: string;
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
};

function toText(v: unknown, fallback = "-"): string {
  if (typeof v === "string") {
    const x = v.trim();
    return x || fallback;
  }
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return fallback;
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

function buildActualOutcomeLabel(detail: any, receipt?: ReceiptEvidenceVm): string {
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

function buildEvidenceBundleStatus(evidenceBundle: any): string {
  const hasBundle = Boolean(evidenceBundle?.has_bundle ?? evidenceBundle?.has_exportable_bundle);
  if (hasBundle) return "已生成，可下载与归档";
  const latestJobStatus = String(evidenceBundle?.latest_job_status ?? "").toUpperCase();
  if (latestJobStatus === "RUNNING") return "正在生成证据包";
  return "当前暂不可导出";
}

function resolveAcceptanceStatus(detail: any, receipt?: ReceiptEvidenceVm): "PASS" | "FAIL" | "PENDING" {
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
  const approvalActorLabel = toText(safeDetail?.approval?.actor_label, "系统/未知");
  const approvalDecidedAtLabel = toDateLabel(safeDetail?.approval?.decided_at);
  const ackStatusLabel = ackTs != null ? "已确认" : "待确认";
  const finalStatusCode = normalizeFinalStatusCode(safeDetail);
  const finalStatusLabel = mapStatusLabel(finalStatusCode || (safeDetail?.status_label ?? safeDetail?.final_status));
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
    },
    approval: {
      requestId: toText(safeDetail?.approval?.approval_request_id),
      decisionLabel: toText(safeDetail?.approval?.decision_label, toText(safeDetail?.approval?.decision, "待审批")),
      actorLabel: approvalActorLabel,
      decidedAtLabel: approvalDecidedAtLabel,
      decisionSummary: `由 ${approvalActorLabel} · ${approvalDecidedAtLabel}`,
    },
    execution: {
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
    },
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
  };
}
