import React from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  fetchDashboardRecommendations,
  fetchDashboardRecentExecutions,
  fetchDashboardOperationStates,
  fetchDashboardAssignments,
  getOverview,
  getRecentEvidence,
  fetchDashboardOverviewV2,
  fetchSlaSummary,
  type DashboardTopActionItem,
  type DashboardRecommendationItem,
  type SlaSummary,
} from "../api/dashboard";
import { fetchOperationStates } from "../api";
import { fetchOperationBilling, fetchOperationEvidencePack } from "../api/operations";
import { executeOperationAction } from "../api/operations";
import { useDashboard } from "../hooks/useDashboard";
import { buildOperationSummary, mapFieldDisplayName, mapOperationActionLabel } from "../lib/operationLabels";
import ErrorState from "../components/common/ErrorState";

function EmptyBlock({ text }: { text: string }): React.ReactElement {
  return <div className="card muted" style={{ padding: 16 }}>{text}</div>;
}

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

function normalizeModelMetrics(metrics: any): { soil_moisture: number | null; temperature: number | null; humidity: number | null } {
  return {
    soil_moisture: normalizePercentMetric(metrics?.soil_moisture),
    temperature: normalizeTemperatureMetric(metrics?.temperature),
    humidity: normalizePercentMetric(metrics?.humidity),
  };
}

function EmptyStateGuide({
  fieldCount,
  deviceCount,
  hasFirstData,
}: {
  fieldCount: number;
  deviceCount: number;
  hasFirstData: boolean;
}): React.ReactElement | null {
  if (fieldCount < 1) {
    return (
      <section className="card" style={{ marginBottom: 12 }}>
        <div className="sectionTitle">空态引导：无田块</div>
        <div className="decisionItemMeta">先建田块，再接入设备。</div>
        <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
          <Link className="btn primary" to="/fields/new">新建田块</Link>
          <Link className="btn" to="/fields">查看田块列表</Link>
        </div>
      </section>
    );
  }

  if (deviceCount < 1) {
    return (
      <section className="card" style={{ marginBottom: 12 }}>
        <div className="sectionTitle">空态引导：无设备</div>
        <div className="decisionItemMeta">绑定设备，开启监测。</div>
        <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
          <Link className="btn primary" to="/devices/onboarding">去绑定设备</Link>
          <Link className="btn" to="/devices">设备中心</Link>
        </div>
      </section>
    );
  }

  if (!hasFirstData) {
    return (
      <section className="card" style={{ marginBottom: 12 }}>
        <div className="sectionTitle">空态引导：无首条数据</div>
        <div className="decisionItemMeta">设备已接入，等待首条回传。</div>
        <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
          <Link className="btn primary" to="/devices">查看设备状态</Link>
          <Link className="btn" to="/devices/onboarding">接入说明</Link>
        </div>
      </section>
    );
  }

  return null;
}

function OverviewMetrics({
  expert,
  sla,
  totalRevenue,
  fieldCount,
  riskFieldCount,
  todayExecutionCount,
}: {
  expert: boolean;
  sla: SlaSummary;
  totalRevenue: number;
  fieldCount: number;
  riskFieldCount: number;
  todayExecutionCount: number;
}): React.ReactElement {
  return (
    <section className="operationsSummaryGrid" style={{ marginBottom: 12 }}>
      {expert ? (
        <article className="operationsSummaryMetric card">
          <span className="operationsSummaryLabel">模式</span>
          <strong>研发模式</strong>
        </article>
      ) : null}
      <article className="operationsSummaryMetric card">
        <span className="operationsSummaryLabel">作业成功率</span>
        <strong>{Math.round((sla.success_rate || 0) * 100)}%</strong>
      </article>
      <article className="operationsSummaryMetric card">
        <span className="operationsSummaryLabel">无效执行率</span>
        <strong>{Math.round((sla.invalid_execution_rate || 0) * 100)}%</strong>
      </article>
      <article className="operationsSummaryMetric card">
        <span className="operationsSummaryLabel">风险田块</span>
        <strong>{riskFieldCount} / {fieldCount}</strong>
      </article>
      <article className="operationsSummaryMetric card">
        <span className="operationsSummaryLabel">今日执行</span>
        <strong>{todayExecutionCount} 次</strong>
      </article>
      <article className="operationsSummaryMetric card">
        <span className="operationsSummaryLabel">累计费用</span>
        <strong>¥{totalRevenue.toFixed(2)}</strong>
      </article>
    </section>
  );
}

function TodayPriorityList({
  todayActions,
  todayActionHref,
  todayActionLabel,
}: {
  todayActions: Array<{ type: string; count: number }>;
  todayActionHref: (type: string) => string;
  todayActionLabel: (type: string, count: number) => string;
}): React.ReactElement {
  return (
    <section className="card" style={{ marginBottom: 12 }}>
      <div className="sectionTitle">行动优先信息</div>
      <div className="decisionItemMeta">先清阻断，再推执行。</div>
      <div className="decisionList" style={{ marginTop: 8 }}>
        {todayActions.map((item, idx) => (
          <Link key={`${item.type}_${idx}`} to={todayActionHref(item.type)} className="decisionItemLink">
            <div className="decisionItemTitle">{idx + 1}. {todayActionLabel(item.type, item.count)}</div>
            <div className="decisionItemMeta">立即处理</div>
          </Link>
        ))}
        {!todayActions.length ? <EmptyBlock text="今日暂无高优先动作" /> : null}
      </div>
      <div style={{ marginTop: 8 }}>
        <Link className="btn primary" to="/operations?status=pending">进入作业队列</Link>
      </div>
    </section>
  );
}

function FieldRuntimePanel({
  fieldCount,
  normalFieldCount,
  riskFieldCount,
  deviceSummary,
}: {
  fieldCount: number;
  normalFieldCount: number;
  riskFieldCount: number;
  deviceSummary: { online: number; offline: number; busy: number; low_battery: number };
}): React.ReactElement {
  return (
    <section className="card" style={{ marginBottom: 12 }}>
      <div className="sectionTitle">FieldRuntimePanel</div>
      <div className="operationsSummaryGrid" style={{ marginTop: 10 }}>
        <article className="operationsSummaryMetric">
          <span className="operationsSummaryLabel">地块状态</span>
          <strong>正常 {normalFieldCount} · 风险 {riskFieldCount}</strong>
        </article>
        <article className="operationsSummaryMetric">
          <span className="operationsSummaryLabel">总地块</span>
          <strong>{fieldCount} 个</strong>
        </article>
        <article className="operationsSummaryMetric">
          <span className="operationsSummaryLabel">设备在线/离线</span>
          <strong>{deviceSummary.online} / {deviceSummary.offline}</strong>
        </article>
        <article className="operationsSummaryMetric">
          <span className="operationsSummaryLabel">设备忙碌/低电</span>
          <strong>{deviceSummary.busy} / {deviceSummary.low_battery}</strong>
        </article>
      </div>
      <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
        <Link className="btn primary" to="/fields">查看田块详情</Link>
        <Link className="btn" to="/devices">查看设备详情</Link>
      </div>
    </section>
  );
}

function DecisionOperationQueue({
  topActions,
  runTopAction,
  executingActionId,
  executeFeedback,
  runningActions,
}: {
  topActions: DashboardTopActionItem[];
  runTopAction: (item: DashboardTopActionItem) => Promise<void>;
  executingActionId: string | null;
  executeFeedback: { tone: "success" | "warning" | "neutral"; text: string; operationId?: string } | null;
  runningActions: Array<{ id: string; href?: string; actionLabel: string; statusLabel?: string; finalStatus: string; occurredAtLabel: string }>;
}): React.ReactElement {
  return (
    <section className="card" style={{ marginBottom: 12 }}>
      <div className="sectionTitle">DecisionOperationQueue</div>
      <div className="decisionItemMeta">短链路：决策 → 执行。</div>
      {executeFeedback ? (
        <div className={`muted ${executeFeedback.tone === "success" ? "traceChipLive" : executeFeedback.tone === "warning" ? "traceChipWarn" : ""}`} style={{ marginTop: 8, padding: 8 }}>
          {executeFeedback.text}
          {executeFeedback.operationId ? (
            <span style={{ marginLeft: 8 }}>
              <Link to={`/operations?operation_plan_id=${encodeURIComponent(executeFeedback.operationId)}`}>查看作业详情</Link>
            </span>
          ) : null}
        </div>
      ) : null}
      <div className="decisionList" style={{ marginTop: 8 }}>
        {topActions.map((item) => (
          <div key={item.operation_id} className="decisionItemStatic">
            <div className="decisionItemTitle">{item.action_type} · score {item.global_priority_score ?? item.priority_score}</div>
            <div className="decisionItemMeta">{item.reason}</div>
            <button className="btn" type="button" disabled={!item.execution_ready || executingActionId === item.operation_id} onClick={() => { void runTopAction(item); }}>
              {executingActionId === item.operation_id ? "执行中..." : "一键执行"}
            </button>
            <div style={{ marginTop: 8 }}>
              <Link to={`/operations?operation_plan_id=${encodeURIComponent(item.operation_id)}`}>跳转作业详情</Link>
            </div>
          </div>
        ))}
        {!topActions.length ? <EmptyBlock text="暂无可执行动作" /> : null}
      </div>
      <details style={{ marginTop: 10 }}>
        <summary>历史执行摘要（折叠）</summary>
        <div className="decisionList" style={{ marginTop: 8 }}>
          {runningActions.slice(0, 4).map((a) => (
            <Link key={a.id} to={a.href || "/operations"} className="decisionItemLink">
              <div className="decisionItemTitle">{mapOperationActionLabel(a.actionLabel)}</div>
              <div className="decisionItemMeta">{buildOperationSummary(a.statusLabel || a.finalStatus, a.actionLabel)}</div>
              <div className="muted" style={{ fontSize: 12 }}>更新于 {a.occurredAtLabel}</div>
            </Link>
          ))}
          {!runningActions.length ? <EmptyBlock text="暂无执行历史" /> : null}
        </div>
      </details>
      <div style={{ marginTop: 8 }}>
        <Link className="btn primary" to="/operations">查看全部作业</Link>
      </div>
    </section>
  );
}

function EvidenceResultPanel({
  acceptanceTasks,
  smartRecommendations,
  latestMetrics,
}: {
  acceptanceTasks: any[];
  smartRecommendations: {
    todayCount: number;
    latest: (DashboardRecommendationItem & {
      normalized_metrics?: { soil_moisture: number | null; temperature: number | null; humidity: number | null };
    }) | null;
  };
  latestMetrics: { soil_moisture?: number | null; temperature?: number | null; humidity?: number | null };
}): React.ReactElement {
  return (
    <section className="card" style={{ marginBottom: 12 }}>
      <div className="sectionTitle">EvidenceResultPanel</div>
      <div className="decisionItemMeta">证据先过，再进验收。</div>
      <div className="decisionList" style={{ marginTop: 8 }}>
        {acceptanceTasks.map((e: any, i: number) => {
          const card = e?.card || {};
          return (
            <Link key={e?.id || i} to={e?.href || card?.href || "/delivery/export-jobs"} className="decisionItemLink">
              <div className="decisionItemTitle">{mapFieldDisplayName(e?.fieldName, e?.fieldName)}</div>
              <div className="decisionItemMeta">{card?.constraintCheckLabel || "待验收"} · {card?.waterLabel || "--"}</div>
            </Link>
          );
        })}
        {acceptanceTasks.length === 0 ? <EmptyBlock text="当前没有待验收任务" /> : null}
      </div>
      <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
        <Link className="btn primary" to="/operations?status=done_unaccepted">进入证据验收</Link>
        <Link className="btn" to="/evidence">查看证据详情</Link>
      </div>
      <details style={{ marginTop: 10 }}>
        <summary>诊断信息（折叠）</summary>
        <div className="decisionList" style={{ marginTop: 8 }}>
          <div className="decisionItemStatic">
            <div className="decisionItemTitle">今日自动建议</div>
            <div className="decisionItemMeta">{smartRecommendations.todayCount} 条</div>
          </div>
          <div className="decisionItemStatic">
            <div className="decisionItemTitle">soil_moisture</div>
            <div className="decisionItemMeta">{latestMetrics.soil_moisture == null ? "--" : `${Number(latestMetrics.soil_moisture).toFixed(1)}%`}</div>
          </div>
          <div className="decisionItemStatic">
            <div className="decisionItemTitle">temperature</div>
            <div className="decisionItemMeta">{latestMetrics.temperature == null ? "--" : `${Number(latestMetrics.temperature).toFixed(1)}°C`}</div>
          </div>
          <div className="decisionItemStatic">
            <div className="decisionItemTitle">humidity</div>
            <div className="decisionItemMeta">{latestMetrics.humidity == null ? "--" : `${Number(latestMetrics.humidity).toFixed(1)}%`}</div>
          </div>
        </div>
      </details>
    </section>
  );
}

export default function CommercialDashboardPage({ expert = false }: { expert?: boolean }): React.ReactElement {
  const navigate = useNavigate();
  const api = React.useMemo(
    () => ({
      getOverview,
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
      normalized_metrics?: { soil_moisture: number | null; temperature: number | null; humidity: number | null };
    }) | null;
  }>({ todayCount: 0, latest: null });

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
    void fetchDashboardOverviewV2().then((res) => {
      if (!mounted || !res) return;
      setTopActions(Array.isArray(res.top_actions) ? res.top_actions.slice(0, 3) : []);
      setDeviceSummary(res.device_status_summary ?? { online: 0, offline: 0, busy: 0, low_battery: 0 });
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
        latest: latest ? { ...latest, normalized_metrics: normalizeModelMetrics((latest as any)?.metrics ?? (latest as any)?.model_metrics) } : null,
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
  };
  const todayActions = [...(d.todayActions ?? [])].sort((a, b) => (priorityOrder[a.type] ?? 99) - (priorityOrder[b.type] ?? 99));
  const todayActionLabel = (type: string, count: number): string => {
    if (type === "INVALID_EXECUTION") return `修复无效执行（${count}项）`;
    if (type === "PENDING_ACCEPTANCE") return `完成验收（${count}项）`;
    return `审批建议（${count}项）`;
  };
  const todayActionHref = (type: string): string => {
    if (type === "INVALID_EXECUTION") return "/operations?status=invalid_execution";
    if (type === "PENDING_ACCEPTANCE") return "/operations?status=done_unaccepted";
    return "/agronomy/recommendations";
  };

  const acceptanceTasks = d.evidences
    .filter((e) => e.hasReceipt && e.acceptanceVerdict !== "PASS")
    .slice(0, 4);

  const latestMetrics = (smartRecommendations.latest as any)?.normalized_metrics ?? {};
  const fieldCount = Number(d.overview.fieldCount ?? 0);
  const deviceCount = Number(deviceSummary.online + deviceSummary.offline);
  const hasFirstData = smartRecommendations.latest != null || Number(d.overview.todayExecutionCount ?? 0) > 0;

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

      <OverviewMetrics
        expert={expert}
        sla={sla}
        totalRevenue={totalRevenue}
        fieldCount={fieldCount}
        riskFieldCount={d.overview.riskFieldCount}
        todayExecutionCount={d.overview.todayExecutionCount}
      />

      <TodayPriorityList
        todayActions={todayActions}
        todayActionHref={todayActionHref}
        todayActionLabel={todayActionLabel}
      />

      <EmptyStateGuide
        fieldCount={fieldCount}
        deviceCount={deviceCount}
        hasFirstData={hasFirstData}
      />

      <FieldRuntimePanel
        fieldCount={fieldCount}
        normalFieldCount={d.overview.normalFieldCount}
        riskFieldCount={d.overview.riskFieldCount}
        deviceSummary={deviceSummary}
      />

      <DecisionOperationQueue
        topActions={topActions}
        runTopAction={runTopAction}
        executingActionId={executingActionId}
        executeFeedback={executeFeedback}
        runningActions={runningActions}
      />

      <EvidenceResultPanel
        acceptanceTasks={acceptanceTasks}
        smartRecommendations={smartRecommendations}
        latestMetrics={latestMetrics}
      />
    </div>
  );
}
