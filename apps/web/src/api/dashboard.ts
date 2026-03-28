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
export type DashboardEvidenceItem = { job_id: string; status: string; scope_type?: string | null; created_at?: string | null; updated_at?: string | null };
export type DashboardAcceptanceRiskItem = { id: string; field_id?: string | null; title: string; level: string; occurred_at?: string | null };
export type DashboardPendingActionItem = { id: string; key: string; label: string; status?: string | null; to?: string | null };

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
    firstOk<{ ok?: boolean; items?: DashboardEvidenceItem[]; jobs?: DashboardEvidenceItem[] }>([
      withQuery("/api/v1/dashboard/evidence/recent", { limit }),
      withQuery("/api/v1/evidence-export/jobs", { limit }),
    ]),
    { items: [] as DashboardEvidenceItem[] },
  );
  if (Array.isArray(res.items)) return res.items;
  return Array.isArray(res.jobs) ? res.jobs : [];
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

export async function getOverview(): Promise<{ in_progress: number; completed_today: number; pending: number; risk_devices: number }> {
  const now = Date.now();
  const res = await fetchDashboardOverview({ from_ts_ms: now - 24 * 60 * 60 * 1000, to_ts_ms: now });
  return {
    in_progress: Number(res?.summary?.running_task_count ?? 0),
    completed_today: 0,
    pending: 0,
    risk_devices: Number(res?.summary?.open_alert_count ?? 0),
  };
}

export async function getRecentEvidence(params?: { limit?: number }): Promise<DashboardEvidenceItem[]> {
  return fetchDashboardEvidenceSummary(params?.limit ?? 5);
}
