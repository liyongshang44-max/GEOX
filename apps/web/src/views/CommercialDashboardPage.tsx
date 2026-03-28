import React from "react";
import { Link } from "react-router-dom";
import { fetchDashboardRecentExecutions, getOverview, getRecentEvidence } from "../api/dashboard";
import StatusBadge from "../components/common/StatusBadge";
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

function canonicalStatus(statusLabel?: string, fallbackRaw?: string): string {
  const text = String(statusLabel ?? "").trim();
  if (text === "已完成" || text.includes("完成")) return "SUCCEEDED";
  if (text === "风险" || text.includes("失败") || text.includes("异常") || text.includes("风险")) return "FAILED";
  if (text === "待处理" || text.includes("待")) return "PENDING";
  const raw = String(fallbackRaw ?? "").trim();
  if (raw) return raw;
  return "RUNNING";
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
        <MetricCard title="今日完成" value={d.overview.completedTodayCount} />
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
              <EmptyBlock text="暂无数据" />
            ) : (
              d.actions.map((a) => (
                <Link key={a.id} to={a.href || "/operations"} className="infoCard demoInfoCard">
                  <div className="demoCardTopRow">
                    <div className="title">{a.subjectName || "--"} · {a.actionLabel || "执行任务"}</div>
                    <StatusBadge status={canonicalStatus(a.statusLabel, a.finalStatus)} />
                  </div>
                  <div className="muted" style={{ fontSize: 12 }}>更新于 {a.occurredAtLabel}</div>
                  <div className="muted" style={{ fontSize: 12 }}>operation_plan_id / task_id: {a.id}</div>
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
                      <div className="title">{e?.fieldName || "田块"} · {e?.operationName || card?.executorLabel || "作业"}</div>
                      <StatusBadge status={canonicalStatus(card?.statusLabel, card?.constraintCheckLabel)} />
                    </div>
                    <div className="muted">完成时间：{card?.finishedAtLabel || "--"}</div>
                    <div className="muted">{`用水 ${card?.waterLabel || "--"} · 耗电 ${card?.powerLabel || "--"}`}</div>
                    <div className="muted" style={{ fontSize: 12 }}>receipt_fact_id: {e?.id || "--"}</div>
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
