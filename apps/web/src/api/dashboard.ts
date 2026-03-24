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

export type DashboardOverview = {
  window: { from_ts_ms: number; to_ts_ms: number };
  summary: DashboardSummary;
  trend_series: DashboardTrendSeries[];
  latest_alerts: DashboardAlertItem[];
  latest_receipts: DashboardReceiptItem[];
  quick_actions: DashboardQuickAction[];
};

export async function fetchDashboardOverview(params?: { from_ts_ms?: number; to_ts_ms?: number }): Promise<DashboardOverview> {
  return apiRequest<DashboardOverview>(withQuery("/api/v1/dashboard/overview", params));
}
