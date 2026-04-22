import React from "react";
import { useNavigate } from "react-router-dom";
import {
  fetchDashboardRecommendations,
  fetchDashboardRecentExecutions,
  fetchDashboardOperationStates,
  fetchDashboardAssignments,
  fetchDashboardOverview,
  getRecentEvidence,
  fetchDashboardOverviewV2,
  fetchDashboardFieldSensingSummary,
  fetchSlaSummary,
  type DashboardFieldSensingSummary,
  type DashboardTopActionItem,
  type DashboardRecommendationItem,
  type SlaSummary,
} from "../../../api/dashboard";
import { fetchOperationStates } from "../../../api";
import { fetchOperationBilling, fetchOperationEvidencePack } from "../../../api/operations";
import { executeOperationAction } from "../../../api/operations";
import ErrorState from "../../../components/common/ErrorState";
import OverviewMetrics from "../sections/OverviewMetrics";
import SensingRuntimeStatus from "../sections/SensingRuntimeStatus";
import TodayPriority from "../sections/TodayPriority";
import FieldRuntime from "../sections/FieldRuntime";
import DecisionOperationQueue from "../sections/DecisionOperationQueue";
import EvidenceOutcome from "../sections/EvidenceOutcome";
import SkillOverview from "../sections/SkillOverview";
import SkillAffectedOperations from "../sections/SkillAffectedOperations";
import MissingSkillCoverage from "../sections/MissingSkillCoverage";
import DashboardPageContainer from "./DashboardPageContainer";
import { useDashboard } from "../../../hooks/useDashboard";
import { parseFieldReadModelV1, toReadableRecommendationBias, toReadableSalinityRisk, toReadableStatusLabel } from "../../../lib/fieldReadModelV1";
import { getMetricDisplayLabelZh, isCustomerPrimaryMetric, shouldShowMetricOnDashboard } from "../../../lib/metricDisplayPolicy";
import { formatSourceMeta, resolveSourceMeta } from "../../../lib/dataOrigin";
import type { DataOriginValue } from "../../../lib/dataOrigin";
import { extractBootstrapContext, type BootstrapContext } from "../../../lib/bootstrapContext";

function normalizeNumericMetric(value: unknown): number | null {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Number(n.toFixed(2));
}

function normalizeReadModel(recommendation: any): {
  sensing_status: string | null;
  sensing_freshness: string | null;
  fertility_state: string | null;
  fertility_freshness: string | null;
  salinity_risk: string | null;
  confidence: number | null;
  recommendation_bias: string | null;
  last_updated: string | number | null;
  source_label: string | null;
  source_kind: DataOriginValue | null;
  source_type: DataOriginValue | null;
  data_origin: DataOriginValue | null;
} {
  const parsed = parseFieldReadModelV1(recommendation, { enableLegacyFallback: false });
  const sensingSource = recommendation?.read_model?.field_sensing_overview_v1 ?? recommendation?.read_model?.sensing_overview ?? {};
  const fertilitySource = recommendation?.read_model?.field_fertility_state_v1 ?? recommendation?.read_model?.fertility_state ?? {};
  const sourceMeta = resolveSourceMeta(
    {
      source_kind: sensingSource?.source_kind ?? fertilitySource?.source_kind ?? recommendation?.source_kind,
      source_type: sensingSource?.source_type ?? fertilitySource?.source_type ?? recommendation?.source_type,
      data_origin: sensingSource?.data_origin ?? fertilitySource?.data_origin ?? recommendation?.data_origin,
    },
    { source_kind: "derived_state", source_type: "derived_state", data_origin: "derived_state" },
  );
  return {
    sensing_status: toReadableStatusLabel(parsed.sensing?.status ?? null),
    sensing_freshness: parsed.sensing?.sensorQuality ?? null,
    fertility_state: toReadableStatusLabel(parsed.fertility?.fertilityState ?? parsed.fertility?.status ?? null),
    fertility_freshness: parsed.fertility?.statusLabel ?? null,
    salinity_risk: parsed.fertility?.salinityRiskLabel ?? toReadableSalinityRisk(parsed.fertility?.salinityRisk),
    confidence: normalizeNumericMetric(parsed.fertility?.confidence),
    recommendation_bias: toReadableRecommendationBias(parsed.fertility?.recommendationBias),
    last_updated: parsed.fertility?.updatedAtMs ?? parsed.sensing?.updatedAtMs ?? recommendation?.updated_ts_ms ?? null,
    source_label: formatSourceMeta(sourceMeta),
    source_kind: sourceMeta.source_kind,
    source_type: sourceMeta.source_type,
    data_origin: sourceMeta.data_origin,
  };
}

export default function CommercialDashboardPage({ expert = false }: { expert?: boolean }): React.ReactElement {
  const navigate = useNavigate();
  const api = React.useMemo(
    () => ({
      getOverview: async (params?: { from_ts_ms?: number; to_ts_ms?: number }) => {
        const overview = await fetchDashboardOverview(params);
        const summary = overview?.summary ?? {};
        const fieldCount = Number(summary.field_count ?? 0);
        const openAlertCount = Number(summary.open_alert_count ?? 0);
        return {
          field_count: fieldCount,
          normal_field_count: Math.max(0, fieldCount - openAlertCount),
          risk_field_count: openAlertCount,
          today_execution_count: Number(summary.running_task_count ?? 0),
          pending_acceptance_count: (overview?.latest_receipts ?? []).filter(
            (item) => String(item?.status ?? "").toUpperCase() !== "PASS"
          ).length,
        };
      },
      getRecentExecutions: async (params?: { limit?: number }) => fetchDashboardRecentExecutions(params?.limit ?? 8),
      getRecentEvidence,
      getRecommendations: async (params?: { limit?: number }) => fetchDashboardRecommendations(params?.limit ?? 50),
      getOperationStates: async (params?: { limit?: number }) => fetchDashboardOperationStates(params?.limit ?? 100),
      getOperationEvidence: async (operationId: string) => fetchOperationEvidencePack(operationId),
      getAssignments: async (params?: { limit?: number }) => fetchDashboardAssignments(params?.limit ?? 100),
      enableLegacyDashboardEndpoints: false,
    }),
    [],
  );
  const { data: d, error } = useDashboard(api);
  const [sla, setSla] = React.useState<SlaSummary>({
    total_operations: 0,
    success_rate: 0,
    invalid_execution_rate: 0,
    avg_execution_time_ms: 0,
    avg_acceptance_time_ms: 0,
  });
  const [totalRevenue, setTotalRevenue] = React.useState(0);
  const [topActions, setTopActions] = React.useState<DashboardTopActionItem[]>([]);
  const [deviceSummary, setDeviceSummary] = React.useState({ online: 0, offline: 0, busy: 0, low_battery: 0 });
  const [executingActionId, setExecutingActionId] = React.useState<string | null>(null);
  const [executeFeedback, setExecuteFeedback] = React.useState<{ tone: "success" | "warning" | "neutral"; text: string; operationId?: string } | null>(null);
  const [smartRecommendations, setSmartRecommendations] = React.useState<{
    todayCount: number;
    latest: (DashboardRecommendationItem & {
      normalized_read_model?: ReturnType<typeof normalizeReadModel>;
    }) | null;
  }>({ todayCount: 0, latest: null });
  const [latestFieldSensingSummary, setLatestFieldSensingSummary] = React.useState<DashboardFieldSensingSummary | null>(null);
  const [bootstrapContext, setBootstrapContext] = React.useState<BootstrapContext>({
    device_mode: null,
    simulator_started: null,
    simulator_status: null,
    skill_related_note: null,
  });

  React.useEffect(() => {
    let mounted = true;
    void fetchSlaSummary().then((summary) => {
      if (mounted) setSla(summary);
    });
    return () => {
      mounted = false;
    };
  }, []);

  React.useEffect(() => {
    let mounted = true;
    const fieldId = String(smartRecommendations.latest?.field?.field_id ?? "").trim();
    if (!fieldId) {
      setLatestFieldSensingSummary(null);
      return () => { mounted = false; };
    }
    void fetchDashboardFieldSensingSummary(fieldId)
      .then((res) => {
        if (mounted) setLatestFieldSensingSummary(res);
      })
      .catch(() => {
        if (mounted) setLatestFieldSensingSummary(null);
      });
    return () => {
      mounted = false;
    };
  }, [smartRecommendations.latest?.field?.field_id]);

  React.useEffect(() => {
    let mounted = true;
    void fetchDashboardOverviewV2().then((res) => {
      if (!mounted || !res) return;
      setTopActions(Array.isArray(res.top_actions) ? res.top_actions.slice(0, 3) : []);
      setDeviceSummary(res.device_status_summary ?? { online: 0, offline: 0, busy: 0, low_battery: 0 });
      setBootstrapContext(extractBootstrapContext(res, (res as any)?.onboarding_context, (res as any)?.device_context));
    });
    return () => {
      mounted = false;
    };
  }, []);

  React.useEffect(() => {
    let mounted = true;
    void fetchDashboardRecommendations(100).then((items) => {
      if (!mounted) return;
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      const sorted = [...items].sort((a, b) => Number(b.updated_ts_ms ?? 0) - Number(a.updated_ts_ms ?? 0));
      const autoGenerated = items.filter((item) => {
        const ts = Number(item.updated_ts_ms ?? 0);
        if (!Number.isFinite(ts) || ts < startOfDay) return false;
        return String(item.reason_summary ?? "").includes("根据当前作物模型");
      });
      const latest = sorted[0] ?? null;
      setSmartRecommendations({
        todayCount: autoGenerated.length,
        latest: latest ? { ...latest, normalized_read_model: normalizeReadModel(latest) } : null,
      });
    }).catch(() => {
      if (mounted) {
        setSmartRecommendations({ todayCount: 0, latest: null });
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  React.useEffect(() => {
    let mounted = true;
    void (async () => {
      try {
        const ops = await fetchOperationStates({ limit: 100 });
        const successOps = (ops.items ?? [])
          .filter((item: any) => ["SUCCESS", "SUCCEEDED"].includes(String(item?.final_status ?? "").toUpperCase()))
          .slice(0, 50);
        let total = 0;
        for (const item of successOps) {
          const id = String(item.operation_id ?? "").trim();
          if (!id) continue;
          const billing = await fetchOperationBilling(id).catch(() => null);
          if (billing?.billable) total += Number(billing.charge ?? 0);
        }
        if (mounted) setTotalRevenue(total);
      } catch {
        if (mounted) setTotalRevenue(0);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const runningActions = d.actions.filter((x) => x.finalStatus === "pending" || x.finalStatus === "running");
  const priorityOrder: Record<string, number> = {
    INVALID_EXECUTION: 0,
    PENDING_ACCEPTANCE: 1,
    APPROVAL_REQUIRED: 2,
    GENERAL_REMINDER: 3,
  };
  const todayActions = [...(d.todayActions ?? [])].sort((a, b) => (priorityOrder[a.type] ?? 99) - (priorityOrder[b.type] ?? 99));
  const todayActionLabel = (type: string, count: number): string => {
    if (type === "INVALID_EXECUTION") return `修复无效执行（${count}项）`;
    if (type === "PENDING_ACCEPTANCE") return `完成验收（${count}项）`;
    if (type === "GENERAL_REMINDER") return `关注一般提醒（${count}项）`;
    return `审批建议（${count}项）`;
  };
  const todayActionRiskLevel = (type: string): string => {
    if (type === "INVALID_EXECUTION") return "高";
    if (type === "PENDING_ACCEPTANCE") return "中";
    if (type === "APPROVAL_REQUIRED") return "中";
    return "低";
  };
  const todayActionReason = (type: string, count: number): string => {
    if (type === "INVALID_EXECUTION") return `存在 ${count} 项阻断问题，已影响执行闭环。`;
    if (type === "PENDING_ACCEPTANCE") return `已有 ${count} 项执行结果等待验收结论。`;
    if (type === "APPROVAL_REQUIRED") return `当前累计 ${count} 项建议待人工审批。`;
    return `当前有 ${count} 项一般提醒，建议排队跟进。`;
  };
  const todayActionSuggestion = (type: string, count: number): string => {
    if (type === "INVALID_EXECUTION") return `优先排查并补齐阻断项（${count}项）。`;
    if (type === "PENDING_ACCEPTANCE") return `核对证据与约束后完成验收（${count}项）。`;
    if (type === "APPROVAL_REQUIRED") return `按业务优先顺序完成审批（${count}项）。`;
    return `检查提醒并安排处理节奏（${count}项）。`;
  };
  const todayActionCTA = (type: string): string => {
    if (type === "PENDING_ACCEPTANCE") return "去验收";
    if (type === "APPROVAL_REQUIRED") return "去审批";
    return "去处理";
  };
  const todayActionEntryLabel = (type: string): string => {
    if (type === "INVALID_EXECUTION") return "作业列表-阻断";
    if (type === "PENDING_ACCEPTANCE") return "作业列表-待验收";
    if (type === "APPROVAL_REQUIRED") return "建议列表-待审批";
    return "作业列表-一般提醒";
  };
  const todayActionHref = (type: string): string => {
    if (type === "INVALID_EXECUTION") return "/operations?status=invalid_execution&priority=blocked&from=today_priority";
    if (type === "PENDING_ACCEPTANCE") return "/operations?status=done_unaccepted&priority=pending_acceptance&from=today_priority";
    if (type === "APPROVAL_REQUIRED") return "/agronomy/recommendations?status=pending&priority=pending_approval&from=today_priority";
    return "/operations?status=pending&priority=general_reminder&from=today_priority";
  };

  const todayPriorityItems = todayActions.map((item) => ({
    type: item.type,
    count: item.count,
    riskLevel: todayActionRiskLevel(item.type),
    reason: todayActionReason(item.type, item.count),
    suggestedAction: todayActionSuggestion(item.type, item.count),
    linkTarget: todayActionHref(item.type),
    actionLabel: todayActionCTA(item.type),
    entryLabel: todayActionEntryLabel(item.type),
  }));

  const latestReadModel = React.useMemo(() => {
    const sensingOverview = latestFieldSensingSummary?.sensing_overview;
    const fertilityState = latestFieldSensingSummary?.fertility_state;
    if (sensingOverview || fertilityState) {
      const synthesized = {
        updated_ts_ms: (fertilityState as any)?.updated_ts_ms ?? (sensingOverview as any)?.updated_ts_ms ?? null,
        read_model: {
          field_sensing_overview_v1: sensingOverview,
          field_fertility_state_v1: fertilityState,
        },
      };
      const normalized = normalizeReadModel(synthesized);
      return {
        ...normalized,
        sensing_freshness: String(latestFieldSensingSummary?.freshness?.sensing_overview ?? normalized.sensing_freshness ?? "").trim() || null,
        fertility_freshness: String(latestFieldSensingSummary?.freshness?.fertility_state ?? normalized.fertility_freshness ?? "").trim() || null,
      };
    }
    return (smartRecommendations.latest as any)?.normalized_read_model ?? {};
  }, [latestFieldSensingSummary, smartRecommendations.latest]);
  const dashboardPrimaryMetrics = React.useMemo(
    () => (d.diagnosticMetrics ?? [])
      .filter((metric) => shouldShowMetricOnDashboard(metric.metric) && isCustomerPrimaryMetric(metric.metric))
      .map((metric) => ({
        ...metric,
        label: getMetricDisplayLabelZh(metric.metric),
      })),
    [d.diagnosticMetrics],
  );
  const fieldCount = Number(d.overview.fieldCount ?? 0);
  const deviceCount = Number(deviceSummary.online + deviceSummary.offline);
  const hasFirstData = smartRecommendations.latest != null || Number(d.overview.todayExecutionCount ?? 0) > 0;

  const overviewMockData = {
    field_total: fieldCount,
    device_online: Number(deviceSummary.online ?? 0),
    device_offline: Number(deviceSummary.offline ?? 0),
    pending_today: todayActions.reduce((sum, item) => sum + Number(item.count ?? 0), 0),
    anomalies_24h: Number(d.overview.riskFieldCount ?? 0),
    executing_ops: runningActions.length,
  };
  const dashboardContextDescription = [
    `mode=${bootstrapContext.device_mode ?? "-"}`,
    `simulator_started=${bootstrapContext.simulator_started == null ? "-" : String(bootstrapContext.simulator_started)}`,
    `simulator_status=${bootstrapContext.simulator_status ?? "-"}`,
  ].join(" · ");

  const runTopAction = async (item: DashboardTopActionItem): Promise<void> => {
    if (!item.execution_ready || !item.execution_plan) return;
    setExecutingActionId(item.operation_id);
    setExecuteFeedback(null);
    try {
      const res = await executeOperationAction({
        tenant_id: String(item.tenant_id ?? ""),
        project_id: String(item.project_id ?? ""),
        group_id: String(item.group_id ?? ""),
        operation_id: item.operation_id,
        execution_plan: item.execution_plan,
      });
      if (res?.ok) {
        setExecuteFeedback({
          tone: "success",
          text: res.idempotent ? `已复用执行任务 ${res.act_task_id ?? "-"}` : `已创建执行任务 ${res.act_task_id ?? "-"}`,
          operationId: item.operation_id,
        });
      } else {
        setExecuteFeedback({
          tone: "warning",
          text: `执行未完成：${res?.error ?? "UNKNOWN_ERROR"}`,
          operationId: item.operation_id,
        });
      }
      void fetchDashboardOverviewV2().then((res2) => {
        if (!res2) return;
        setTopActions(Array.isArray(res2.top_actions) ? res2.top_actions.slice(0, 3) : []);
      });
    } finally {
      setExecutingActionId(null);
    }
  };

  return (
    <div className="productPage demoDashboardPage">
      {error ? <ErrorState title="页面加载失败" message="系统暂时无法获取当前数据，请稍后重试。" onRetry={() => window.location.reload()} secondaryText="返回总览" onSecondary={() => navigate("/dashboard")} /> : null}

      <DashboardPageContainer
        blocks={[
          {
            zone: "I",
            title: "感知运行状态",
            description: "汇总生效 skill、simulator/真实设备承载关系与最新 telemetry。",
            content: <SensingRuntimeStatus />,
          },
          {
            zone: "A",
            title: "平台总览",
            description: `平台控制台主入口：统一承载运营与技能态势。${dashboardContextDescription}`,
            content: (
              <OverviewMetrics
                expert={expert}
                sla={sla}
                totalRevenue={totalRevenue}
                fieldCount={fieldCount}
                riskFieldCount={d.overview.riskFieldCount}
                todayExecutionCount={d.overview.todayExecutionCount}
                overviewMockData={overviewMockData}
              />
            ),
          },
          {
            zone: "B",
            title: "今日重点",
            description: "统一 riskLevel/reason/suggestedAction/linkTarget 数据结构。",
            content: <TodayPriority todayPriorityItems={todayPriorityItems} todayActionLabel={todayActionLabel} />,
          },
          {
            zone: "C",
            title: "田块与设备",
            description: "关注地块风险与设备连通状态。",
            content: (
              <FieldRuntime
                fieldCount={fieldCount}
                normalFieldCount={d.overview.normalFieldCount}
                riskFieldCount={d.overview.riskFieldCount}
                deviceSummary={deviceSummary}
                deviceCount={deviceCount}
                hasFirstData={hasFirstData}
              />
            ),
          },
          {
            zone: "D",
            title: "决策执行队列",
            description: "决策、执行、反馈闭环。",
            content: (
              <DecisionOperationQueue
                topActions={topActions}
                runTopAction={runTopAction}
                executingActionId={executingActionId}
                executeFeedback={executeFeedback}
                runningActions={runningActions}
              />
            ),
          },
          {
            zone: "E",
            title: "证据与结果",
            description: "验收状态分组与诊断指标。",
            content: (
              <EvidenceOutcome
                evidenceItems={d.evidences}
                smartRecommendations={smartRecommendations}
                latestReadModel={latestReadModel}
                dashboardMetrics={dashboardPrimaryMetrics}
                loadError={error}
              />
            ),
          },
          {
            zone: "F",
            title: "技能概览",
            description: "统一查看技能状态、版本与最新运行健康度。",
            content: <SkillOverview />,
          },
          {
            zone: "G",
            title: "技能影响作业",
            description: "按运行状态追踪技能对作业闭环的影响。",
            content: <SkillAffectedOperations />,
          },
          {
            zone: "H",
            title: "缺失技能覆盖",
            description: "识别未覆盖范围并引导补齐绑定策略。",
            content: <MissingSkillCoverage />,
          },
        ]}
      />
    </div>
  );
}
