import { mapReceiptToVm, type ReceiptEvidenceVm } from "./evidence";

export type OperationStoryTimelineItemVm = {
  id: string;
  kind: string;
  label: string;
  status: string;
  occurredAtLabel: string;
  actorLabel: string;
  summary: string;
};

export type OperationDetailPageVm = {
  operationPlanId: string;
  fieldLabel: string;
  programLabel: string;
  statusLabel: string;
  finalStatus: string;
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
    taskId: string;
    deviceId: string;
    executorLabel: string;
    dispatchedAtLabel: string;
    ackedAtLabel: string;
  };
  receiptEvidence?: ReceiptEvidenceVm;
  timeline: OperationStoryTimelineItemVm[];
  evidenceExport: {
    latestJobId: string;
    latestJobStatus: string;
    latestBundleName: string;
    hasExportableBundle: boolean;
    downloadUrl?: string;
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

export function buildOperationDetailViewModel(detail: any): OperationDetailPageVm {
  const receipt = detail?.receipt
    ? mapReceiptToVm({ ...detail.receipt, status: detail.receipt?.receipt_status })
    : undefined;

  const timeline = (Array.isArray(detail?.timeline) ? detail.timeline : []).map((item: any, idx: number) => ({
    id: toText(item?.id, `timeline_${idx}`),
    kind: toText(item?.kind),
    label: toText(item?.label),
    status: toText(item?.status),
    occurredAtLabel: toDateLabel(item?.occurred_at),
    actorLabel: toText(item?.actor_label),
    summary: toText(item?.summary),
  }));

  return {
    operationPlanId: toText(detail?.operation_plan_id),
    fieldLabel: toText(detail?.field_name, toText(detail?.field_id)),
    programLabel: toText(detail?.program_name, toText(detail?.program_id)),
    statusLabel: toText(detail?.status_label, toText(detail?.final_status, "待推进")),
    finalStatus: toText(detail?.final_status),
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
      taskId: toText(detail?.dispatch?.task_id, toText(detail?.task?.task_id)),
      deviceId: toText(detail?.dispatch?.device_id, toText(detail?.task?.device_id)),
      executorLabel: toText(detail?.dispatch?.executor_label, toText(detail?.task?.executor_label, "系统")),
      dispatchedAtLabel: toDateLabel(detail?.dispatch?.dispatched_at),
      ackedAtLabel: toDateLabel(detail?.dispatch?.acked_at),
    },
    receiptEvidence: receipt,
    timeline,
    evidenceExport: {
      latestJobId: toText(detail?.evidence_export?.latest_job_id),
      latestJobStatus: toText(detail?.evidence_export?.latest_job_status, "未开始"),
      latestBundleName: toText(detail?.evidence_export?.latest_bundle_name, "暂无证据包"),
      hasExportableBundle: Boolean(detail?.evidence_export?.has_exportable_bundle),
      downloadUrl: typeof detail?.evidence_export?.download_url === "string" ? detail.evidence_export.download_url : undefined,
    },
  };
}
