import { useEffect, useState } from "react";
import type { DashboardActionVm, DashboardRiskVm, DashboardVm } from "../viewmodels/dashboard";
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
    potentialBenefitEstimate: "0 条高置信建议",
    nonExecutionRiskEstimate: "0 条执行风险",
  },
  execution: {
    runningTaskCount: 0,
    humanExecutionCount: 0,
    deviceExecutionCount: 0,
    delayedTaskCount: 0,
    invalidExecutionCount: 0,
  },
  operationEffect: {
    validCount: 12,
    deviationCount: 3,
    invalidCount: 2,
  },
  metricUnits: {
    soil_moisture: "%",
    temperature: "°C",
    humidity: "%",
  },
  todayActions: [
    { type: "INVALID_EXECUTION", count: 0 },
    { type: "PENDING_ACCEPTANCE", count: 0 },
    { type: "APPROVAL_REQUIRED", count: 0 },
  ],
  agronomyRecommendations: [],
  cropStageDistribution: [],
  effectSummary: {
    effectiveCount: 0,
    partialCount: 0,
    ineffectiveCount: 0,
    noDataCount: 0,
  },
  agronomyValue: {
    weeklyRecommendationCount: 0,
    verdictCounts: {
      SUCCESS: 0,
      PARTIAL: 0,
      FAILED: 0,
      NO_DATA: 0,
    },
    successRate: 0,
    topRules: [],
    riskRules: [],
  },
};

function normalizePercentMetric(value: unknown): number | null {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  if (n >= 0 && n <= 1) return Number((n * 100).toFixed(2));
  return Number(n.toFixed(2));
}

function normalizeTemperatureMetric(value: unknown): number | null {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Number(n.toFixed(2));
}

function normalizeModelMetrics(metrics: any): any {
  if (!metrics || typeof metrics !== "object") return metrics;
  return {
    ...metrics,
    soil_moisture: normalizePercentMetric(metrics.soil_moisture),
    temperature: normalizeTemperatureMetric(metrics.temperature),
    humidity: normalizePercentMetric(metrics.humidity),
    units: {
      soil_moisture: "%",
      temperature: "°C",
      humidity: "%",
    },
  };
}

function mapRiskSource(title: string): DashboardRiskVm["source"] {
  const t = title.toLowerCase();
  if (t.includes("旱") || t.includes("dry") || t.includes("moisture")) return "干旱";
  if (t.includes("病") || t.includes("pest") || t.includes("disease")) return "病害";
  return "执行缺失";
}

function mapCropLabel(cropCode: unknown): string {
  const code = String(cropCode ?? "").trim().toUpperCase();
  if (!code) return "-";
  if (code === "CORN") return "玉米";
  if (code === "TOMATO") return "番茄";
  if (code === "WHEAT") return "小麦";
  if (code === "RICE") return "水稻";
  return String(cropCode);
}

function mapCropStageLabel(stageCode: unknown): string {
  const stage = String(stageCode ?? "").trim().toUpperCase();
  if (!stage) return "-";
  if (["VEGETATIVE", "V", "GROWTH"].includes(stage)) return "营养生长期";
  if (["REPRODUCTIVE", "R", "FLOWERING"].includes(stage)) return "生殖生长期";
  if (["SEEDLING", "EMERGENCE"].includes(stage)) return "苗期";
  if (["MATURITY", "MATURE"].includes(stage)) return "成熟期";
  return String(stageCode);
}

function mapAgronomyActionLabel(actionType: unknown): string {
  const action = String(actionType ?? "").trim().toUpperCase();
  if (!action) return "-";
  if (action === "IRRIGATION") return "灌溉";
  if (action === "FERTILIZATION") return "施肥";
  if (action === "SPRAYING") return "喷施";
  if (action === "HARVEST") return "收获";
  return String(actionType);
}

function mapPriorityLabel(priority: unknown): string {
  const p = String(priority ?? "").trim().toUpperCase();
  if (!p) return "-";
  if (p === "HIGH") return "高";
  if (p === "MEDIUM") return "中";
  if (p === "LOW") return "低";
  return String(priority);
}

function mapEffectCategory(item: any): "effective" | "partial" | "ineffective" | "no_data" {
  const raw = String(
    item?.effect_status
    ?? item?.effectiveness_status
    ?? item?.effectiveness
    ?? item?.feedback_status
    ?? item?.outcome
    ?? item?.result
    ?? "",
  ).trim().toUpperCase();
  if (!raw) return "no_data";
  if (["EFFECTIVE", "SUCCESS", "SUCCEEDED", "PASS", "VALID"].includes(raw)) return "effective";
  if (["PARTIAL", "PARTIALLY_EFFECTIVE", "PARTIALLY_VALID"].includes(raw)) return "partial";
  if (["INEFFECTIVE", "INVALID", "FAILED", "FAIL", "REJECTED"].includes(raw)) return "ineffective";
  return "no_data";
}

export function useDashboard(api: any): { data: DashboardVm; error: string | null } {
  const [data, setData] = useState<DashboardVm>(DEFAULT_DASHBOARD_DATA);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function load(): Promise<void> {
      const safeList = async <T,>(loader: (() => Promise<T[] | undefined> | undefined) | undefined): Promise<T[]> => {
        if (!loader) return [];
        try {
          const request = loader();
          if (!request) return [];
          const list = await request;
          return Array.isArray(list) ? list : [];
        } catch {
          return [];
        }
      };

      try {
        const now = Date.now();
        const from = now - 7 * 24 * 60 * 60 * 1000;
        const overview = await api.getOverview?.({
          from_ts_ms: from,
          to_ts_ms: now,
        });
        const executions = await safeList(() => api.getRecentExecutions?.({ limit: 8 }));
        const useLegacyRiskEndpoints = Boolean(api?.enableLegacyDashboardEndpoints);
        const riskItems = useLegacyRiskEndpoints
          ? await safeList(() => api.getAcceptanceRisks?.({ limit: 6 }))
          : [];
        const pendingItems = useLegacyRiskEndpoints
          ? await safeList(() => api.getPendingActions?.({ limit: 6 }))
          : [];
        const recommendationItems = await safeList(() => api.getRecommendations?.({ limit: 50 }));
        const operationStates = await safeList(() => api.getOperationStates?.({ limit: 100 }));
        const assignments = await safeList(() => api.getAssignments?.({ limit: 100 }));

        let evidences: any[] = [];
        evidences = await safeList(() => api.getRecentEvidence?.({ limit: 5 }));

        if (!mounted) return;

        const executionList = executions ?? [];
        const mappedActions: DashboardActionVm[] = executionList.map((o: any) => {
          const status = String(o?.status || o?.final_status || "").toUpperCase();
          const finalStatus: DashboardActionVm["finalStatus"] = status === "SUCCEEDED"
            ? "succeeded"
            : status === "FAILED"
              ? "failed"
              : status === "INVALID_EXECUTION"
                ? "invalid"
                : status === "PENDING"
                  ? "pending"
                  : "running";
          return {
            id: String(o?.operation_id || o?.operation_plan_id || o?.task_id || Math.random()),
            title: "作业执行",
            subjectName: o?.field_name || o?.field_id || o?.device_id || "-",
            actionLabel: o?.action_type || "执行任务",
            occurredAtLabel: new Date(o?.occurred_at || o?.last_event_ts || o?.updated_ts_ms || Date.now()).toLocaleString(),
            statusLabel: resolveTimelineLabel({ operationPlanStatus: o?.status || o?.final_status, dispatchState: o?.dispatch_status }),
            finalStatus,
            hasEvidence: Boolean(o?.receipt_fact_id),
            href: toOperationDetailPath(o),
          };
        });

        const mappedRisks = [
          ...(riskItems ?? []).map((item: any) => `RISK|${item?.title || "验收风险"}${item?.level ? ` · ${item.level}` : ""}`),
          ...(pendingItems ?? []).map((item: any) => `APPROVAL|${item?.label || "待审批建议"}`),
        ].filter(Boolean).slice(0, 10);

        const mappedRiskItems: DashboardRiskVm[] = (riskItems ?? []).map((item: any, idx: number) => {
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

        const recommendationList = (recommendationItems ?? []).map((item: any) => ({
          ...item,
          normalized_metrics: normalizeModelMetrics(item?.metrics ?? item?.model_metrics),
        }));
        const recentAgronomyRecommendations = [...(recommendationItems ?? [])]
          .sort((a: any, b: any) => Number(b?.updated_ts_ms ?? 0) - Number(a?.updated_ts_ms ?? 0))
          .slice(0, 6)
          .map((item: any) => ({
            fieldLabel: String(item?.field?.field_name ?? item?.field?.field_id ?? item?.field_id ?? "-"),
            cropLabel: mapCropLabel(item?.crop_code ?? item?.cropCode),
            cropStageLabel: mapCropStageLabel(item?.crop_stage ?? item?.cropStage),
            actionLabel: mapAgronomyActionLabel(item?.action_type ?? item?.suggested_action?.action_type),
            priorityLabel: mapPriorityLabel(item?.priority),
            summary: String(item?.summary ?? item?.reason_summary ?? "-"),
          }));
        const cropStageDistribution = Object.values(
          (recommendationItems ?? []).reduce((acc: Record<string, { cropLabel: string; cropStageLabel: string; fieldIds: Set<string>; fallbackCount: number }>, item: any) => {
            const cropLabel = mapCropLabel(item?.crop_code ?? item?.cropCode);
            const cropStageLabel = mapCropStageLabel(item?.crop_stage ?? item?.cropStage);
            const key = `${cropLabel}|${cropStageLabel}`;
            if (!acc[key]) {
              acc[key] = { cropLabel, cropStageLabel, fieldIds: new Set<string>(), fallbackCount: 0 };
            }
            const fieldId = String(item?.field?.field_id ?? item?.field_id ?? "").trim();
            if (fieldId) acc[key].fieldIds.add(fieldId);
            else acc[key].fallbackCount += 1;
            return acc;
          }, {}),
        )
          .map((entry) => ({
            cropLabel: entry.cropLabel,
            cropStageLabel: entry.cropStageLabel,
            fieldCount: entry.fieldIds.size || entry.fallbackCount,
          }))
          .filter((entry) => entry.fieldCount > 0)
          .sort((a, b) => b.fieldCount - a.fieldCount)
          .slice(0, 6);
        const effectSummary = (recommendationItems ?? []).reduce(
          (acc: { effectiveCount: number; partialCount: number; ineffectiveCount: number; noDataCount: number }, item: any) => {
            const category = mapEffectCategory(item);
            if (category === "effective") acc.effectiveCount += 1;
            else if (category === "partial") acc.partialCount += 1;
            else if (category === "ineffective") acc.ineffectiveCount += 1;
            else acc.noDataCount += 1;
            return acc;
          },
          {
            effectiveCount: 0,
            partialCount: 0,
            ineffectiveCount: 0,
            noDataCount: 0,
          },
        );
        const pendingRecommendationCount = recommendationList.filter((item: any) => {
          if (item?.pending != null) return Boolean(item.pending);
          return !item?.linked_refs?.receipt_fact_id;
        }).length;
        const pendingApprovalCount = (pendingItems ?? []).length;
        const highConfidenceRecommendationCount = recommendationList.filter((item: any) => {
          const confidence = Number(item?.confidence);
          return Number.isFinite(confidence) && confidence >= 0.8;
        }).length;
        const executionRiskCount = (mappedRiskItems ?? []).filter((item: DashboardRiskVm) => item.source === "执行缺失").length;

        const isRunningOperation = (item: any): boolean => {
          const finalStatus = String(item?.final_status ?? "").toUpperCase();
          if (["SUCCEEDED", "FAILED", "CANCELLED"].includes(finalStatus)) return false;
          return true;
        };
        const runningOperationItems = (operationStates ?? []).filter((item: any) => isRunningOperation(item));
        const activeAssignmentStatuses = new Set(["ASSIGNED", "ACCEPTED", "ARRIVED"]);
        const activeAssignments = (assignments ?? []).filter((item: any) => activeAssignmentStatuses.has(String(item?.status || "").toUpperCase()));
        const humanTaskIds = new Set(activeAssignments.map((item: any) => String(item?.act_task_id || "")).filter(Boolean));
        const humanExecutionCount = runningOperationItems.filter((item: any) => humanTaskIds.has(String(item?.task_id || ""))).length;
        const runningTaskCount = runningOperationItems.length;
        const deviceExecutionCount = Math.max(0, runningTaskCount - humanExecutionCount);
        const nowMs = Date.now();
        const delayedTaskCount = runningOperationItems.filter((item: any) => {
          const lastEventTs = Number(item?.last_event_ts ?? 0);
          return Number.isFinite(lastEventTs) && lastEventTs > 0 && nowMs - lastEventTs > 2 * 60 * 60 * 1000;
        }).length;
        const invalidExecutionCount = (operationStates ?? []).filter((o: any) => String(o?.final_status ?? "").toUpperCase() === "INVALID_EXECUTION").length;
        const validExecutionCount = (operationStates ?? []).filter((o: any) => {
          const status = String(o?.final_status ?? "").toUpperCase();
          return status === "SUCCESS" || status === "SUCCEEDED";
        }).length;
        const deviationExecutionCount = (operationStates ?? []).filter((o: any) => {
          const status = String(o?.final_status ?? "").toUpperCase();
          return status === "FAILED" || status === "CANCELLED";
        }).length;
        const pendingAcceptanceCount = (operationStates ?? []).filter((o: any) => String(o?.final_status ?? "").toUpperCase() === "PENDING_ACCEPTANCE").length;
        const approvalRequiredCount = pendingRecommendationCount + pendingApprovalCount;
        const todayActions = [
          { type: "INVALID_EXECUTION" as const, count: invalidExecutionCount },
          { type: "PENDING_ACCEPTANCE" as const, count: pendingAcceptanceCount },
          { type: "APPROVAL_REQUIRED" as const, count: approvalRequiredCount },
          { type: "GENERAL_REMINDER" as const, count: Math.max(runningTaskCount, delayedTaskCount) },
        ];
        const oneWeekMs = 7 * 24 * 60 * 60 * 1000;
        const weeklyOperationIds = (operationStates ?? [])
          .filter((item: any) => {
            const ts = Number(item?.last_event_ts ?? 0);
            return Number.isFinite(ts) && ts > 0 && now - ts <= oneWeekMs;
          })
          .map((item: any) => String(item?.operation_id ?? item?.operation_plan_id ?? "").trim())
          .filter(Boolean)
          .slice(0, 40);
        const evidencePacks = api.getOperationEvidence
          ? (await Promise.all(weeklyOperationIds.map(async (id: string) => {
            try {
              return await api.getOperationEvidence(id);
            } catch {
              return null;
            }
          }))).filter(Boolean)
          : [];
        const agronomyVerdictCounts = evidencePacks.reduce(
          (acc: { SUCCESS: number; PARTIAL: number; FAILED: number; NO_DATA: number }, pack: any) => {
            const verdict = String(pack?.effect_verdict ?? "NO_DATA").trim().toUpperCase();
            if (verdict === "SUCCESS") acc.SUCCESS += 1;
            else if (verdict === "PARTIAL") acc.PARTIAL += 1;
            else if (verdict === "FAILED") acc.FAILED += 1;
            else acc.NO_DATA += 1;
            return acc;
          },
          { SUCCESS: 0, PARTIAL: 0, FAILED: 0, NO_DATA: 0 },
        );
        const weeklyRecommendationCount = evidencePacks.length;
        const successRate = weeklyRecommendationCount > 0
          ? Number((agronomyVerdictCounts.SUCCESS / weeklyRecommendationCount).toFixed(4))
          : 0;
        const ruleStats = evidencePacks.reduce((acc: Map<string, { triggerCount: number; successCount: number }>, pack: any) => {
          const ruleId = String(pack?.decision?.rule_id ?? "").trim();
          if (!ruleId) return acc;
          const current = acc.get(ruleId) ?? { triggerCount: 0, successCount: 0 };
          current.triggerCount += 1;
          const verdict = String(pack?.effect_verdict ?? "").trim().toUpperCase();
          if (verdict === "SUCCESS") current.successCount += 1;
          acc.set(ruleId, current);
          return acc;
        }, new Map<string, { triggerCount: number; successCount: number }>());
        const rankedRules = Array.from(ruleStats.entries())
          .map(([ruleId, stats]) => ({
            ruleId,
            successRate: stats.triggerCount > 0 ? Number((stats.successCount / stats.triggerCount).toFixed(4)) : 0,
            triggerCount: stats.triggerCount,
          }))
          .sort((a, b) => {
            if (b.triggerCount !== a.triggerCount) return b.triggerCount - a.triggerCount;
            return b.successRate - a.successRate;
          });
        const topRules = rankedRules.slice(0, 3);
        const riskRules = rankedRules
          .filter((item) => item.triggerCount >= 2 && item.successRate < 0.6)
          .sort((a, b) => {
            if (b.triggerCount !== a.triggerCount) return b.triggerCount - a.triggerCount;
            return a.successRate - b.successRate;
          })
          .slice(0, 3);

        setData({
          overview: {
            fieldCount: overview?.field_count ?? overview?.fieldCount ?? 0,
            normalFieldCount: overview?.normal_field_count ?? overview?.normalFieldCount ?? 0,
            riskFieldCount: overview?.risk_field_count ?? overview?.riskFieldCount ?? 0,
            todayExecutionCount: overview?.today_execution_count ?? overview?.todayExecutionCount ?? 0,
            pendingAcceptanceCount: overview?.pending_acceptance_count ?? overview?.pendingAcceptanceCount ?? 0,
          },
          actions: mappedActions,
          evidences: (evidences ?? []).map((item: any, i: number) => ({
            id: String(item?.receipt_fact_id || item?.operation_plan_id || i),
            href: toOperationDetailPath(item),
            fieldName: item?.field_name || item?.field_id || "田块",
            operationName: item?.program_name || item?.executor_label || "作业",
            operation_state_v1: {
              final_status: item?.operation_state_v1?.final_status ?? item?.final_status ?? item?.status ?? null,
            },
            card: mapDashboardEvidenceToVm({
              ...item,
              normalized_metrics: normalizeModelMetrics(
                item?.normalized_metrics
                ?? item?.summary?.metrics
                ?? item?.summary?.before_metrics
                ?? item?.summary?.after_metrics,
              ),
              href: toOperationDetailPath(item),
            }),
          })),
          risks: mappedRisks,
          riskItems: mappedRiskItems,
          decisions: {
            pendingApprovalCount,
            pendingRecommendationCount,
            potentialBenefitEstimate: `${highConfidenceRecommendationCount} 条高置信建议`,
            nonExecutionRiskEstimate: `${executionRiskCount} 条执行风险`,
          },
          execution: {
            runningTaskCount,
            humanExecutionCount,
            deviceExecutionCount,
            delayedTaskCount,
            invalidExecutionCount,
          },
          operationEffect: {
            validCount: validExecutionCount || DEFAULT_DASHBOARD_DATA.operationEffect.validCount,
            deviationCount: deviationExecutionCount || DEFAULT_DASHBOARD_DATA.operationEffect.deviationCount,
            invalidCount: invalidExecutionCount || DEFAULT_DASHBOARD_DATA.operationEffect.invalidCount,
          },
          metricUnits: {
            soil_moisture: "%",
            temperature: "°C",
            humidity: "%",
          },
          todayActions,
          agronomyRecommendations: recentAgronomyRecommendations,
          cropStageDistribution,
          effectSummary,
          agronomyValue: {
            weeklyRecommendationCount,
            verdictCounts: agronomyVerdictCounts,
            successRate,
            topRules,
            riskRules,
          },
        });
        setError(null);
      } catch {
        if (!mounted) return;
        setData(DEFAULT_DASHBOARD_DATA);
        setError(null);
      }
    }

    void load().catch(() => undefined);
    return () => {
      mounted = false;
    };
  }, [api]);

  return { data, error };
}
