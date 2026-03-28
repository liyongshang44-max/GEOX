import React from "react";
import { Link } from "react-router-dom";
import ReceiptEvidenceCard from "../components/evidence/ReceiptEvidenceCard";
import { fetchDashboardRecentExecutions, getOverview, getRecentEvidence } from "../api/dashboard";
import { useDashboard } from "../hooks/useDashboard";

type DashboardProps = { expert?: boolean };

function MetricCard({ title, value }: { title: string; value: number }): React.ReactElement {
  return (
    <div className="card" style={{ padding: 14 }}>
      <div className="muted">{title}</div>
      <div className="metricBig">{value}</div>
    </div>
  );
}

function EmptyBlock({ text }: { text: string }): React.ReactElement {
  return <div className="card muted" style={{ padding: 12 }}>{text}</div>;
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
    <div className="productPage" style={{ display: "grid", gap: 14 }}>
      <section className="card pageContextBar">
        <div>
          <div className="eyebrow">GEOX / 农业运营控制台</div>
          <h2 className="sectionTitle" style={{ marginTop: 4 }}>运营总览</h2>
          <div className="muted">统一看板（执行、证据、风险）</div>
        </div>
        <Link className="btn" to="/programs">查看 Program 列表</Link>
      </section>

      <section className="summaryGrid4">
        <MetricCard title="进行中作业" value={d.overview.inProgressCount} />
        <MetricCard title="今日完成" value={d.overview.completedTodayCount} />
        <MetricCard title="待处理" value={d.overview.pendingCount} />
        <MetricCard title="风险设备" value={d.overview.riskDeviceCount} />
      </section>

      <section className="contentGridTwo alignStart">
        <article className="card sectionBlock">
          <div className="sectionTitle">最近执行</div>
          <div className="list modernList compactList">
            {d.actions.length === 0 ? (
              <EmptyBlock text="暂无执行记录" />
            ) : (
              d.actions.map((a) => (
                <Link key={a.id} to={a.href || "/operations"} className="infoCard" style={{ padding: 12, display: "block", textDecoration: "none" }}>
                  <div className="title">{a.subjectName}</div>
                  <div className="muted">{a.actionLabel}</div>
                  <div className="muted" style={{ fontSize: 12 }}>{a.occurredAtLabel}</div>
                  <div>{a.statusLabel}</div>
                </Link>
              ))
            )}
          </div>
        </article>

        <article className="card sectionBlock">
          <div className="sectionTitle">最近证据</div>
          <div className="list modernList compactList">
            {d.evidences.length === 0 ? (
              <EmptyBlock text="暂无执行证据" />
            ) : (
              d.evidences.map((e: any, i: number) => (
                <Link key={e?.id || i} to={e?.href || e?.card?.href || "/operations"} style={{ textDecoration: "none", color: "inherit" }}>
                  <ReceiptEvidenceCard data={e?.card} />
                </Link>
              ))
            )}
          </div>
        </article>
      </section>

      <section className="contentGridTwo alignStart">
        <article className="card sectionBlock">
          <div className="sectionTitle">待处理事项</div>
          <EmptyBlock text="暂无待处理事项" />
        </article>
        <article className="card sectionBlock">
          <div className="sectionTitle">风险与提醒</div>
          <EmptyBlock text="暂无风险" />
        </article>
      </section>
    </div>
  );
}
