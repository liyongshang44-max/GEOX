import { useEffect, useState } from "react";
import type { DashboardVm } from "../viewmodels/dashboard";
import { mapDashboardEvidenceToVm } from "../viewmodels/evidence";
import { resolveTimelineLabel } from "../viewmodels/timelineLabels";
import { toOperationDetailPath } from "../lib/operationLink";

const DEFAULT_DASHBOARD_DATA: DashboardVm = {
  overview: {
    onlineDeviceCount: 0,
    inProgressCount: 0,
    completedTodayCount: 0,
    pendingCount: 0,
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
        const riskItems = await api.getAcceptanceRisks?.({ limit: 6 }) || [];
        const pendingItems = await api.getPendingActions?.({ limit: 6 }) || [];

        let evidences: any[] = [];
        try {
          evidences = await api.getRecentEvidence?.({ limit: 5 });
        } catch {
          evidences = [];
        }

        if (!mounted) return;

        const mappedActions = (executions || []).map((o: any) => {
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
            href: toOperationDetailPath(o),
          };
        });

        const mappedRisks = [
          ...(riskItems || []).map((item: any) => `RISK|${item?.title || "验收风险"}${item?.level ? ` · ${item.level}` : ""}`),
          ...(pendingItems || []).map((item: any) => `APPROVAL|${item?.label || "待审批建议"}`),
        ].filter(Boolean).slice(0, 10);

        setData({
          overview: {
            onlineDeviceCount: overview?.online_device_count ?? overview?.onlineDeviceCount ?? 0,
            inProgressCount: overview?.in_progress ?? overview?.inProgressCount ?? 0,
            completedTodayCount: overview?.completed_today ?? overview?.completedTodayCount ?? 0,
            pendingCount: overview?.pending ?? overview?.pendingCount ?? 0,
          },
          actions: mappedActions,
          evidences: (evidences || []).map((item: any, i: number) => ({
            id: String(item?.receipt_fact_id || item?.operation_plan_id || i),
            href: toOperationDetailPath(item),
            fieldName: item?.field_name || item?.field_id || "田块",
            operationName: item?.program_name || item?.executor_label || "作业",
            hasReceipt: Boolean(item?.receipt_fact_id),
            acceptanceVerdict: String(item?.acceptance_verdict ?? "PENDING").toUpperCase(),
            isPendingAcceptance: Boolean(item?.is_pending_acceptance ?? (item?.receipt_fact_id && String(item?.acceptance_verdict ?? "PENDING").toUpperCase() !== "PASS")),
            card: mapDashboardEvidenceToVm({
              ...item,
              href: toOperationDetailPath(item),
            }),
          })),
          risks: mappedRisks,
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
