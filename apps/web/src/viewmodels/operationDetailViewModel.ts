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
  operationPlanId: string;
  fieldLabel: string;
  programLabel: string;
  statusLabel: string;
  finalStatus: string;
  latestUpdatedAtLabel: string;
  recommendation: {
    id: string;
    title: string;
    summary: string;
    reasonCodes: string[];
    createdAtLabel: string;
  };
  approval: {
    requestId: string;
    decisionLabel: string;
    actorLabel: string;
    decidedAtLabel: string;
  };
  execution: {
    actionType: string;
    planId: string;
    taskId: string;
    deviceId: string;
    executorLabel: string;
    executionWindowLabel: string;
    dispatchedAtLabel: string;
    ackedAtLabel: string;
    ackStatusLabel: string;
    finalStatusLabel: string;
  };
  receiptEvidence?: ReceiptEvidenceVm;
  timeline: OperationStoryTimelineItemVm[];
  evidenceExport: {
    exportableLabel: string;
    latestJobId: string;
    latestJobStatus: string;
    latestExportedAtLabel: string;
    latestBundleName: string;
    hasExportableBundle: boolean;
    downloadUrl?: string;
    jumpUrl?: string;
    missingReason: string;
  };
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

const STORY_TIMELINE_ORDER = [
  "已生成作业建议",
  "已提交审批",
  "已批准执行",
  "已创建执行计划",
  "已生成执行任务",
  "已下发设备",
  "设备执行中",
  "已记录执行回执",
];

function buildStorySummary(label: string, sourceSummary: string, sourceActor: string, detail: any): string {
  if (sourceSummary !== "-" && sourceSummary !== "等待推进") return sourceSummary;
  const actor = sourceActor !== "-" ? sourceActor : "系统";
  const recommendationSummary = toText(detail?.recommendation?.summary, "暂无建议摘要");
  const deviceId = toText(detail?.dispatch?.device_id, toText(detail?.task?.device_id, "目标设备"));
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
    case "已下发设备":
      return `任务已发送至灌溉设备 ${deviceId}，等待设备 ACK 与执行反馈。`;
    case "设备执行中":
      return `${actor}正在执行作业任务，系统持续采集进度与资源消耗。`;
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

export function buildOperationDetailViewModel(detail: any): OperationDetailPageVm {
  const receipt = detail?.receipt
    ? mapReceiptToVm({ ...detail.receipt, status: detail.receipt?.receipt_status })
    : undefined;

  const timelineSource = (Array.isArray(detail?.timeline) ? detail.timeline : []).map((item: any, idx: number) => ({
    id: toText(item?.id, `timeline_${idx}`),
    kind: toText(item?.kind),
    label: toText(item?.label),
    status: toText(item?.status),
    occurredAtLabel: toDateLabel(item?.occurred_at),
    occurredAtMs: toMs(item?.occurred_at),
    actorLabel: toText(item?.actor_label),
    summary: toText(item?.summary),
  }));
  const byLabel = new Map<string, (typeof timelineSource)[number]>();
  timelineSource.forEach((item) => {
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
      storySummary: buildStorySummary(label, summary, actorLabel, detail),
    };
  });
  const terminalLabel = ["SUCCEEDED", "SUCCESS"].includes(String(detail?.final_status ?? "").toUpperCase())
    ? "作业已完成"
    : ["FAILED", "ERROR"].includes(String(detail?.final_status ?? "").toUpperCase())
      ? "作业执行失败"
      : "作业状态更新中";
  const terminalSource = timelineSource.find((x) => x.label === terminalLabel);
  timeline.push({
    id: terminalSource?.id ?? "story_terminal",
    kind: terminalSource?.kind ?? "TERMINAL",
    label: terminalLabel,
    status: toText(detail?.final_status, "PENDING"),
    occurredAtLabel: terminalSource?.occurredAtLabel ?? "-",
    actorLabel: terminalSource?.actorLabel ?? "-",
    summary: terminalSource?.summary ?? (terminalLabel === "作业状态更新中" ? "尚未进入终态" : terminalLabel),
    storySummary: buildStorySummary(
      terminalLabel,
      terminalSource?.summary ?? (terminalLabel === "作业状态更新中" ? "尚未进入终态" : terminalLabel),
      terminalSource?.actorLabel ?? "-",
      detail,
    ),
  });

  const latestTs = timelineSource
    .map((x) => x.occurredAtMs)
    .filter((x): x is number => Number.isFinite(x))
    .sort((a, b) => b - a)[0] ?? null;

  const ackTs = toMs(detail?.dispatch?.acked_at ?? detail?.task?.acked_at ?? detail?.plan?.acked_at);
  const dispatchTs = toMs(detail?.dispatch?.dispatched_at ?? detail?.task?.dispatched_at ?? detail?.plan?.dispatched_at);
  const receiptStartTs = toMs(detail?.receipt?.execution_started_at);
  const receiptEndTs = toMs(detail?.receipt?.execution_finished_at);
  const windowStart = receiptStartTs ?? dispatchTs;
  const windowEnd = receiptEndTs ?? ackTs;

  return {
    operationPlanId: toText(detail?.operation_plan_id),
    fieldLabel: toText(detail?.field_name, toText(detail?.field_id)),
    programLabel: toText(detail?.program_name, toText(detail?.program_id)),
    statusLabel: toText(detail?.status_label, toText(detail?.final_status, "待推进")),
    finalStatus: toText(detail?.final_status),
    latestUpdatedAtLabel: latestTs != null ? new Date(latestTs).toLocaleString() : "-",
    recommendation: {
      id: toText(detail?.recommendation?.recommendation_id),
      title: toText(detail?.recommendation?.title, "系统建议"),
      summary: toText(detail?.recommendation?.summary, "暂无建议摘要"),
      reasonCodes: Array.isArray(detail?.recommendation?.reason_codes)
        ? detail.recommendation.reason_codes.map((x: any) => toText(x)).filter((x: string) => x !== "-")
        : [],
      createdAtLabel: toDateLabel(detail?.recommendation?.created_at),
    },
    approval: {
      requestId: toText(detail?.approval?.approval_request_id),
      decisionLabel: toText(detail?.approval?.decision_label, toText(detail?.approval?.decision, "待审批")),
      actorLabel: toText(detail?.approval?.actor_label, "系统/未知"),
      decidedAtLabel: toDateLabel(detail?.approval?.decided_at),
    },
    execution: {
      actionType: toText(detail?.dispatch?.action_type, toText(detail?.plan?.action_type)),
      planId: toText(detail?.operation_plan_id),
      taskId: toText(detail?.dispatch?.task_id, toText(detail?.task?.task_id)),
      deviceId: toText(detail?.dispatch?.device_id, toText(detail?.task?.device_id)),
      executorLabel: toText(detail?.dispatch?.executor_label, toText(detail?.task?.executor_label, "系统")),
      executionWindowLabel: windowStart != null
        ? `${new Date(windowStart).toLocaleString()} ~ ${windowEnd != null ? new Date(windowEnd).toLocaleString() : "进行中"}`
        : "-",
      dispatchedAtLabel: toDateLabel(detail?.dispatch?.dispatched_at),
      ackedAtLabel: toDateLabel(detail?.dispatch?.acked_at),
      ackStatusLabel: ackTs != null ? "已 ACK" : "未 ACK",
      finalStatusLabel: toText(detail?.status_label, toText(detail?.final_status)),
    },
    receiptEvidence: receipt,
    timeline,
    evidenceExport: {
      exportableLabel: Boolean(detail?.evidence_export?.has_bundle ?? detail?.evidence_export?.has_exportable_bundle) ? "可导出" : "暂不可导出",
      latestJobId: toText(detail?.evidence_export?.latest_job_id),
      latestJobStatus: toText(detail?.evidence_export?.latest_job_status, "未开始"),
      latestExportedAtLabel: toDateLabel(detail?.evidence_export?.latest_exported_at),
      latestBundleName: toText(detail?.evidence_export?.latest_bundle_name, "暂无证据包"),
      hasExportableBundle: Boolean(detail?.evidence_export?.has_bundle ?? detail?.evidence_export?.has_exportable_bundle),
      downloadUrl: typeof detail?.evidence_export?.download_url === "string" ? detail.evidence_export.download_url : undefined,
      jumpUrl: typeof detail?.evidence_export?.jump_url === "string" ? detail.evidence_export.jump_url : undefined,
      missingReason: toText(detail?.evidence_export?.missing_reason, "无"),
    },
  };
}
