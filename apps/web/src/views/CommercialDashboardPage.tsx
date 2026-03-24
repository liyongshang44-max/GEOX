import React from "react";
import { Link } from "react-router-dom";
import { useDashboard } from "../hooks/useDashboard";

type DashboardProps = { expert: boolean };

export default function CommercialDashboardPage({ expert }: DashboardProps): React.ReactElement {
  const { model, session, loading, message } = useDashboard();

  return (
    <div className="consolePage">
      <section className="hero card">
        <div>
          <div className="eyebrow">Commercial v1 · Dashboard</div>
          <h2 className="heroTitle">农业运营控制台</h2>
          <p className="heroText">聚合展示 KPI、优先 Program、待执行动作与最近证据/验收风险摘要。</p>
        </div>
        <div className="heroActions">
          {model.quickActions.map((action) => (
            <Link key={action.key} className={`btn ${action.key === "create_operation" ? "primary" : ""}`.trim()} to={action.to}>{action.label}</Link>
          ))}
          {!model.quickActions.length ? <Link className="btn primary" to="/operations">进入作业控制</Link> : null}
        </div>
      </section>

      <section className="summaryGrid">
        {model.kpis.map((kpi) => (
          <div key={kpi.label} className="metricCard card">
            <div className="metricLabel">{kpi.label}</div>
            <div className="metricValue">{kpi.value}</div>
            <div className="metricHint">{kpi.hint}</div>
          </div>
        ))}
      </section>

      <div className="contentGridTwo alignStart">
        <section className="card sectionBlock">
          <div className="sectionHeader"><div><div className="sectionTitle">Priority Programs</div><div className="sectionDesc">当前活跃 Program 优先列表。</div></div><Link className="btn" to="/programs">查看全部</Link></div>
          <div className="timelineList compactTimeline">
            {model.priorityPrograms.map((p) => (
              <div key={p.id} className="timelineItem">
                <strong>{p.title}</strong>
                <span><span className="pill tone-default">{p.status}</span><span style={{ marginLeft: 8 }}>field:{p.fieldId}</span><span style={{ marginLeft: 8 }}>season:{p.seasonId}</span></span>
              </div>
            ))}
            {!model.priorityPrograms.length ? <div className="emptyState">暂无优先 Program。</div> : null}
          </div>
        </section>

        <section className="card sectionBlock">
          <div className="sectionHeader"><div><div className="sectionTitle">Pending Actions</div><div className="sectionDesc">待处理动作与执行入口。</div></div><Link className="btn" to="/operations">进入动作中心</Link></div>
          <div className="timelineList compactTimeline">
            {model.pendingActions.map((a) => (
              <div key={a.id} className="timelineItem">
                <strong>{a.label}</strong>
                <span><span className={`pill tone-${a.tone}`}>{a.status}</span><Link style={{ marginLeft: 8 }} to={a.to}>前往处理</Link></span>
              </div>
            ))}
            {!model.pendingActions.length ? <div className="emptyState">暂无待处理动作。</div> : null}
          </div>
        </section>
      </div>

      <div className="contentGridTwo alignStart">
        <section className="card sectionBlock">
          <div className="sectionHeader"><div><div className="sectionTitle">Recent Evidence / Export</div><div className="sectionDesc">最近证据包与导出状态。</div></div><Link className="btn" to="/exports">查看导出任务</Link></div>
          <div className="timelineList compactTimeline">
            {model.evidenceSummary.map((e) => (
              <div key={e.id} className="timelineItem">
                <strong>{e.id}</strong>
                <span><span className={`pill tone-${e.tone}`}>{e.status}</span><span style={{ marginLeft: 8 }}>{e.scope}</span><span style={{ marginLeft: 8, color: "#6b7280" }}>{e.time}</span></span>
              </div>
            ))}
            {!model.evidenceSummary.length ? <div className="emptyState">暂无证据导出记录。</div> : null}
          </div>
        </section>

        <section className="card sectionBlock">
          <div className="sectionHeader"><div><div className="sectionTitle">Acceptance / Risk Summary</div><div className="sectionDesc">最近验收失败与风险项。</div></div><Link className="btn" to="/alerts">进入风险中心</Link></div>
          <div className="timelineList compactTimeline">
            {model.riskSummary.map((r) => (
              <div key={r.id} className="timelineItem">
                <strong>{r.title}</strong>
                <span><span className={`pill tone-${r.tone}`}>{r.level}</span><span style={{ marginLeft: 8 }}>field:{r.fieldId}</span><span style={{ marginLeft: 8, color: "#6b7280" }}>{r.time}</span></span>
              </div>
            ))}
            {!model.riskSummary.length ? <div className="emptyState">暂无风险项。</div> : null}
          </div>
        </section>
      </div>

      <section className="card sectionBlock">
        <div className="sectionHeader"><div><div className="sectionTitle">Dashboard Session</div><div className="sectionDesc">会话状态与页面刷新说明。</div></div></div>
        <div className="statusCallout">{loading ? "正在同步首页聚合数据..." : (message || "-")}</div>
        <div className="snapshotRows" style={{ marginTop: 14 }}>
          <div className="kv"><span className="k">角色</span><span className="v">{session?.role === "operator" ? "操作员" : session?.role === "admin" ? "管理员" : "未识别"}</span></div>
          <div className="kv"><span className="k">研发模式</span><span className="v">{expert ? "开启" : "关闭"}</span></div>
        </div>
      </section>
    </div>
  );
}
