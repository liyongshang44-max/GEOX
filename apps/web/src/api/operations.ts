import { apiRequest, withQuery } from "./client";

export type OperationStateTimelineItemV1 = { type: string; label: string; ts: number };
export type OperationStateItemV1 = {
  operation_id: string;
  recommendation_id?: string | null;
  program_id?: string | null;
  task_id?: string | null;
  device_id?: string | null;
  field_id?: string | null;
  action_type?: string | null;
  dispatch_status: string;
  receipt_status: string;
  final_status: string;
  last_event_ts: number;
  timeline: OperationStateTimelineItemV1[];
};

export type ApprovalRequestItem = {
  fact_id: string;
  occurred_at: string;
  source: string;
  record_json: any;
};

export async function fetchOperationStates(params?: { field_id?: string; device_id?: string; final_status?: string; limit?: number }): Promise<{ ok: boolean; count: number; items: OperationStateItemV1[] }> {
  return apiRequest<{ ok: boolean; count: number; items: OperationStateItemV1[] }>(withQuery("/api/v1/operations", params));
}

export type OperationDetailResponse = {
  operation_plan_id: string;
  field_id?: string | null;
  field_name?: string | null;
  program_id?: string | null;
  program_name?: string | null;
  final_status?: string | null;
  status_label?: string | null;
  recommendation?: any;
  approval?: any;
  plan?: any;
  task?: any;
  dispatch?: any;
  receipt?: any;
  timeline?: any[];
  evidence_export?: any;
  links?: Record<string, string>;
};

export async function fetchOperationDetail(operationPlanId: string): Promise<OperationDetailResponse | null> {
  const id = String(operationPlanId ?? "").trim();
  if (!id) return null;
  const res = await apiRequest<{ ok?: boolean; item?: OperationDetailResponse }>(`/api/v1/operations/${encodeURIComponent(id)}/detail`);
  return res?.item ?? null;
}

export async function fetchTaskTrajectory(actTaskId: string): Promise<any | null> {
  const res = await apiRequest<{ ok?: boolean; trajectory?: any }>(`/api/v1/tasks/${encodeURIComponent(actTaskId)}/trajectory`);
  return res.trajectory ?? null;
}

export async function fetchApprovalRequests(params: {
  tenant_id: string;
  project_id: string;
  group_id: string;
  limit?: number;
}): Promise<ApprovalRequestItem[]> {
  const res = await apiRequest<{ ok?: boolean; items?: ApprovalRequestItem[] }>(
    withQuery("/api/control/approval_request/v1/requests", params),
  );
  return Array.isArray(res.items) ? res.items : [];
}

export async function createApprovalRequest(body: {
  tenant_id: string;
  project_id: string;
  group_id: string;
  issuer: string;
  action_type: string;
  target: string;
  time_window: { start_ts: number; end_ts: number };
  parameter_schema: { keys: string[] };
  parameters: Record<string, unknown>;
  constraints: Record<string, unknown>;
  meta: Record<string, unknown>;
}): Promise<{ ok?: boolean; request_id?: string; error?: string }> {
  return apiRequest<{ ok?: boolean; request_id?: string; error?: string }>("/api/control/approval_request/v1/request", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function approveApprovalRequest(requestId: string): Promise<{ ok?: boolean; act_task_id?: string; error?: string }> {
  return apiRequest<{ ok?: boolean; act_task_id?: string; error?: string }>("/api/control/approval_request/v1/approve", {
    method: "POST",
    body: JSON.stringify({ request_id: requestId }),
  });
}
