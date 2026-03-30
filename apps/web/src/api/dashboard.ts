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
  pending?: boolean;
  confidence?: number | null;
  linked_refs?: { approval_request_id?: string | null; receipt_fact_id?: string | null };
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
  } catch (e: any) {
    if (e?.status === 404 || e?.response?.status === 404) return fallback;
    throw e;
  }
}

export async function fetchDashboardOverview(params?: { from_ts_ms?: number; to_ts_ms?: number }): Promise<DashboardOverview> {
  return safe(
    apiRequest<DashboardOverview>(withQuery("/api/v1/dashboard/overview", params)),
    {
      window: { from_ts_ms: 0, to_ts_ms: 0 },
      summary: { field_count: 0, online_device_count: 0, open_alert_count: 0, running_task_count: 0 },
      trend_series: [],
      latest_alerts: [],
      latest_receipts: [],
      quick_actions: [],
    },
  );
}

export async function fetchDashboardControlPlane(params?: { from_ts_ms?: number; to_ts_ms?: number }): Promise<{ ok: boolean; item: DashboardControlPlaneItem }> {
  return apiRequest<{ ok: boolean; item: DashboardControlPlaneItem }>(withQuery("/api/v1/dashboard/control-plane", params));
}

export async function fetchDashboardEvidenceSummary(limit = 6): Promise<DashboardEvidenceItem[]> {
  const res = await safe(
    firstOk<{ ok?: boolean; items?: DashboardEvidenceItem[] }>([
      withQuery("/api/v1/dashboard/evidence/recent", { limit }),
    ]),
    { items: [] as DashboardEvidenceItem[] },
  );
  return Array.isArray(res.items) ? res.items : [];
}

export async function fetchDashboardRecentExecutions(limit = 8): Promise<DashboardRecentExecutionItem[]> {
  const res = await safe(
    apiRequest<{ ok?: boolean; items?: DashboardRecentExecutionItem[] }>(withQuery("/api/v1/dashboard/executions/recent", { limit })),
    { items: [] as DashboardRecentExecutionItem[] },
  );
  return Array.isArray(res.items) ? res.items : [];
}

export async function fetchDashboardAcceptanceRisks(limit = 6): Promise<DashboardAcceptanceRiskItem[]> {
  const res = await safe(
    firstOk<{ ok?: boolean; items?: DashboardAcceptanceRiskItem[] }>([
      withQuery("/api/v1/dashboard/acceptance-risks", { limit }),
      withQuery("/api/v1/dashboard/risk-summary", { limit }),
    ]),
    { items: [] as DashboardAcceptanceRiskItem[] },
  );
  return Array.isArray(res.items) ? res.items : [];
}

export async function fetchDashboardPendingActions(limit = 6): Promise<DashboardPendingActionItem[]> {
  const res = await safe(
    firstOk<{ ok?: boolean; items?: DashboardPendingActionItem[]; actions?: DashboardPendingActionItem[] }>([
      withQuery("/api/v1/dashboard/pending-actions", { limit }),
      withQuery("/api/v1/dashboard/actions", { limit }),
    ]),
    { items: [] as DashboardPendingActionItem[] },
  );
  if (Array.isArray(res.items)) return res.items;
  return Array.isArray(res.actions) ? res.actions : [];
}

export async function fetchDashboardRecommendations(limit = 50): Promise<DashboardRecommendationItem[]> {
  const res = await safe(
    apiRequest<{ ok?: boolean; items?: DashboardRecommendationItem[] }>(withQuery("/api/v1/agronomy/recommendations/control-plane", { limit })),
    { items: [] as DashboardRecommendationItem[] },
  );
  return Array.isArray(res.items) ? res.items : [];
}

export async function getOverview(): Promise<{
  field_count: number;
  normal_field_count: number;
  risk_field_count: number;
  today_execution_count: number;
  pending_acceptance_count: number;
}> {
  const now = Date.now();
  const res = await fetchDashboardOverview({ from_ts_ms: now - 24 * 60 * 60 * 1000, to_ts_ms: now });
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
