import React from "react";
import { Link } from "react-router-dom";
import { fetchDashboardRecentExecutions, getOverview, getRecentEvidence } from "../api/dashboard";
import { useDashboard } from "../hooks/useDashboard";
import { buildOperationSummary, mapDeviceDisplayName, mapFieldDisplayName, mapOperationActionLabel, mapOperationStatusLabel } from "../lib/operationLabels";

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
    }),
    [],
  );
  const d = useDashboard(api);
  const priorityCount = d.overview.pendingCount + d.overview.inProgressCount;

  return (
    <div className="productPage demoDashboardPage">
      <section className="card hero compactHero demoHero dashboardHeroV2">
        <div>
          <div className="eyebrow">GEOX / 经营监控台</div>
          <h1 className="demoHeroTitle">今天该处理什么</h1>
          <p className="demoHeroSubTitle">先看风险，再看执行，再看证据，让远程经营更像一个每日可操作的控制台。</p>
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

      <section className="dashboardDecisionGrid">
        <article className="card sectionBlock">
          <div className="sectionTitle">今日最重要</div>
          <div className="sectionDesc">把高优先级问题集中到第一屏，不再把工程字段暴露给用户。</div>
          <div className="priorityStrip">
            <div className="priorityMainValue">{priorityCount}</div>
            <div>
              <div className="priorityMainTitle">需要优先推进的事项</div>
              <div className="muted">优先检查待处理告警、长时间未推进作业与待回传证据。</div>
            </div>
          </div>
        </article>

        <article className="card sectionBlock">
          <div className="sectionTitle">现场状态</div>
          <div className="sectionDesc">先判断设备与执行面是否健康，再决定是否需要进入详情页。</div>
          <div className="fieldStatusGrid">
            <div className="fieldStatusItem"><span>在线设备</span><strong>{d.overview.onlineDeviceCount}</strong></div>
            <div className="fieldStatusItem"><span>进行中作业</span><strong>{d.overview.inProgressCount}</strong></div>
            <div className="fieldStatusItem"><span>待处理告警</span><strong>{d.overview.pendingCount}</strong></div>
          </div>
        </article>
      </section>

      <section className="contentGridTwo alignStart demoContentGrid">
        <article className="card sectionBlock">
          <div className="sectionHeader demoSectionHeader">
            <div>
              <div className="sectionTitle">待处理作业</div>
              <div className="sectionDesc">保留动作、对象、状态与结果摘要，不在主界面展示工程编号。</div>
            </div>
          </div>
          <div className="list modernList compactList demoList">
            {d.actions.length === 0 ? (
              <EmptyBlock text="当前没有待处理作业" />
            ) : (
              d.actions.slice(0, 4).map((a) => (
                <Link key={a.id} to={a.href || "/operations"} className="infoCard demoInfoCard dashboardActionCard">
                  <div className="demoCardTopRow">
                    <div className="title">{mapOperationActionLabel(a.actionLabel)}</div>
                    <span className="statusTag tone-neutral">{mapOperationStatusLabel(a.statusLabel || a.finalStatus)}</span>
                  </div>
                  <div className="dashboardActionMeta">{mapFieldDisplayName(a.subjectName, a.subjectName)}</div>
                  <div className="dashboardActionSummary">{buildOperationSummary(a.statusLabel || a.finalStatus, a.actionLabel)}</div>
                  <div className="muted" style={{ fontSize: 12 }}>更新于 {a.occurredAtLabel}</div>
                </Link>
              ))
            )}
          </div>
        </article>

        <article className="card sectionBlock">
          <div className="sectionHeader demoSectionHeader">
            <div>
              <div className="sectionTitle">最近证据</div>
              <div className="sectionDesc">只保留结果摘要与资源信息，技术编号下沉到详情页。</div>
            </div>
          </div>
          <div className="list modernList compactList demoList">
            {d.evidences.length === 0 ? (
              <EmptyBlock text="暂无执行证据" />
            ) : (
              d.evidences.slice(0, 4).map((e: any, i: number) => {
                const card = e?.card || {};
                return (
                  <Link key={e?.id || i} to={e?.href || card?.href || "/audit-export"} className="infoCard demoInfoCard dashboardEvidenceCard">
                    <div className="demoCardTopRow">
                      <div className="title">{mapFieldDisplayName(e?.fieldName, e?.fieldName)} · {mapOperationActionLabel(e?.operationName || card?.executorLabel)}</div>
                      <span className="statusTag tone-neutral">{card?.constraintCheckLabel || "已回传"}</span>
                    </div>
                    <div className="dashboardActionSummary">最近一次执行已回传，可查看资源消耗与约束校验结果。</div>
                    <div className="muted">完成时间：{card?.finishedAtLabel || "--"}</div>
                    <div className="muted">用水 {card?.waterLabel || "--"} · 耗电 {card?.powerLabel || "--"}</div>
                  </Link>
                );
              })
            )}
          </div>
        </article>
      </section>
    </div>
  );
}
