import { apiRequest, withQuery } from "./client";

export type DashboardSummary = {
  field_count: number;
  online_device_count: number;
  open_alert_count: number;
  running_task_count: number;
};

export type DashboardTrendPoint = { ts_ms: number; avg_value_num: number | null; sample_count: number };
export type DashboardTrendSeries = { metric: string; points: DashboardTrendPoint[] };
export type DashboardAlertItem = { event_id: string; rule_id: string; object_type: string; object_id: string; metric: string; status: string; raised_ts_ms: number };
export type DashboardReceiptItem = { fact_id: string; act_task_id: string | null; device_id: string | null; status: string | null; occurred_at: string; occurred_ts_ms: number };
export type DashboardQuickAction = { key: string; label: string; to: string };
export type DashboardEvidenceItem = {
  operation_plan_id: string | null;
  field_id: string | null;
  field_name: string | null;
  program_name: string | null;
  status: string | null;
  finished_at: string | null;
  water_l: number | null;
  electric_kwh: number | null;
  log_ref_count: number | null;
  constraint_violated: boolean | null;
  executor_label: string | null;
  receipt_fact_id: string | null;
  receipt_type: string | null;
  acceptance_verdict?: string | null;
  is_pending_acceptance?: boolean;
  href: string;
  summary?: any;
};
export type DashboardRecentExecutionItem = { id: string; operation_plan_id: string; field_id: string | null; status: string; updated_ts_ms: number; href: string };
export type DashboardAcceptanceRiskItem = { id: string; field_id?: string | null; title: string; level: string; occurred_at?: string | null };
export type DashboardPendingActionItem = { id: string; key: string; label: string; status?: string | null; to?: string | null };
export type DashboardRecommendationItem = {
  recommendation_id: string;
  title?: string;
  pending?: boolean;
  confidence?: number | null;
  reason_summary?: string;
  updated_ts_ms?: number;
  field?: { field_id?: string | null; field_name?: string | null };
  linked_refs?: { approval_request_id?: string | null; receipt_fact_id?: string | null };
};
export type DashboardOperationStateItem = {
  operation_id: string;
  task_id?: string | null;
  device_id?: string | null;
  dispatch_status?: string;
  final_status?: string;
  last_event_ts?: number;
};
export type DashboardAssignmentItem = {
  assignment_id: string;
  act_task_id: string;
  status: "ASSIGNED" | "ACCEPTED" | "ARRIVED" | "SUBMITTED" | "CANCELLED";
  assigned_at: string;
};

export type DashboardOverview = {
  window: { from_ts_ms: number; to_ts_ms: number };
  summary: DashboardSummary;
  trend_series: DashboardTrendSeries[];
  latest_alerts: DashboardAlertItem[];
  latest_receipts: DashboardReceiptItem[];
  quick_actions: DashboardQuickAction[];
};

export type DashboardControlPlaneItem = any;
export type DashboardTopActionItem = {
  tenant_id?: string;
  project_id?: string;
  group_id?: string;
  operation_id: string;
  action_type: string;
  priority_bucket: "P0" | "P1" | "P2";
  priority_score: number;
  priority_components: { risk: number; value: number; confidence: number; timeliness: number };
  global_priority_score?: number;
  global_priority_components?: { base: number; trend_adjustment: number; field_risk_adjustment: number };
  reason: string;
  risk_if_not_execute?: string;
  recommended_next_action: {
    action_type: string;
    source: "RULE" | "SLA_FIX" | "MANUAL" | "FALLBACK";
    reason: string;
  };
  execution_plan?: {
    action_type: string;
    target: { kind: "field" | "device"; ref: string };
    parameters: Record<string, unknown>;
    execution_mode: "AUTO" | "MANUAL";
    safe_guard: { requires_approval: boolean };
    failure_strategy: { retryable: boolean; max_retries: number; fallback_action?: string };
    device_capability_check?: { supported: boolean; reason?: string };
    time_window?: { start_ts?: number; end_ts?: number };
    idempotency_key: string;
  };
  execution_ready?: boolean;
  execution_blockers?: string[];
  device_capability_check?: { supported: boolean; reason?: string };
  execution_trace?: {
    execution_id: string;
    task_id: string;
    receipt_id?: string;
    evidence_refs?: string[];
    status: "PENDING" | "SUCCESS" | "FAILED";
  };
};
export type DashboardOverviewV2Response = {
  ok: boolean;
  top_actions?: DashboardTopActionItem[];
  risk_trend?: "UP" | "DOWN" | "FLAT" | "NO_DATA";
  effect_trend?: "UP" | "DOWN" | "FLAT" | "NO_DATA";
  trend_definition?: { window: string; baseline: string };
};

export type SlaSummary = {
  total_operations: number;
  success_rate: number;
  invalid_execution_rate: number;
  avg_execution_time_ms: number;
  avg_acceptance_time_ms: number;
};

async function firstOk<T>(paths: string[]): Promise<T> {
  let lastErr: unknown = null;
  for (const path of paths) {
    try {
      return await apiRequest<T>(path);
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr ?? new Error("No endpoint available");
}

async function safe<T>(promise: Promise<T>, fallback: T): Promise<T> {
  try {
    return await promise;
  } catch {
    return fallback;
  }
}

export async function fetchDashboardOverview(params?: { from_ts_ms?: number; to_ts_ms?: number }): Promise<DashboardOverview> {
  return apiRequest<DashboardOverview>(withQuery("/api/v1/dashboard/overview", params));
}

export async function fetchDashboardControlPlane(params?: { from_ts_ms?: number; to_ts_ms?: number }): Promise<{ ok: boolean; item: DashboardControlPlaneItem }> {
  return safe(
    apiRequest<{ ok: boolean; item: DashboardControlPlaneItem }>(withQuery("/api/v1/dashboard/control-plane", params)),
    { ok: true, item: null },
  );
}

export async function fetchDashboardEvidenceSummary(limit = 6): Promise<DashboardEvidenceItem[]> {
  const res = await safe(
    firstOk<{ ok?: boolean; items?: DashboardEvidenceItem[] }>([
      withQuery("/api/v1/dashboard/evidence/recent", { limit }),
    ]),
    { items: [] as DashboardEvidenceItem[] },
  );
  const list = res?.items ?? [];
  return Array.isArray(list) ? list : [];
}

export async function fetchDashboardRecentExecutions(limit = 8): Promise<DashboardRecentExecutionItem[]> {
  const res = await safe(
    apiRequest<{ ok?: boolean; items?: DashboardRecentExecutionItem[] }>(withQuery("/api/v1/dashboard/executions/recent", { limit })),
    { items: [] as DashboardRecentExecutionItem[] },
  );
  const list = res?.items ?? [];
  return Array.isArray(list) ? list : [];
}

export async function fetchDashboardAcceptanceRisks(limit = 6): Promise<DashboardAcceptanceRiskItem[]> {
  const res = await safe(
    firstOk<{ ok?: boolean; items?: DashboardAcceptanceRiskItem[] }>([
      withQuery("/api/v1/dashboard/acceptance-risks", { limit }),
      withQuery("/api/v1/dashboard/risk-summary", { limit }),
    ]),
    { items: [] as DashboardAcceptanceRiskItem[] },
  );
  const list = res?.items ?? [];
  return Array.isArray(list) ? list : [];
}

export async function fetchDashboardPendingActions(limit = 6): Promise<DashboardPendingActionItem[]> {
  const res = await safe(
    firstOk<{ ok?: boolean; items?: DashboardPendingActionItem[]; actions?: DashboardPendingActionItem[] }>([
      withQuery("/api/v1/dashboard/pending-actions", { limit }),
      withQuery("/api/v1/dashboard/actions", { limit }),
    ]),
    { items: [] as DashboardPendingActionItem[] },
  );
  const list = res?.items ?? res?.actions ?? [];
  return Array.isArray(list) ? list : [];
}

export async function fetchDashboardRecommendations(limit = 50): Promise<DashboardRecommendationItem[]> {
  const res = await safe(
    apiRequest<{ ok?: boolean; items?: DashboardRecommendationItem[] }>(withQuery("/api/v1/agronomy/recommendations/control-plane", { limit })),
    { items: [] as DashboardRecommendationItem[] },
  );
  const list = res?.items ?? [];
  return Array.isArray(list) ? list : [];
}

export async function fetchDashboardOperationStates(limit = 100): Promise<DashboardOperationStateItem[]> {
  const res = await safe(
    apiRequest<{ ok?: boolean; items?: DashboardOperationStateItem[] }>(withQuery("/api/v1/operations", { limit })),
    { items: [] as DashboardOperationStateItem[] },
  );
  const list = res?.items ?? [];
  return Array.isArray(list) ? list : [];
}

export async function fetchDashboardAssignments(limit = 100): Promise<DashboardAssignmentItem[]> {
  const res = await safe(
    apiRequest<{ ok?: boolean; items?: DashboardAssignmentItem[] }>(withQuery("/api/v1/work-assignments", { limit })),
    { items: [] as DashboardAssignmentItem[] },
  );
  const list = res?.items ?? [];
  return Array.isArray(list) ? list : [];
}

export async function getOverview(params?: { from_ts_ms?: number; to_ts_ms?: number }): Promise<{
  field_count: number;
  normal_field_count: number;
  risk_field_count: number;
  today_execution_count: number;
  pending_acceptance_count: number;
}> {
  const now = Date.now();
  const res = await fetchDashboardOverview({
    from_ts_ms: params?.from_ts_ms ?? now - 24 * 60 * 60 * 1000,
    to_ts_ms: params?.to_ts_ms ?? now,
  });
  const fieldCount = Number(res?.summary?.field_count ?? 0);
  const riskFieldCount = Number(res?.summary?.open_alert_count ?? 0);
  const runningTaskCount = Number(res?.summary?.running_task_count ?? 0);
  const pendingAcceptanceCount = (res?.latest_receipts ?? []).filter((item) => String(item?.status ?? "").toUpperCase() !== "PASS").length;
  return {
    field_count: fieldCount,
    normal_field_count: Math.max(0, fieldCount - riskFieldCount),
    risk_field_count: riskFieldCount,
    today_execution_count: runningTaskCount,
    pending_acceptance_count: pendingAcceptanceCount,
  };
}

export async function getRecentEvidence(params?: { limit?: number }): Promise<DashboardEvidenceItem[]> {
  return fetchDashboardEvidenceSummary(params?.limit ?? 5);
}


export async function fetchSlaSummary(params?: { tenant_id?: string; project_id?: string; group_id?: string }): Promise<SlaSummary> {
  return safe(
    apiRequest<SlaSummary>(withQuery("/api/v1/sla/summary", params)),
    {
      total_operations: 0,
      success_rate: 0,
      invalid_execution_rate: 0,
      avg_execution_time_ms: 0,
      avg_acceptance_time_ms: 0,
    },
  );
}

export async function fetchDashboardOverviewV2(): Promise<DashboardOverviewV2Response | null> {
  return safe(apiRequest<DashboardOverviewV2Response>("/api/v1/dashboard/overview_v2"), null);
}
