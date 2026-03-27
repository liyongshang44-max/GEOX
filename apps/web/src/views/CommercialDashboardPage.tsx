import React from "react";
import { Link } from "react-router-dom";
import { useDashboard } from "../hooks/useDashboard";
import { StatusTag } from "../components/StatusTag";
import { RelativeTime } from "../components/RelativeTime";
import EmptyState from "../components/common/EmptyState";
import ErrorState from "../components/common/ErrorState";

type DashboardProps = { expert?: boolean };

export default function CommercialDashboardPage(_: DashboardProps): React.ReactElement {
  const { loading, error, vm, reload } = useDashboard();
  const cp = vm.controlPlane;

  const summaryCards = cp?.headline_cards ?? [
    { title: "运行中 Program", value: vm.summary.activePrograms, hint: "当前可持续跟进的经营对象", to: "/programs" },
    { title: "需优先处理", value: vm.summary.priorityPrograms, hint: "建议优先处理的阻塞与风险项", to: "/programs?priority=true" },
    { title: "待执行动作", value: vm.summary.pendingActions, hint: "已生成但尚未完结的动作", to: "/operations" },
    { title: "数据缺口 / 低效率", value: vm.summary.dataIssues, hint: "采集缺口或效率偏低项", to: "/alerts" },
  ];

  return (
    <div className="productPage">
      <section className="card pageContextBar">
        <div>
          <div className="eyebrow">GEOX / 农业运营控制台</div>
          <h2 className="sectionTitle" style={{ marginTop: 4 }}>{cp?.meta?.page_title || "运营总览"}</h2>
          <div className="muted">{cp?.meta?.page_subtitle || "研发模式 · 管理员会话 · 中文界面"}</div>
        </div>
        <div style={{ display: "grid", gap: 8, justifyItems: "end" }}>
          <div className="muted">最近更新时间：{cp?.meta?.updated_at_label || <RelativeTime value={Date.now()} />}</div>
          <button className="btn" onClick={() => void reload()} disabled={loading}>刷新首页</button>
        </div>
      </section>

      {error ? <ErrorState title="首页数据加载失败" message="请稍后刷新，或检查后端服务状态。" onRetry={() => void reload()} /> : null}

      <section className="summaryGrid4">
        {summaryCards.map((card) => (
          <Link key={card.title} className="card metricLinkCard" to={card?.action?.href || card.to || "#"}>
            <div className="muted">{card.title}</div>
            <div className="metricBig">{loading ? "--" : card.value}</div>
            <div className="muted">{card.description || card.hint}</div>
          </Link>
        ))}
      </section>

      <section className="card sectionBlock">
        <div className="sectionHeader"><div className="sectionTitle">{cp?.priority_programs?.title || "优先 Program"}</div><Link className="btn" to={cp?.priority_programs?.action?.href || "/programs"}>查看 Program 列表</Link></div>
        <div className="list modernList">
          {(cp?.priority_programs?.items || vm.priorityPrograms).map((item: any) => (
            <article key={item.program_id || item.id} className="infoCard">
              <div className="jobTitleRow">
                <div className="title">{item.title || item.name}</div>
                <StatusTag status={item.status?.code || item.status} />
              </div>
              <div className="meta wrapMeta">
                <span>{item.subtitle || item.fieldCrop}</span>
                <span>建议：{item.next_action || item.nextStep}</span>
                <span>风险：{item.risk_reason || item.riskReason}</span>
                <span>更新：{item.updated_at_label || item.updatedAt}</span>
              </div>
              <div style={{ marginTop: 8 }}><Link className="btn" to={item.actions?.[0]?.href || `/programs/${encodeURIComponent(item.program_id || item.id)}`}>查看详情</Link></div>
            </article>
          ))}
          {!(cp?.priority_programs?.items || vm.priorityPrograms).length ? <EmptyState title="暂无可展示 Program" description="请等待新一轮建议与审批状态更新" /> : null}
        </div>
      </section>

      <div className="contentGridTwo alignStart">
        <section className="card sectionBlock">
          <div className="sectionHeader"><div className="sectionTitle">{cp?.pending_action_list?.title || "待处理动作"}</div><Link className="btn" to={cp?.pending_action_list?.action?.href || "/actions"}>进入待执行动作页</Link></div>
          <div className="list modernList compactList">
            {(cp?.pending_action_list?.items || vm.pendingActions).map((a: any) => (
              <article key={a.id} className="infoCard">
                <div className="jobTitleRow"><div className="title">{a.title || a.actionType}</div><StatusTag status={a.status?.code || a.mode} showCode={false} /></div>
                <div className="meta wrapMeta"><span>{a.field_name || a.programName || "-"}</span><span>{a.device_name || "设备待分配"}</span><span>{a.updated_at_label || a.reason}</span></div>
              </article>
            ))}
            {!(cp?.pending_action_list?.items || vm.pendingActions).length ? <EmptyState title="当前没有待执行动作" description="系统会在下一轮评估后自动补充" /> : null}
          </div>
        </section>

        <section className="card sectionBlock">
          <div className="sectionHeader"><div className="sectionTitle">{cp?.recent_evidence?.title || "最近证据"}</div><Link className="btn" to={cp?.recent_evidence?.action?.href || "/evidence"}>进入证据页</Link></div>
          <div className="list modernList compactList">
            {(cp?.recent_evidence?.items || vm.evidence.recentPackages).map((e: any) => (
              <article key={e.id} className="infoCard">
                <div className="jobTitleRow"><div className="title">{e.title || `证据导出作业 ${e.id}`}</div><StatusTag status={e.status?.code || e.status} /></div>
                <div className="meta"><span>{e.summary || `更新时间：${e.updatedAt}`}</span></div>
              </article>
            ))}
            {!(cp?.recent_evidence?.items || vm.evidence.recentPackages).length ? <EmptyState title="最近暂无证据导出" description="可在证据页手动刷新" /> : null}
          </div>
        </section>
      </div>

      <section className="card sectionBlock">
        <div className="sectionHeader"><div className="sectionTitle">{cp?.risk_summary?.title || "风险摘要"}</div><Link className="btn" to={cp?.risk_summary?.action?.href || "/dashboard/risks"}>查看风险中心</Link></div>
        <div className="summaryGrid2">
          <div className="card" style={{ padding: 14 }}>
            <div className="muted">验收风险</div>
            <div className="metricBig" style={{ fontSize: 24 }}>{cp?.risk_summary?.items?.length ?? vm.risks.acceptance.length}</div>
            {!(cp?.risk_summary?.items?.length ?? vm.risks.acceptance.length) ? <div className="muted">当前未发现高风险项</div> : (cp?.risk_summary?.items || vm.risks.acceptance).slice(0, 3).map((i: any, idx: number) => <div key={idx}>{i.title} · {i.summary || i.reason}</div>)}
          </div>
          <div className="card" style={{ padding: 14 }}>
            <div className="muted">数据缺口</div>
            <div className="metricBig" style={{ fontSize: 24 }}>{cp?.risk_summary?.metrics?.offline_devices ?? vm.risks.dataGaps.length}</div>
            {!vm.risks.dataGaps.length ? <div className="muted">暂无明显数据缺口</div> : vm.risks.dataGaps.slice(0, 3).map((i, idx) => <div key={idx}>{i.title} · {i.nextStep}</div>)}
          </div>
        </div>
      </section>
    </div>
  );
}
