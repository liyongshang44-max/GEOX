export type TimelineEventInput = {
  factType?: unknown;
  approvalDecision?: unknown;
  dispatchState?: unknown;
  operationPlanStatus?: unknown;
};

const FACT_LABELS: Record<string, string> = {
  decision_recommendation_v1: "已生成作业建议",
  approval_request_v1: "已提交审批",
  operation_plan_v1: "已创建执行计划",
  ao_act_task_v0: "已生成执行任务",
  ao_act_task_v1: "已生成执行任务",
  ao_act_receipt_v0: "已记录执行回执",
  ao_act_receipt_v1: "已记录执行回执",
};

export function mapFactTypeToTimelineLabel(factType: unknown): string | null {
  const key = String(factType ?? "").trim();
  if (!key) return null;
  return FACT_LABELS[key] ?? null;
}

export function mapApprovalDecisionToTimelineLabel(decision: unknown): string | null {
  const code = String(decision ?? "").trim().toUpperCase();
  if (!code) return null;
  if (["APPROVE", "APPROVED", "PASS"].includes(code)) return "已批准执行";
  return null;
}

export function mapDispatchStateToTimelineLabel(state: unknown): string | null {
  const code = String(state ?? "").trim().toUpperCase();
  if (code === "DISPATCHED") return "已下发设备";
  if (code === "ACKED") return "设备执行中";
  return null;
}

export function mapOperationPlanTerminalToTimelineLabel(status: unknown): string | null {
  const code = String(status ?? "").trim().toUpperCase();
  if (["SUCCEEDED", "SUCCESS"].includes(code)) return "作业已完成";
  if (["FAILED", "ERROR"].includes(code)) return "作业执行失败";
  return null;
}

export function resolveTimelineLabel(input: TimelineEventInput): string {
  return (
    mapOperationPlanTerminalToTimelineLabel(input.operationPlanStatus)
    ?? mapDispatchStateToTimelineLabel(input.dispatchState)
    ?? mapApprovalDecisionToTimelineLabel(input.approvalDecision)
    ?? mapFactTypeToTimelineLabel(input.factType)
    ?? "执行状态更新"
  );
}

export function toBusinessTimelineLabel(raw: unknown): string {
  const code = String(raw ?? "").trim().toUpperCase();
  if (!code) return "状态更新";
  if (["AO_ACT_TASK_V0", "AO_ACT_TASK_V1"].includes(code)) return "系统已创建执行任务";
  if (["AO_ACT_RECEIPT_V0", "AO_ACT_RECEIPT_V1"].includes(code)) return "设备已回传执行回执";
  if (code === "DECISION_RECOMMENDATION_V1") return "系统生成了作业建议";
  if (code === "APPROVAL_REQUEST_V1") return "建议进入审批";
  if (code === "OPERATION_PLAN_V1") return "已形成可执行作业计划";
  return "作业状态更新";
}
