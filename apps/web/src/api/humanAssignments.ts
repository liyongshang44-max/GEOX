import { apiRequest, withQuery } from "./client";

export type WorkAssignmentStatus = "ASSIGNED" | "ACCEPTED" | "ARRIVED" | "SUBMITTED" | "CANCELLED" | "EXPIRED";

export type WorkAssignmentItem = {
  assignment_id: string;
  act_task_id: string;
  executor_id: string;
  assigned_at: string;
  status: WorkAssignmentStatus;
  accept_deadline_ts?: number | null;
  arrive_deadline_ts?: number | null;
  expired_ts?: number | null;
  expired_reason?: string | null;
  timeout_status?: "ON_TRACK" | "AT_RISK" | "OVERDUE" | "NONE";
  timeout_remaining_ms?: number | null;
  sla_stage?: "ACCEPT" | "ARRIVE" | "NONE";
  sla_indicator?: "ON_TRACK" | "AT_RISK" | "BREACHED" | "NONE";
  dispatch_note?: string | null;
  priority?: number;
  origin_type?: "manual" | "auto_fallback";
  origin_ref_id?: string | null;
  fallback_context?: {
    reason_code?: string | null;
    reason_message?: string | null;
    dispatch_id?: string | null;
    retry_count?: number | null;
    max_retries?: number | null;
    failed_at?: string | null;
    takeover_conditions?: string[] | null;
    device?: {
      device_id?: string | null;
      device_name?: string | null;
      status?: string | null;
      last_heartbeat_ts?: number | null;
      adapter_type?: string | null;
    } | null;
  } | null;
  created_ts_ms: number;
  updated_ts_ms: number;
};

export type WorkAssignmentSlaSummary = {
  total_count: number;
  assigned_count: number;
  accepted_count: number;
  arrived_count: number;
  submitted_count: number;
  expired_count: number;
  cancelled_count: number;
  accept_timeout_count: number;
  arrive_timeout_count: number;
};

export type DispatchWorkbenchTaskItem = {
  act_task_id: string;
  field_id: string | null;
  action_type: string | null;
  skill_id: string | null;
  required_capabilities: string[];
  time_window_start_ts: number | null;
  time_window_end_ts: number | null;
  task_created_at: string;
};

export type HumanExecutorItem = {
  executor_id: string;
  executor_type: "human";
  display_name: string;
  phone?: string | null;
  team_id?: string | null;
  status: "ACTIVE" | "DISABLED";
  capabilities: string[];
  created_ts_ms: number;
  updated_ts_ms: number;
};

export type HumanExecutorAvailabilityItem = {
  executor_id: string;
  display_name: string;
  team_id?: string | null;
  capabilities: string[];
  active_assignment_count: number;
  available: boolean;
};

export async function fetchWorkAssignments(params?: {
  executor_id?: string;
  act_task_id?: string;
  status?: WorkAssignmentStatus;
  timeout_status?: "ON_TRACK" | "AT_RISK" | "OVERDUE" | "NONE";
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

export async function fetchDispatchWorkbenchTasks(params?: {
  field_id?: string;
  required_capability?: string;
  window_start_ts?: number;
  window_end_ts?: number;
  limit?: number;
}): Promise<DispatchWorkbenchTaskItem[]> {
  const res = await apiRequest<{ ok?: boolean; items?: DispatchWorkbenchTaskItem[] }>(
    withQuery("/api/v1/human-executors/dispatch-workbench", params),
  );
  return Array.isArray(res.items) ? res.items : [];
}

export async function fetchHumanExecutors(params?: {
  status?: "ACTIVE" | "DISABLED";
  limit?: number;
}): Promise<HumanExecutorItem[]> {
  const res = await apiRequest<{ ok?: boolean; items?: HumanExecutorItem[] }>(
    withQuery("/api/v1/human-executors", params),
  );
  return Array.isArray(res.items) ? res.items : [];
}

export async function fetchHumanExecutorAvailability(params?: {
  team_id?: string;
  capability?: string;
  limit?: number;
}): Promise<HumanExecutorAvailabilityItem[]> {
  const res = await apiRequest<{ ok?: boolean; items?: HumanExecutorAvailabilityItem[] }>(
    withQuery("/api/v1/human-executors/availability", params),
  );
  return Array.isArray(res.items) ? res.items : [];
}

export async function batchCreateWorkAssignments(body: {
  items: Array<{
    assignment_id: string;
    act_task_id: string;
    executor_id: string;
    assigned_at?: string;
    status?: WorkAssignmentStatus;
    sla?: { accept_deadline_ts?: string; arrive_deadline_ts?: string; accept_minutes?: number; arrive_minutes?: number };
    required_capabilities?: string[];
    dispatch_note?: string;
    priority?: number;
    origin_type?: "manual" | "auto_fallback";
    origin_ref_id?: string;
    fallback_context?: Record<string, unknown>;
  }>;
}): Promise<{ ok?: boolean; created?: any[]; errors?: any[] }> {
  return apiRequest<{ ok?: boolean; created?: any[]; errors?: any[] }>("/api/v1/work-assignments/batch-create", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function batchReassignWorkAssignments(body: {
  items: Array<{
    assignment_id: string;
    executor_id: string;
    note?: string;
    required_capabilities?: string[];
  }>;
}): Promise<{ ok?: boolean; updated?: any[]; errors?: any[] }> {
  return apiRequest<{ ok?: boolean; updated?: any[]; errors?: any[] }>("/api/v1/work-assignments/batch-reassign", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function reassignWorkAssignment(assignmentId: string, body: {
  executor_id: string;
  reason?: string;
  required_capabilities?: string[];
}): Promise<{ ok?: boolean; updated?: any; error?: string }> {
  return apiRequest<{ ok?: boolean; updated?: any; error?: string }>(`/api/v1/work-assignments/${encodeURIComponent(assignmentId)}/reassign`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function batchCancelWorkAssignments(body: {
  items: Array<{ assignment_id: string; note?: string }>;
}): Promise<{ ok?: boolean; updated?: any[]; errors?: any[] }> {
  return apiRequest<{ ok?: boolean; updated?: any[]; errors?: any[] }>("/api/v1/work-assignments/batch-cancel", {
    method: "POST",
    body: JSON.stringify(body),
  });
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

export async function cancelWorkAssignment(assignmentId: string, note?: string): Promise<{ ok?: boolean; error?: string }> {
  return apiRequest<{ ok?: boolean; error?: string }>(`/api/v1/work-assignments/${encodeURIComponent(assignmentId)}/cancel`, {
    method: "POST",
    body: JSON.stringify({ note }),
  });
}

export async function fetchWorkAssignmentSlaSummary(params?: { from_ts_ms?: number; to_ts_ms?: number }): Promise<WorkAssignmentSlaSummary> {
  const res = await apiRequest<{ ok?: boolean; summary?: WorkAssignmentSlaSummary }>(withQuery("/api/v1/work-assignments/sla-summary", params));
  return res.summary ?? {
    total_count: 0,
    assigned_count: 0,
    accepted_count: 0,
    arrived_count: 0,
    submitted_count: 0,
    expired_count: 0,
    cancelled_count: 0,
    accept_timeout_count: 0,
    arrive_timeout_count: 0,
  };
}

export async function submitWorkAssignment(
  assignmentId: string,
  body: {
    execution_time: { start_ts: number; end_ts: number };
    labor?: { duration_minutes?: number; worker_count?: number };
    resource_usage?: {
      fuel_l?: number;
      electric_kwh?: number;
      water_l?: number;
      chemical_ml?: number;
      consumables?: Array<{ name: string; amount: number; unit?: string }>;
    };
    exception?: { type: string; code?: string; detail?: string };
    location_summary?: {
      center?: { lat: number; lon: number };
      path_points?: number;
      distance_m?: number;
      geohash?: string;
      remark?: string;
    };
    evidence_meta?: Array<{
      artifact_id?: string;
      object_key?: string;
      filename?: string;
      category?: "before" | "during" | "after" | "anomaly" | "other";
      mime_type?: string;
      size_bytes?: number;
      captured_at_ts?: number;
    }>;
    observed_parameters?: Record<string, unknown>;
    logs_refs?: Array<{ kind: string; ref: string }>;
    status?: "executed" | "not_executed";
  },
): Promise<{ ok?: boolean; status?: string; error?: string; detail?: any; field_errors?: Array<{ field: string; code: string; message: string }> }> {
  return apiRequest<{ ok?: boolean; status?: string; error?: string; detail?: any; field_errors?: Array<{ field: string; code: string; message: string }> }>(`/api/v1/work-assignments/${encodeURIComponent(assignmentId)}/submit`, {
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
  from_status?: WorkAssignmentStatus | null;
  to_status?: WorkAssignmentStatus | null;
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
