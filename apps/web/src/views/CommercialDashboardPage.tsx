import React from "react";
import { Link } from "react-router-dom";
import { fetchDashboardRecentExecutions, getOverview, getRecentEvidence } from "../api/dashboard";
import { useDashboard } from "../hooks/useDashboard";

type DashboardProps = { expert?: boolean };

function MetricCard({ title, value }: { title: string; value: number }): React.ReactElement {
  return (
    <article className="card demoMetricCard">
      <div className="demoMetricLabel">{title}</div>
      <div className="demoMetricValue">{value}</div>
    </article>
  );
}

function EmptyBlock({ text }: { text: string }): React.ReactElement {
  return <div className="card muted" style={{ padding: 16 }}>{text}</div>;
}

function displayStatus(statusLabel: string): string {
  if (!statusLabel) return "进行中";
  return statusLabel;
}

export default function CommercialDashboardPage(_: DashboardProps): React.ReactElement {
  const api = React.useMemo(
    () => ({
      getOverview,
      getRecentExecutions: async (params?: { limit?: number }) => fetchDashboardRecentExecutions(params?.limit ?? 8),
      getRecentEvidence,
    }),
    [],
  );

  const d = useDashboard(api);

  return (
    <div className="productPage demoDashboardPage">
      <section className="card hero compactHero demoHero">
        <div>
          <div className="eyebrow">GEOX / 演示版本</div>
          <h1 className="demoHeroTitle">农业运营总览</h1>
          <p className="demoHeroSubTitle">查看田块状态、近期作业与执行证据</p>
        </div>
        <div className="heroActions">
          <Link className="btn" to="/fields">查看田块</Link>
          <Link className="btn ghost" to="/audit-export">查看证据</Link>
        </div>
      </section>

      <section className="summaryGrid4 demoSummaryGrid">
        <MetricCard title="在线设备" value={d.overview.onlineDeviceCount} />
        <MetricCard title="进行中作业" value={d.overview.inProgressCount} />
        <MetricCard title="今日完成作业" value={d.overview.completedTodayCount} />
        <MetricCard title="待处理事项" value={d.overview.pendingCount} />
      </section>

      <section className="contentGridTwo alignStart demoContentGrid">
        <article className="card sectionBlock">
          <div className="sectionHeader demoSectionHeader">
            <div>
              <div className="sectionTitle">最近作业</div>
              <div className="sectionDesc">田块状态与执行进度</div>
            </div>
          </div>
          <div className="list modernList compactList demoList">
            {d.actions.length === 0 ? (
              <EmptyBlock text="暂无近期作业" />
            ) : (
              d.actions.map((a) => (
                <Link key={a.id} to={a.href || "/operations"} className="infoCard demoInfoCard">
                  <div className="demoCardTopRow">
                    <div className="title">田块：{a.subjectName || "--"}</div>
                    <div className="muted">{displayStatus(a.statusLabel)}</div>
                  </div>
                  <div className="muted">动作：{a.actionLabel || "--"}</div>
                  <div className="muted" style={{ fontSize: 12 }}>更新时间：{a.occurredAtLabel}</div>
                </Link>
              ))
            )}
          </div>
        </article>

        <article className="card sectionBlock">
          <div className="sectionHeader demoSectionHeader">
            <div>
              <div className="sectionTitle">最近证据</div>
              <div className="sectionDesc">执行结果与消耗摘要</div>
            </div>
          </div>
          <div className="list modernList compactList demoList">
            {d.evidences.length === 0 ? (
              <EmptyBlock text="暂无执行证据" />
            ) : (
              d.evidences.map((e: any, i: number) => {
                const card = e?.card || {};
                return (
                  <Link key={e?.id || i} to={e?.href || card?.href || "/audit-export"} className="infoCard demoInfoCard">
                    <div className="demoCardTopRow">
                      <div className="title">作业：{card?.executorLabel || "执行任务"}</div>
                      <div className="muted">{card?.statusLabel || "未知状态"}</div>
                    </div>
                    <div className="muted">完成时间：{card?.finishedAtLabel || "--"}</div>
                    <div className="muted">用水：{card?.waterLabel || "--"}</div>
                    <div className="muted">耗电：{card?.powerLabel || "--"}</div>
                    <div className="muted">结果状态：{card?.constraintCheckLabel || card?.statusLabel || "--"}</div>
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
