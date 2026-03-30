import { useEffect, useState } from "react";
import type { DashboardRiskVm, DashboardVm } from "../viewmodels/dashboard";
import { mapDashboardEvidenceToVm } from "../viewmodels/evidence";
import { resolveTimelineLabel } from "../viewmodels/timelineLabels";
import { toOperationDetailPath } from "../lib/operationLink";

const DEFAULT_DASHBOARD_DATA: DashboardVm = {
  overview: {
    fieldCount: 0,
    normalFieldCount: 0,
    riskFieldCount: 0,
    todayExecutionCount: 0,
    pendingAcceptanceCount: 0,
  },
  actions: [],
  evidences: [],
  risks: [],
  riskItems: [],
  decisions: {
    pendingApprovalCount: 0,
    pendingRecommendationCount: 0,
    potentialBenefitEstimate: "0%",
    nonExecutionRiskEstimate: "0%",
  },
};

function mapRiskSource(title: string): DashboardRiskVm["source"] {
  const t = title.toLowerCase();
  if (t.includes("旱") || t.includes("dry") || t.includes("moisture")) return "干旱";
  if (t.includes("病") || t.includes("pest") || t.includes("disease")) return "病害";
  return "执行缺失";
}

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
        const recommendationItems = await api.getRecommendations?.({ limit: 50 }) || [];

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

        const mappedRiskItems: DashboardRiskVm[] = (riskItems || []).map((item: any, idx: number) => {
          const rawLevel = String(item?.level || "").toUpperCase();
          const level: DashboardRiskVm["level"] = rawLevel === "HIGH" ? "HIGH" : rawLevel === "LOW" ? "LOW" : "MEDIUM";
          const title = String(item?.title || "验收风险");
          return {
            id: String(item?.id || idx),
            title,
            level,
            source: mapRiskSource(title),
            fieldId: typeof item?.field_id === "string" && item.field_id ? item.field_id : undefined,
          };
        });

        const pendingRecommendationCount = (recommendationItems || []).filter((item: any) => {
          if (item?.pending != null) return Boolean(item.pending);
          return !item?.linked_refs?.receipt_fact_id;
        }).length;
        const pendingApprovalCount = (pendingItems || []).length;
        const confidenceItems = (recommendationItems || []).map((item: any) => Number(item?.confidence)).filter((x: number) => Number.isFinite(x) && x >= 0);
        const avgConfidence = confidenceItems.length ? confidenceItems.reduce((a: number, b: number) => a + b, 0) / confidenceItems.length : 0;
        const potentialBenefitScore = Math.max(0, Math.min(95, Math.round(pendingRecommendationCount * 6 + avgConfidence * 20)));
        const nonExecutionRiskScore = Math.max(0, Math.min(95, Math.round(pendingRecommendationCount * 8 + mappedRiskItems.length * 5)));

        setData({
          overview: {
            fieldCount: overview?.field_count ?? overview?.fieldCount ?? 0,
            normalFieldCount: overview?.normal_field_count ?? overview?.normalFieldCount ?? 0,
            riskFieldCount: overview?.risk_field_count ?? overview?.riskFieldCount ?? 0,
            todayExecutionCount: overview?.today_execution_count ?? overview?.todayExecutionCount ?? 0,
            pendingAcceptanceCount: overview?.pending_acceptance_count ?? overview?.pendingAcceptanceCount ?? 0,
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
          riskItems: mappedRiskItems,
          decisions: {
            pendingApprovalCount,
            pendingRecommendationCount,
            potentialBenefitEstimate: `${potentialBenefitScore}%`,
            nonExecutionRiskEstimate: `${nonExecutionRiskScore}%`,
          },
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
