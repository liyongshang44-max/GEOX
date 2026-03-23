import { requestJson, withQuery } from "./client";

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

export async function fetchOperationStates(params?: { field_id?: string; device_id?: string; final_status?: string; limit?: number }): Promise<{ ok: boolean; count: number; items: OperationStateItemV1[] }> {
  return requestJson<{ ok: boolean; count: number; items: OperationStateItemV1[] }>(withQuery("/api/v1/operations", params));
}

export async function fetchTaskTrajectory(actTaskId: string): Promise<any | null> {
  const res = await requestJson<{ ok?: boolean; trajectory?: any }>(`/api/v1/tasks/${encodeURIComponent(actTaskId)}/trajectory`);
  return res.trajectory ?? null;
}
