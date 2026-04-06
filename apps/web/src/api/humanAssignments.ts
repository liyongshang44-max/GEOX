import { apiRequest, withQuery } from "./client";

export type WorkAssignmentStatus = "ASSIGNED" | "ACCEPTED" | "ARRIVED" | "SUBMITTED" | "CANCELLED" | "EXPIRED";

export type WorkAssignmentItem = {
  assignment_id: string;
  act_task_id: string;
  executor_id: string;
  assigned_at: string;
  status: WorkAssignmentStatus;
  accept_deadline_ts?: string | null;
  arrive_deadline_ts?: string | null;
  expired_reason?: string | null;
  created_ts_ms: number;
  updated_ts_ms: number;
};

export async function fetchWorkAssignments(params?: {
  executor_id?: string;
  act_task_id?: string;
  status?: WorkAssignmentStatus;
  limit?: number;
  offset?: number;
}): Promise<{ ok?: boolean; count?: number; items?: WorkAssignmentItem[] }> {
  return apiRequest<{ ok?: boolean; count?: number; items?: WorkAssignmentItem[] }>(withQuery("/api/v1/work-assignments", params));
}

export async function fetchWorkAssignmentDetail(assignmentId: string): Promise<WorkAssignmentItem | null> {
  const id = String(assignmentId ?? "").trim();
  if (!id) return null;
  const res = await apiRequest<{ ok?: boolean; assignment?: WorkAssignmentItem }>(`/api/v1/work-assignments/${encodeURIComponent(id)}`);
  return res.assignment ?? null;
}

export async function acceptWorkAssignment(assignmentId: string): Promise<{ ok?: boolean; error?: string }> {
  return apiRequest<{ ok?: boolean; error?: string }>(`/api/v1/work-assignments/${encodeURIComponent(assignmentId)}/accept`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export async function arriveWorkAssignment(assignmentId: string): Promise<{ ok?: boolean; error?: string }> {
  return apiRequest<{ ok?: boolean; error?: string }>(`/api/v1/work-assignments/${encodeURIComponent(assignmentId)}/arrive`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export async function submitWorkAssignment(
  assignmentId: string,
  body: {
    execution_time: { start_ts: number; end_ts: number };
    observed_parameters?: Record<string, unknown>;
    logs_refs?: Array<{ kind: string; ref: string }>;
    status?: "executed" | "not_executed";
  },
): Promise<{ ok?: boolean; status?: string; error?: string; detail?: any }> {
  return apiRequest<{ ok?: boolean; status?: string; error?: string; detail?: any }>(`/api/v1/work-assignments/${encodeURIComponent(assignmentId)}/submit`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}


export type WorkAssignmentAuditItem = {
  audit_id: string;
  assignment_id: string;
  act_task_id: string;
  executor_id: string;
  status: WorkAssignmentStatus;
  occurred_at: string;
  actor_id?: string | null;
  token_id?: string | null;
  note?: string | null;
};

export async function fetchWorkAssignmentAudit(assignmentId: string): Promise<WorkAssignmentAuditItem[]> {
  const id = String(assignmentId ?? "").trim();
  if (!id) return [];
  const res = await apiRequest<{ ok?: boolean; items?: WorkAssignmentAuditItem[] }>(`/api/v1/work-assignments/${encodeURIComponent(id)}/audit`);
  return Array.isArray(res.items) ? res.items : [];
}
