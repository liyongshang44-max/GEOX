import { apiRequest, withQuery } from "./client";
import type { AlertV1 } from "./alerts";

export const ALERT_WORKFLOW_STATUS = {
  OPEN: "OPEN",
  ASSIGNED: "ASSIGNED",
  IN_PROGRESS: "IN_PROGRESS",
  ACKED: "ACKED",
  RESOLVED: "RESOLVED",
  CLOSED: "CLOSED",
} as const;

export type AlertWorkflowStatus = (typeof ALERT_WORKFLOW_STATUS)[keyof typeof ALERT_WORKFLOW_STATUS];

export const ALERT_PRIORITY = {
  P1: 1,
  P2: 2,
  P3: 3,
  P4: 4,
  P5: 5,
} as const;

export type AlertPriority = (typeof ALERT_PRIORITY)[keyof typeof ALERT_PRIORITY];

export type AlertWorkItemV1 = AlertV1 & {
  workflow_status: AlertWorkflowStatus;
  assignee: {
    actor_id: string | null;
    name: string | null;
  };
  priority: number;
  sla_due_at: number | null;
  sla_breached: boolean;
  last_note: string | null;
  field_id: string | null;
  operation_plan_id: string | null;
  device_id: string | null;
};

export type FetchAlertWorkboardParams = {
  field_ids?: string[];
  workflow_status?: AlertWorkflowStatus | AlertWorkflowStatus[];
  assignee_actor_id?: string | string[];
  severity?: string[];
  category?: string[];
  priority_min?: AlertPriority;
  priority_max?: AlertPriority;
  sla_breached?: boolean;
  query?: string;
};

export type AlertWorkflowMutationPayload = {
  assignee_actor_id?: string;
  assignee_name?: string;
  priority?: AlertPriority;
  sla_due_at?: number | null;
  note?: string;
  expected_version?: number;
};

export type AlertWorkflowMutationResult = {
  ok: boolean;
  alert_id: string;
  workflow_status: AlertWorkflowStatus;
  version: number;
  updated_by: string;
  updated_at: number;
};

export async function fetchAlertWorkboard(params: FetchAlertWorkboardParams = {}): Promise<AlertWorkItemV1[]> {
  const res = await apiRequest<{ ok?: boolean; items?: AlertWorkItemV1[] }>(withQuery("/api/v1/alerts/workboard", params));
  return Array.isArray(res.items) ? res.items : [];
}

export type AlertWorkboardSummaryV1 = {
  total: number;
  unassigned: number;
  in_progress: number;
  sla_breached: number;
  closed_today: number;
  by_field?: Record<string, {
    total: number;
    unassigned: number;
    in_progress: number;
    sla_breached: number;
    closed_today: number;
  }>;
};

export function summarizeAlertWorkboard(items: AlertWorkItemV1[]): AlertWorkboardSummaryV1 {
  return items.reduce<AlertWorkboardSummaryV1>((acc, item) => {
    acc.total += 1;
    if (item.workflow_status === "OPEN") acc.unassigned += 1;
    if (item.workflow_status === "IN_PROGRESS" || item.workflow_status === "ASSIGNED" || item.workflow_status === "ACKED") acc.in_progress += 1;
    if (item.sla_breached) acc.sla_breached += 1;
    if (item.workflow_status === "CLOSED") acc.closed_today += 1;
    return acc;
  }, { total: 0, unassigned: 0, in_progress: 0, sla_breached: 0, closed_today: 0 });
}

export async function fetchAlertWorkboardSummary(params: FetchAlertWorkboardParams = {}): Promise<AlertWorkboardSummaryV1> {
  const res = await apiRequest<{
    ok?: boolean;
    total?: number;
    unassigned?: number;
    in_progress?: number;
    sla_breached?: number;
    closed_today?: number;
    by_field?: Record<string, {
      total?: number;
      unassigned?: number;
      in_progress?: number;
      sla_breached?: number;
      closed_today?: number;
    }>;
  }>(withQuery("/api/v1/alerts/workboard/summary", params));
  const byField = (res.by_field && typeof res.by_field === "object")
    ? Object.entries(res.by_field).reduce<NonNullable<AlertWorkboardSummaryV1["by_field"]>>((acc, [fieldId, stats]) => {
      const key = String(fieldId ?? "").trim();
      if (!key || !stats || typeof stats !== "object") return acc;
      acc[key] = {
        total: Number(stats.total ?? 0),
        unassigned: Number(stats.unassigned ?? 0),
        in_progress: Number(stats.in_progress ?? 0),
        sla_breached: Number(stats.sla_breached ?? 0),
        closed_today: Number(stats.closed_today ?? 0),
      };
      return acc;
    }, {})
    : {};
  return {
    total: Number(res.total ?? 0),
    unassigned: Number(res.unassigned ?? 0),
    in_progress: Number(res.in_progress ?? 0),
    sla_breached: Number(res.sla_breached ?? 0),
    closed_today: Number(res.closed_today ?? 0),
    by_field: byField,
  };
}

export async function assignAlert(alertId: string, payload: AlertWorkflowMutationPayload = {}): Promise<AlertWorkflowMutationResult> {
  return apiRequest<AlertWorkflowMutationResult>(`/api/v1/alerts/${encodeURIComponent(alertId)}/assign`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function startAlert(alertId: string, payload: AlertWorkflowMutationPayload = {}): Promise<AlertWorkflowMutationResult> {
  return apiRequest<AlertWorkflowMutationResult>(`/api/v1/alerts/${encodeURIComponent(alertId)}/start`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function noteAlert(alertId: string, payload: AlertWorkflowMutationPayload = {}): Promise<AlertWorkflowMutationResult> {
  return apiRequest<AlertWorkflowMutationResult>(`/api/v1/alerts/${encodeURIComponent(alertId)}/note`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function resolveAlert(alertId: string, payload: AlertWorkflowMutationPayload = {}): Promise<AlertWorkflowMutationResult> {
  return apiRequest<AlertWorkflowMutationResult>(`/api/v1/alerts/${encodeURIComponent(alertId)}/resolve`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function closeAlert(alertId: string, payload: AlertWorkflowMutationPayload = {}): Promise<AlertWorkflowMutationResult> {
  return apiRequest<AlertWorkflowMutationResult>(`/api/v1/alerts/${encodeURIComponent(alertId)}/close`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
