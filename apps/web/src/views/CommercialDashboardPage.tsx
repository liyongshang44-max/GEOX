import React from "react";
import { Link } from "react-router-dom";
import {
  fetchDashboardAcceptanceRisks,
  fetchDashboardPendingActions,
  fetchDashboardRecentExecutions,
  getOverview,
  getRecentEvidence,
} from "../api/dashboard";
import { useDashboard } from "../hooks/useDashboard";
import { buildOperationSummary, mapFieldDisplayName, mapOperationActionLabel, mapOperationStatusLabel } from "../lib/operationLabels";

function MetricCard({ title, value, desc }: { title: string; value: number; desc: string }): React.ReactElement {
  return (
    <article className="card demoMetricCard">
      <div className="demoMetricLabel">{title}</div>
      <div className="demoMetricValue">{value}</div>
      <div className="demoMetricHint">{desc}</div>
    </article>
  );
}

function EmptyBlock({ text }: { text: string }): React.ReactElement {
  return <div className="card muted" style={{ padding: 16 }}>{text}</div>;
}

export default function CommercialDashboardPage(): React.ReactElement {
  const api = React.useMemo(
    () => ({
      getOverview,
      getRecentExecutions: async (params?: { limit?: number }) => fetchDashboardRecentExecutions(params?.limit ?? 8),
      getRecentEvidence,
      getAcceptanceRisks: async (params?: { limit?: number }) => fetchDashboardAcceptanceRisks(params?.limit ?? 6),
      getPendingActions: async (params?: { limit?: number }) => fetchDashboardPendingActions(params?.limit ?? 6),
    }),
    [],
  );
  const d = useDashboard(api);

  const failedActions = d.actions.filter((x) => x.finalStatus === "failed");
  const pendingActions = d.actions.filter((x) => x.finalStatus === "pending" || x.finalStatus === "running");
  const stableEvidences = d.evidences.slice(0, 3);

  return (
    <div className="productPage demoDashboardPage">
      <section className="card hero compactHero demoHero dashboardHeroV2">
        <div>
          <div className="eyebrow">GEOX / 经营监控台</div>
          <h1 className="demoHeroTitle">今天该处理什么</h1>
          <p className="demoHeroSubTitle">先看必须处理的风险，再看执行中的作业，最后查看已完成证据。</p>
        </div>
        <div className="heroActions">
          <Link className="btn" to="/operations">查看作业</Link>
          <Link className="btn ghost" to="/fields">查看田块</Link>
          <Link className="btn ghost" to="/audit-export">查看证据</Link>
        </div>
      </section>

      <section className="summaryGrid4 demoSummaryGrid">
        <MetricCard title="在线设备" value={d.overview.onlineDeviceCount} desc="当前可联动的现场设备" />
        <MetricCard title="进行中作业" value={d.overview.inProgressCount} desc="需要持续跟踪的执行链" />
        <MetricCard title="今日完成" value={d.overview.completedTodayCount} desc="已形成回执或终态的任务" />
        <MetricCard title="待处理事项" value={d.overview.pendingCount} desc="建议优先进入处理队列" />
      </section>

      <section className="dashboardDecisionBoard">
        <article className="card decisionColumn danger">
          <div className="decisionHeader">
            <div>
              <div className="sectionTitle">必须处理</div>
              <div className="sectionDesc">失败作业、阻塞事项和高优先级风险。</div>
            </div>
            <div className="decisionCount">{failedActions.length + d.risks.length}</div>
          </div>
          <div className="decisionList">
            {failedActions.slice(0, 3).map((a) => (
              <Link key={a.id} to={a.href || "/operations"} className="decisionItemLink">
                <div className="decisionItemTitle">{mapOperationActionLabel(a.actionLabel)}</div>
                <div className="decisionItemMeta">{mapFieldDisplayName(a.subjectName, a.subjectName)} · {mapOperationStatusLabel(a.statusLabel || a.finalStatus)}</div>
              </Link>
            ))}
            {d.risks.slice(0, 3).map((risk, idx) => (
              <div key={`risk_${idx}`} className="decisionItemStatic">
                <div className="decisionItemTitle">风险提示</div>
                <div className="decisionItemMeta">{risk}</div>
              </div>
            ))}
            {failedActions.length + d.risks.length === 0 ? <EmptyBlock text="当前没有必须立即处理的问题" /> : null}
          </div>
        </article>

        <article className="card decisionColumn warning">
          <div className="decisionHeader">
            <div>
              <div className="sectionTitle">建议处理</div>
              <div className="sectionDesc">进行中作业和待回传证据，适合先排队推进。</div>
            </div>
            <div className="decisionCount">{pendingActions.length}</div>
          </div>
          <div className="decisionList">
            {pendingActions.slice(0, 4).map((a) => (
              <Link key={a.id} to={a.href || "/operations"} className="decisionItemLink">
                <div className="decisionItemTitle">{mapOperationActionLabel(a.actionLabel)}</div>
                <div className="decisionItemMeta">{buildOperationSummary(a.statusLabel || a.finalStatus, a.actionLabel)}</div>
                <div className="muted" style={{ fontSize: 12 }}>更新于 {a.occurredAtLabel}</div>
              </Link>
            ))}
            {pendingActions.length === 0 ? <EmptyBlock text="当前没有建议优先推进的作业" /> : null}
          </div>
        </article>

        <article className="card decisionColumn success">
          <div className="decisionHeader">
            <div>
              <div className="sectionTitle">正常运行</div>
              <div className="sectionDesc">已完成作业和最近证据，可用于复盘与对外交付。</div>
            </div>
            <div className="decisionCount">{stableEvidences.length}</div>
          </div>
          <div className="decisionList">
            {stableEvidences.map((e: any, i: number) => {
              const card = e?.card || {};
              return (
                <Link key={e?.id || i} to={e?.href || card?.href || "/audit-export"} className="decisionItemLink">
                  <div className="decisionItemTitle">{mapFieldDisplayName(e?.fieldName, e?.fieldName)}</div>
                  <div className="decisionItemMeta">{card?.constraintCheckLabel || "已回传"} · {card?.waterLabel || "--"}</div>
                </Link>
              );
            })}
            {stableEvidences.length === 0 ? <EmptyBlock text="当前还没有可复盘证据" /> : null}
          </div>
        </article>
      </section>
    </div>
  );
}
