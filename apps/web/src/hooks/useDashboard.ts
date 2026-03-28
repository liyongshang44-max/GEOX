import { useEffect, useState } from "react";
import type { DashboardVm } from "../viewmodels/dashboard";

const DEFAULT_DASHBOARD_DATA: DashboardVm = {
  overview: {
    inProgressCount: 0,
    completedTodayCount: 0,
    pendingCount: 0,
    riskDeviceCount: 0,
  },
  actions: [],
  evidences: [],
  risks: [],
};

export function useDashboard(api: any): DashboardVm {
  const [data, setData] = useState<DashboardVm>(DEFAULT_DASHBOARD_DATA);

  useEffect(() => {
    let mounted = true;

    async function load(): Promise<void> {
      try {
        const overview = await api.getOverview();
        const ops = await api.getOperations?.({ limit: 8 }) || [];

        let evidences: any[] = [];
        try {
          evidences = await api.getRecentEvidence?.({ limit: 5 });
        } catch {
          evidences = [];
        }

        if (!mounted) return;

        setData({
          overview: {
            inProgressCount: overview?.in_progress ?? overview?.inProgressCount ?? 0,
            completedTodayCount: overview?.completed_today ?? overview?.completedTodayCount ?? 0,
            pendingCount: overview?.pending ?? overview?.pendingCount ?? 0,
            riskDeviceCount: overview?.risk_devices ?? overview?.riskDeviceCount ?? 0,
          },
          actions: (ops || []).map((o: any) => {
            const status = String(o?.final_status || "").toUpperCase();
            return {
              id: String(o?.operation_id || o?.operation_plan_id || o?.task_id || Math.random()),
              title: "作业执行",
              subjectName: o?.field_name || o?.device_id || "-",
              actionLabel: o?.action_type || "执行任务",
              occurredAtLabel: new Date(o?.occurred_at || o?.last_event_ts || Date.now()).toLocaleString(),
              statusLabel: status === "SUCCEEDED" ? "已完成" : status === "FAILED" ? "执行失败" : "执行中",
              finalStatus: status === "SUCCEEDED" ? "succeeded" : status === "FAILED" ? "failed" : status === "PENDING" ? "pending" : "running",
              hasEvidence: Boolean(o?.receipt_fact_id),
            };
          }),
          evidences,
          risks: [],
        });
      } catch {
        setData((d) => ({ ...d }));
      }
    }

    void load();
    return () => {
      mounted = false;
    };
  }, [api]);

  return data;
}
