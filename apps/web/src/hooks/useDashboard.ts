import { useEffect, useState } from "react";
import type { DashboardVm } from "../viewmodels/dashboard";
import { mapDashboardEvidenceToVm } from "../viewmodels/evidence";
import { resolveTimelineLabel } from "../viewmodels/timelineLabels";

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
        const executions = await api.getRecentExecutions?.({ limit: 8 }) || [];

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
          actions: (executions || []).map((o: any) => {
            const status = String(o?.status || o?.final_status || "").toUpperCase();
            return {
              id: String(o?.operation_id || o?.operation_plan_id || o?.task_id || Math.random()),
              title: "作业执行",
              subjectName: o?.field_name || o?.field_id || o?.device_id || "-",
              actionLabel: o?.action_type || "执行任务",
              occurredAtLabel: new Date(o?.occurred_at || o?.last_event_ts || o?.updated_ts_ms || Date.now()).toLocaleString(),
              statusLabel: resolveTimelineLabel({ operationPlanStatus: o?.status || o?.final_status, dispatchState: o?.dispatch_status }),
              finalStatus: status === "SUCCEEDED" ? "succeeded" : status === "FAILED" ? "failed" : status === "PENDING" ? "pending" : "running",
              hasEvidence: Boolean(o?.receipt_fact_id),
              href: typeof o?.href === "string" ? o.href : `/operations?operation_plan_id=${encodeURIComponent(String(o?.operation_plan_id || o?.operation_id || ""))}`,
            };
          }),
          evidences: (evidences || []).map((item: any, i: number) => ({
            id: String(item?.receipt_fact_id || item?.operation_plan_id || i),
            href: typeof item?.href === "string" ? item.href : undefined,
            card: mapDashboardEvidenceToVm(item),
          })),
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
