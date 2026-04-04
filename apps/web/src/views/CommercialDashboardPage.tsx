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

export default function CommercialDashboardPage(): React.ReactElement {
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
  const [trendSummary, setTrendSummary] = React.useState<{ risk: string; effect: string }>({ risk: "NO_DATA", effect: "NO_DATA" });
  const [opsHealth, setOpsHealth] = React.useState<{
    failure_distribution: Record<string, number>;
    retry_distribution: Array<{ attempt_no: number; count: number }>;
    trace_gap_count: { missing_receipt: number; missing_evidence: number };
  }>({ failure_distribution: {}, retry_distribution: [], trace_gap_count: { missing_receipt: 0, missing_evidence: 0 } });
  const [deviceSummary, setDeviceSummary] = React.useState({ online: 0, offline: 0, busy: 0, low_battery: 0 });
  const [opsDefinition, setOpsDefinition] = React.useState({
    failure_definition: "--",
    retry_definition: "--",
    trace_gap_definition: "--",
    time_window: "7d",
  });
  const [executingActionId, setExecutingActionId] = React.useState<string | null>(null);

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
      setTrendSummary({
        risk: String(res.risk_trend ?? "NO_DATA"),
        effect: String(res.effect_trend ?? "NO_DATA"),
      });
      setOpsHealth({
        failure_distribution: res.ops_health?.failure_distribution ?? {},
        retry_distribution: Array.isArray(res.ops_health?.retry_distribution) ? res.ops_health?.retry_distribution : [],
        trace_gap_count: res.ops_health?.trace_gap_count ?? { missing_receipt: 0, missing_evidence: 0 },
      });
      setDeviceSummary(res.device_status_summary ?? { online: 0, offline: 0, busy: 0, low_battery: 0 });
      setOpsDefinition(res.ops_definition ?? {
        failure_definition: "--",
        retry_definition: "--",
        trace_gap_definition: "--",
        time_window: "7d",
      });
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
  const invalidExecutionTasks = d.actions.filter((x) => x.finalStatus === "invalid");
  const pendingApprovals = d.risks.filter((item) => item.startsWith("APPROVAL|")).map((item) => item.replace("APPROVAL|", ""));
  const riskAlerts = d.riskItems;
  const acceptanceTasks = d.evidences
    .filter((e) => e.hasReceipt && e.acceptanceVerdict !== "PASS")
    .slice(0, 4);

  const overviewPendingAcceptanceCount = Math.max(d.overview.pendingAcceptanceCount, acceptanceTasks.length);
  const riskLevelCount = riskAlerts.reduce(
    (acc, item) => {
      if (item.level === "HIGH") acc.high += 1;
      else if (item.level === "LOW") acc.low += 1;
      else acc.medium += 1;
      return acc;
    },
    { high: 0, medium: 0, low: 0 },
  );
  const riskSourceCount = riskAlerts.reduce(
    (acc, item) => {
      acc[item.source] += 1;
      return acc;
    },
    { 干旱: 0, 病害: 0, 执行缺失: 0 },
  );
  const impactFieldCount = new Set(riskAlerts.map((item) => item.fieldId).filter(Boolean)).size || riskAlerts.length;

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
  const indicatorChangeLabel = `高置信建议 ${d.decisions.pendingRecommendationCount} 条 · 今日执行 ${d.overview.todayExecutionCount} 次`;
  const riskChangeLabel = `高风险 ${riskLevelCount.high} 项 · 执行缺失 ${riskSourceCount.执行缺失} 项`;
  const agronomyValue = d.agronomyValue;
  const weeklyRecommendationCount = agronomyValue.weeklyRecommendationCount;
  const recommendationSuccessCount = agronomyValue.verdictCounts.SUCCESS;
  const recommendationDeviationCount = agronomyValue.verdictCounts.PARTIAL;
  const recommendationFailedCount = agronomyValue.verdictCounts.FAILED;
  const recommendationNoDataCount = agronomyValue.verdictCounts.NO_DATA;
  const recommendationSuccessRateLabel = `${Math.round(agronomyValue.successRate * 100)}%`;

  const latestMetrics = (smartRecommendations.latest as any)?.normalized_metrics ?? {};
  const soilMoisture = latestMetrics?.soil_moisture;
  const temperature = latestMetrics?.temperature;
  const humidity = latestMetrics?.humidity;
  const jumpTargets = {
    decisions: "/operations?status=pending",
    execution: "/operations?status=running",
    acceptance: "/operations?status=done_unaccepted",
  } as const;
  const toMinuteLabel = (ms: number): string => {
    const mins = Math.round(Math.max(0, ms) / 60000);
    return `${mins}分钟`;
  };

  const onCardClick = (to: string) => (evt: React.MouseEvent<HTMLElement>) => {
    const target = evt.target as HTMLElement | null;
    if (target?.closest("a")) return;
    navigate(to);
  };
  const runTopAction = async (item: DashboardTopActionItem): Promise<void> => {
    if (!item.execution_ready || !item.execution_plan) return;
    setExecutingActionId(item.operation_id);
    try {
      await executeOperationAction({
        tenant_id: String(item.tenant_id ?? ""),
        project_id: String(item.project_id ?? ""),
        group_id: String(item.group_id ?? ""),
        operation_id: item.operation_id,
        execution_plan: item.execution_plan,
      });
      void fetchDashboardOverviewV2().then((res) => {
        if (!res) return;
        setTopActions(Array.isArray(res.top_actions) ? res.top_actions.slice(0, 3) : []);
      });
    } finally {
      setExecutingActionId(null);
    }
  };

  return (
    <div className="productPage demoDashboardPage">
      {error ? <EmptyBlock text="数据加载失败（overview）" /> : null}
      <section className="operationsSummaryGrid" style={{ marginBottom: 12 }}>
        <article className="operationsSummaryMetric card">
          <span className="operationsSummaryLabel">成功率</span>
          <strong>{Math.round((sla.success_rate || 0) * 100)}%</strong>
        </article>
        <article className="operationsSummaryMetric card">
          <span className="operationsSummaryLabel">执行无效率</span>
          <strong>{Math.round((sla.invalid_execution_rate || 0) * 100)}%</strong>
        </article>
        <article className="operationsSummaryMetric card">
          <span className="operationsSummaryLabel">累计作业费用</span>
          <strong>¥{totalRevenue.toFixed(2)}</strong>
        </article>
      </section>
      <section className="card" style={{ marginBottom: 12 }}>
        <div className="sectionTitle">客户四问（经营视角）</div>
        <div className="operationsSummaryGrid" style={{ marginTop: 10 }}>
          <article className="operationsSummaryMetric">
            <span className="operationsSummaryLabel">哪块地有风险</span>
            <strong>{riskAlerts.length > 0 ? `${riskAlerts[0].fieldId || riskAlerts[0].title}（共${riskAlerts.length}项）` : "当前无高优先风险地块"}</strong>
          </article>
          <article className="operationsSummaryMetric">
            <span className="operationsSummaryLabel">哪些操作带来收益</span>
            <strong>{agronomyValue.verdictCounts.SUCCESS > 0 ? `SUCCESS 操作 ${agronomyValue.verdictCounts.SUCCESS} 项` : "暂无可确认收益操作"}</strong>
          </article>
          <article className="operationsSummaryMetric">
            <span className="operationsSummaryLabel">哪些执行失败</span>
            <strong>{Math.max(invalidExecutionTasks.length, d.execution.invalidExecutionCount)} 项无效/失败执行</strong>
          </article>
          <article className="operationsSummaryMetric">
            <span className="operationsSummaryLabel">SLA 总览</span>
            <strong>执行成功率 {Math.round((sla.success_rate || 0) * 100)}% · 验收时长 {toMinuteLabel(sla.avg_acceptance_time_ms || 0)}</strong>
          </article>
          <article className="operationsSummaryMetric">
            <span className="operationsSummaryLabel">待决策（审批）</span>
            <strong>{d.decisions.pendingApprovalCount} 项待审批</strong>
          </article>
        </div>
      </section>
      <section className="card" style={{ marginBottom: 12 }}>
        <div className="sectionTitle">Top 3 优先动作（后端排序）</div>
        <div className="decisionList" style={{ marginTop: 10 }}>
          {topActions.map((item) => (
            <div key={item.operation_id} className="decisionItemStatic">
              <div className="decisionItemTitle">{item.priority_bucket} · {item.action_type} · score {item.global_priority_score ?? item.priority_score}</div>
              <div className="decisionItemMeta">{item.reason}</div>
              <div className="muted" style={{ marginTop: 4 }}>{item.recommended_next_action.source} / {item.recommended_next_action.action_type}</div>
              <div className="muted" style={{ marginTop: 4 }}>
                {item.execution_ready ? "可执行" : `阻断：${(item.execution_blockers ?? []).join(",") || "未知"}`}
              </div>
              <div className="muted" style={{ marginTop: 4 }}>
                trace: {item.execution_trace?.status ?? "PENDING"} · retry {item.execution_plan?.failure_strategy?.max_retries ?? 0}
              </div>
              <button className="btn" type="button" disabled={!item.execution_ready || executingActionId === item.operation_id} onClick={() => { void runTopAction(item); }}>
                {executingActionId === item.operation_id ? "执行中..." : "一键执行"}
              </button>
            </div>
          ))}
          {!topActions.length ? <EmptyBlock text="暂无可执行动作，默认建议：CHECK_FIELD_STATUS" /> : null}
          <div className="decisionItemStatic">
            <div className="decisionItemTitle">趋势摘要</div>
            <div className="decisionItemMeta">风险趋势 {trendSummary.risk} · 效果趋势 {trendSummary.effect}</div>
          </div>
        </div>
      </section>
      <section className="card" style={{ marginBottom: 12 }}>
        <div className="sectionTitle">运维健康面板（后端口径）</div>
        <div className="operationsSummaryGrid" style={{ marginTop: 10 }}>
          <article className="operationsSummaryMetric">
            <span className="operationsSummaryLabel">设备在线/离线</span>
            <strong>{deviceSummary.online} / {deviceSummary.offline}</strong>
          </article>
          <article className="operationsSummaryMetric">
            <span className="operationsSummaryLabel">设备忙碌/低电量</span>
            <strong>{deviceSummary.busy} / {deviceSummary.low_battery}</strong>
          </article>
          <article className="operationsSummaryMetric">
            <span className="operationsSummaryLabel">Trace 缺口（回执）</span>
            <strong>{opsHealth.trace_gap_count.missing_receipt}</strong>
          </article>
          <article className="operationsSummaryMetric">
            <span className="operationsSummaryLabel">Trace 缺口（证据）</span>
            <strong>{opsHealth.trace_gap_count.missing_evidence}</strong>
          </article>
        </div>
        <div className="operationsSummaryGrid" style={{ marginTop: 10 }}>
          <article className="operationsSummaryMetric">
            <span className="operationsSummaryLabel">Top失败原因</span>
            <strong>
              {Object.entries(opsHealth.failure_distribution)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 3)
                .map(([k, v]) => `${k}:${v}`)
                .join(" | ") || "--"}
            </strong>
          </article>
          <article className="operationsSummaryMetric">
            <span className="operationsSummaryLabel">Retry分布</span>
            <strong>
              {opsHealth.retry_distribution.map((x) => `#${x.attempt_no}:${x.count}`).join(" | ") || "--"}
            </strong>
          </article>
          <article className="operationsSummaryMetric">
            <span className="operationsSummaryLabel">口径窗口</span>
            <strong>{opsDefinition.time_window}</strong>
          </article>
        </div>
      </section>
      <section className="card" style={{ marginBottom: 12 }}>
        <div className="sectionTitle">农学效果总览</div>
        <div className="operationsSummaryGrid" style={{ marginTop: 10 }}>
          <article className="operationsSummaryMetric"><span className="operationsSummaryLabel">本周建议数</span><strong>{weeklyRecommendationCount}</strong></article>
          <article className="operationsSummaryMetric"><span className="operationsSummaryLabel">SUCCESS</span><strong>{recommendationSuccessCount}</strong></article>
          <article className="operationsSummaryMetric"><span className="operationsSummaryLabel">PARTIAL</span><strong>{recommendationDeviationCount}</strong></article>
          <article className="operationsSummaryMetric"><span className="operationsSummaryLabel">FAILED</span><strong>{recommendationFailedCount}</strong></article>
          <article className="operationsSummaryMetric"><span className="operationsSummaryLabel">NO_DATA</span><strong>{recommendationNoDataCount}</strong></article>
          <article className="operationsSummaryMetric"><span className="operationsSummaryLabel">成功率（success / total）</span><strong>{recommendationSuccessRateLabel}</strong></article>
        </div>
      </section>

      <section className="dashboardDecisionBoard">
        <article className="card decisionColumn success">
          <div className="decisionHeader">
            <div>
              <div className="sectionTitle">① 地块状态</div>
              <div className="sectionDesc">先判断今天地块整体是否“正常 / 风险 / 需关注”。</div>
            </div>
            <div className="decisionCount">{d.overview.fieldCount}</div>
          </div>
          <div className="decisionList">
            <div className="decisionItemStatic">
              <div className="decisionItemTitle">正常地块</div>
              <div className="decisionItemMeta">{d.overview.normalFieldCount} 个</div>
            </div>
            <div className="decisionItemStatic">
              <div className="decisionItemTitle">风险地块</div>
              <div className="decisionItemMeta">{d.overview.riskFieldCount} 个</div>
            </div>
            <div className="decisionItemStatic">
              <div className="decisionItemTitle">需关注</div>
              <div className="decisionItemMeta">{Math.max(0, d.overview.fieldCount - d.overview.normalFieldCount - d.overview.riskFieldCount)} 个</div>
            </div>
            <div className="decisionItemStatic">
              <div className="decisionItemTitle">地块总数</div>
              <div className="decisionItemMeta">{d.overview.fieldCount} 个地块</div>
            </div>
          </div>
        </article>

        <article className="card decisionColumn danger">
          <div className="decisionHeader">
            <div>
              <div className="sectionTitle">② 风险告警</div>
              <div className="sectionDesc">按严重程度展示，优先处理高风险。</div>
            </div>
            <div className="decisionCount">{riskAlerts.length}</div>
          </div>
          <div className="decisionList">
            <div className="decisionItemStatic">
              <div className="decisionItemTitle">风险等级（高 / 中 / 低）</div>
              <div className="decisionItemMeta">{riskLevelCount.high} / {riskLevelCount.medium} / {riskLevelCount.low}</div>
            </div>
            <div className="decisionItemStatic">
              <div className="decisionItemTitle">风险来源（干旱 / 病害 / 执行缺失）</div>
              <div className="decisionItemMeta">{riskSourceCount.干旱} / {riskSourceCount.病害} / {riskSourceCount.执行缺失}</div>
            </div>
            <div className="decisionItemStatic">
              <div className="decisionItemTitle">影响范围</div>
              <div className="decisionItemMeta">影响 {impactFieldCount} 个地块</div>
            </div>
            {riskAlerts.slice(0, 2).map((risk) => (
              <div key={risk.id} className="decisionItemStatic">
                <div className="decisionItemTitle">{risk.title}</div>
                <div className="decisionItemMeta">{risk.source} · {risk.level}</div>
              </div>
            ))}
            {riskAlerts.length === 0 ? <EmptyBlock text="当前没有高优先级风险告警" /> : null}
          </div>
        </article>

        <article className="card decisionColumn warning" role="button" tabIndex={0} onClick={onCardClick(jumpTargets.decisions)} onKeyDown={(evt) => { if (evt.key === "Enter" || evt.key === " ") navigate(jumpTargets.decisions); }}>
          <div className="decisionHeader">
            <div>
              <div className="sectionTitle">③ 待审批建议</div>
              <div className="sectionDesc">明确有哪些建议等待决策。</div>
            </div>
            <Link to={jumpTargets.decisions} className="decisionCount">{d.decisions.pendingRecommendationCount + d.decisions.pendingApprovalCount}</Link>
          </div>
          <div className="decisionList">
            <div className="decisionItemStatic">
              <div className="decisionItemTitle">待审批建议</div>
              <div className="decisionItemMeta">建议 {d.decisions.pendingRecommendationCount} 条 · 审批 {d.decisions.pendingApprovalCount} 条</div>
            </div>
            <div className="decisionItemStatic">
              <div className="decisionItemTitle">指标变化</div>
              <div className="decisionItemMeta">{indicatorChangeLabel}</div>
            </div>
            <div className="decisionItemStatic">
              <div className="decisionItemTitle">风险变化</div>
              <div className="decisionItemMeta">{riskChangeLabel}</div>
            </div>
            {pendingApprovals.slice(0, 4).map((item, idx) => (
              <Link key={`approval_${idx}`} to="/agronomy/recommendations" className="decisionItemLink">
                <div className="decisionItemTitle">建议待审批</div>
                <div className="decisionItemMeta">{item}</div>
              </Link>
            ))}
            {pendingApprovals.length === 0 && d.decisions.pendingRecommendationCount === 0 ? <EmptyBlock text="当前没有待审批建议" /> : null}
          </div>
        </article>

        <article className="card decisionColumn warning" role="button" tabIndex={0} onClick={onCardClick(jumpTargets.execution)} onKeyDown={(evt) => { if (evt.key === "Enter" || evt.key === " ") navigate(jumpTargets.execution); }}>
          <div className="decisionHeader">
            <div>
              <div className="sectionTitle">④ 执行中任务</div>
              <div className="sectionDesc">现在正在跑的作业，谁在执行、卡在哪。</div>
            </div>
            <Link to={jumpTargets.execution} className="decisionCount">{d.execution.runningTaskCount}</Link>
          </div>
          <div className="decisionList">
            <div className="decisionItemStatic">
              <div className="decisionItemTitle">执行中任务数</div>
              <div className="decisionItemMeta">{d.execution.runningTaskCount} 项</div>
            </div>
            <div className="decisionItemStatic">
              <div className="decisionItemTitle">人工执行 vs 设备执行</div>
              <div className="decisionItemMeta">{d.execution.humanExecutionCount} / {d.execution.deviceExecutionCount}</div>
            </div>
            <div className="decisionItemStatic">
              <div className="decisionItemTitle">延迟任务</div>
              <div className="decisionItemMeta">{d.execution.delayedTaskCount} 项</div>
            </div>
            {runningActions.slice(0, 4).map((a) => (
              <Link key={a.id} to={a.href || "/operations"} className="decisionItemLink">
                <div className="decisionItemTitle">{mapOperationActionLabel(a.actionLabel)}</div>
                <div className="decisionItemMeta">{buildOperationSummary(a.statusLabel || a.finalStatus, a.actionLabel)}</div>
                <div className="muted" style={{ fontSize: 12 }}>更新于 {a.occurredAtLabel}</div>
              </Link>
            ))}
            {runningActions.length === 0 ? <EmptyBlock text="当前没有执行中的任务" /> : null}
          </div>
        </article>

        <article className="card decisionColumn warning" role="button" tabIndex={0} onClick={onCardClick(jumpTargets.acceptance)} onKeyDown={(evt) => { if (evt.key === "Enter" || evt.key === " ") navigate(jumpTargets.acceptance); }}>
          <div className="decisionHeader">
            <div>
              <div className="sectionTitle">⑤ 待验收任务</div>
              <div className="sectionDesc">核心商业点：receipt 存在且 acceptance != PASS。</div>
            </div>
            <Link to={jumpTargets.acceptance} className="decisionCount">{overviewPendingAcceptanceCount}</Link>
          </div>
          <div className="decisionList">
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
        </article>

        <article className="card decisionColumn danger">
          <div className="decisionHeader">
            <div>
              <div className="sectionTitle">⑥ 无效执行任务</div>
              <div className="sectionDesc">已执行但证据无效，禁止进入验收。</div>
            </div>
            <div className="decisionCount">{Math.max(d.execution.invalidExecutionCount, invalidExecutionTasks.length)}</div>
          </div>
          <div className="decisionList">
            {invalidExecutionTasks.slice(0, 4).map((item) => (
              <Link key={item.id} to={item.href || "/operations"} className="decisionItemLink">
                <div className="decisionItemTitle">{mapOperationActionLabel(item.actionLabel)}</div>
                <div className="decisionItemMeta">⚠️ 执行无效：未提供证据，无法完成验收</div>
              </Link>
            ))}
            {invalidExecutionTasks.length === 0 ? <EmptyBlock text="当前没有无效执行任务" /> : null}
          </div>
        </article>

        <article className="card decisionColumn">
          <div className="decisionHeader">
            <div>
              <div className="sectionTitle">⑦ 今日关键动作</div>
              <div className="sectionDesc">按任务清单推进，不再只给提示。</div>
            </div>
            <div className="decisionCount">{todayActions.length}</div>
          </div>
          <div className="decisionList">
            <div className="decisionItemStatic">
              <div className="decisionItemTitle">今日必须处理：</div>
            </div>
            {todayActions.map((item, idx) => (
              <Link key={`${item.type}_${idx}`} to={todayActionHref(item.type)} className="decisionItemLink">
                <div className="decisionItemTitle">{idx + 1}. {todayActionLabel(item.type, item.count)}</div>
              </Link>
            ))}
            {!todayActions.length ? <EmptyBlock text="当前没有需要立即处理的动作" /> : null}
          </div>
        </article>
      </section>

      <section className="card" style={{ marginTop: 16 }}>
        <div className="sectionTitle">最近作业效果</div>
        <div className="decisionList" style={{ marginTop: 12 }}>
          <div className="decisionItemStatic">
            <div className="decisionItemTitle">✔ 有效作业</div>
            <div className="decisionItemMeta">{d.operationEffect.validCount}</div>
          </div>
          <div className="decisionItemStatic">
            <div className="decisionItemTitle">⚠️ 偏差作业</div>
            <div className="decisionItemMeta">{d.operationEffect.deviationCount}</div>
          </div>
          <div className="decisionItemStatic">
            <div className="decisionItemTitle">❌ 无效执行</div>
            <div className="decisionItemMeta">{d.operationEffect.invalidCount}</div>
          </div>
        </div>
      </section>

      <section className="card" style={{ marginTop: 16 }}>
        <div className="sectionTitle">指标单位标准化</div>
        <div className="decisionList" style={{ marginTop: 12 }}>
          <div className="decisionItemStatic">
            <div className="decisionItemTitle">soil_moisture</div>
            <div className="decisionItemMeta">{d.metricUnits.soil_moisture}</div>
          </div>
          <div className="decisionItemStatic">
            <div className="decisionItemTitle">temperature</div>
            <div className="decisionItemMeta">{d.metricUnits.temperature}</div>
          </div>
          <div className="decisionItemStatic">
            <div className="decisionItemTitle">humidity</div>
            <div className="decisionItemMeta">{d.metricUnits.humidity}</div>
          </div>
        </div>
      </section>

      <section className="card" style={{ marginTop: 16 }}>
        <div className="sectionTitle">智能建议</div>
        <div className="decisionList" style={{ marginTop: 12 }}>
          <div className="decisionItemStatic">
            <div className="decisionItemTitle">今日自动生成</div>
            <div className="decisionItemMeta">{smartRecommendations.todayCount} 条</div>
          </div>
          <div className="decisionItemStatic">
            <div className="decisionItemTitle">最近一条</div>
            <div className="decisionItemMeta">
              {smartRecommendations.latest
                ? `${smartRecommendations.latest.title || "建议灌溉"} / 地块 ${smartRecommendations.latest.field?.field_id || "-"}`
                : "暂无自动建议"}
            </div>
          </div>
          <div className="decisionItemStatic">
            <div className="decisionItemTitle">soil_moisture（%）</div>
            <div className="decisionItemMeta">{soilMoisture == null ? "--" : `${Number(soilMoisture).toFixed(1)}%`}</div>
          </div>
          <div className="decisionItemStatic">
            <div className="decisionItemTitle">temperature（°C）</div>
            <div className="decisionItemMeta">{temperature == null ? "--" : `${Number(temperature).toFixed(1)}°C`}</div>
          </div>
          <div className="decisionItemStatic">
            <div className="decisionItemTitle">humidity（%）</div>
            <div className="decisionItemMeta">{humidity == null ? "--" : `${Number(humidity).toFixed(1)}%`}</div>
          </div>
        </div>
      </section>

      <section className="card" style={{ marginTop: 16 }}>
        <div className="sectionTitle">农学建议</div>
        <div className="decisionList" style={{ marginTop: 12 }}>
          {d.agronomyRecommendations.map((item, idx) => (
            <div key={`${item.fieldLabel}_${item.actionLabel}_${idx}`} className="decisionItemStatic">
              <div className="decisionItemTitle">{item.fieldLabel}</div>
              <div className="decisionItemMeta">
                {item.cropLabel} / {item.cropStageLabel} · {item.actionLabel} · 优先级 {item.priorityLabel}
              </div>
              <div className="muted" style={{ marginTop: 4 }}>{item.summary}</div>
            </div>
          ))}
          {d.agronomyRecommendations.length === 0 ? <EmptyBlock text="暂无最近农学建议" /> : null}
        </div>
      </section>

      <section className="card" style={{ marginTop: 16 }}>
        <div className="sectionTitle">当前阶段分布</div>
        <div className="decisionList" style={{ marginTop: 12 }}>
          {d.cropStageDistribution.map((item, idx) => (
            <div key={`${item.cropLabel}_${item.cropStageLabel}_${idx}`} className="decisionItemStatic">
              <div className="decisionItemTitle">{item.cropLabel}｜{item.cropStageLabel}</div>
              <div className="decisionItemMeta">{item.fieldCount}块地</div>
            </div>
          ))}
          {d.cropStageDistribution.length === 0 ? <EmptyBlock text="暂无阶段分布数据" /> : null}
        </div>
      </section>

      <section className="card" style={{ marginTop: 16 }}>
        <div className="sectionTitle">效果反馈摘要</div>
        <div className="decisionList" style={{ marginTop: 12 }}>
          <div className="decisionItemStatic">
            <div className="decisionItemTitle">有效建议</div>
            <div className="decisionItemMeta">{d.effectSummary.effectiveCount}</div>
          </div>
          <div className="decisionItemStatic">
            <div className="decisionItemTitle">部分有效</div>
            <div className="decisionItemMeta">{d.effectSummary.partialCount}</div>
          </div>
          <div className="decisionItemStatic">
            <div className="decisionItemTitle">无效建议</div>
            <div className="decisionItemMeta">{d.effectSummary.ineffectiveCount}</div>
          </div>
          <div className="decisionItemStatic">
            <div className="decisionItemTitle">无数据</div>
            <div className="decisionItemMeta">{d.effectSummary.noDataCount}</div>
          </div>
        </div>
      </section>

      <section className="card" style={{ marginTop: 16 }}>
        <div className="sectionTitle">Top规则</div>
        <div className="decisionList" style={{ marginTop: 12 }}>
          {agronomyValue.topRules.length
            ? agronomyValue.topRules.map((item) => (
              <div key={`top_rule_${item.ruleId}`} className="decisionItemStatic">
                <div className="decisionItemTitle">{item.ruleId}</div>
                <div className="decisionItemMeta">success_rate {Math.round(item.successRate * 100)}% · 触发 {item.triggerCount} 次</div>
              </div>
            ))
            : <EmptyBlock text="暂无规则表现数据" />}
        </div>
      </section>

      <section className="card" style={{ marginTop: 16 }}>
        <div className="sectionTitle">风险提示</div>
        <div className="decisionList" style={{ marginTop: 12 }}>
          {agronomyValue.riskRules.length
            ? agronomyValue.riskRules.map((item) => (
              <div key={`risk_rule_${item.ruleId}`} className="decisionItemStatic">
                <div className="decisionItemTitle">⚠️ {item.ruleId}</div>
                <div className="decisionItemMeta">高频触发 {item.triggerCount} 次，但 success_rate 仅 {Math.round(item.successRate * 100)}%</div>
              </div>
            ))
            : <EmptyBlock text="暂无高频低成功率规则" />}
        </div>
      </section>

      <section className="card" style={{ marginTop: 16 }}>
        <div className="sectionTitle">本周服务质量</div>
        <div className="decisionList" style={{ marginTop: 12 }}>
          <div className="decisionItemStatic">
            <div className="decisionItemTitle">作业成功率</div>
            <div className="decisionItemMeta">{Math.round((sla.success_rate || 0) * 100)}%</div>
          </div>
          <div className="decisionItemStatic">
            <div className="decisionItemTitle">无效执行率</div>
            <div className="decisionItemMeta">{Math.round((sla.invalid_execution_rate || 0) * 100)}%</div>
          </div>
          <div className="decisionItemStatic">
            <div className="decisionItemTitle">平均执行时长</div>
            <div className="decisionItemMeta">{toMinuteLabel(sla.avg_execution_time_ms)}</div>
          </div>
          <div className="decisionItemStatic">
            <div className="decisionItemTitle">平均验收时长</div>
            <div className="decisionItemMeta">{toMinuteLabel(sla.avg_acceptance_time_ms)}</div>
          </div>
        </div>
      </section>
    </div>
  );
}
