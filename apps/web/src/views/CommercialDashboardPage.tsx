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
  const runningActions = d.actions.filter((x) => x.finalStatus === "pending" || x.finalStatus === "running");
  const pendingApprovals = d.risks.filter((item) => item.startsWith("APPROVAL|")).map((item) => item.replace("APPROVAL|", ""));
  const riskAlerts = d.risks.filter((item) => item.startsWith("RISK|")).map((item) => item.replace("RISK|", ""));
  const acceptanceTasks = d.evidences
    .filter((e) => e.hasReceipt && e.acceptanceVerdict !== "PASS")
    .slice(0, 4);

  const overviewPendingAcceptanceCount = Math.max(d.overview.pendingAcceptanceCount, acceptanceTasks.length);

  const keyActions = [
    ...failedActions.slice(0, 2).map((item) => ({
      id: `failed_${item.id}`,
      title: `立即处置：${mapOperationActionLabel(item.actionLabel)}`,
      detail: `${mapFieldDisplayName(item.subjectName, item.subjectName)} · ${mapOperationStatusLabel(item.statusLabel || item.finalStatus)}`,
      href: item.href || "/operations",
    })),
    ...runningActions.slice(0, 2).map((item) => ({
      id: `running_${item.id}`,
      title: `跟进执行：${mapOperationActionLabel(item.actionLabel)}`,
      detail: `${buildOperationSummary(item.statusLabel || item.finalStatus, item.actionLabel)} · 更新于 ${item.occurredAtLabel}`,
      href: item.href || "/operations",
    })),
    ...pendingApprovals.slice(0, 2).map((item, idx) => ({
      id: `approval_${idx}`,
      title: "推进审批",
      detail: item,
      href: "/agronomy/recommendations",
    })),
  ].slice(0, 6);

  return (
    <div className="productPage demoDashboardPage">
      <section className="dashboardDecisionBoard">
        <article className="card decisionColumn success">
          <div className="decisionHeader">
            <div>
              <div className="sectionTitle">① 今日状态（Overview）</div>
              <div className="sectionDesc">地块与任务核心状态总览（来源：/api/v1/dashboard/overview）。</div>
            </div>
            <div className="decisionCount">{d.overview.fieldCount}</div>
          </div>
          <div className="decisionList">
            <div className="decisionItemStatic">
              <div className="decisionItemTitle">地块数</div>
              <div className="decisionItemMeta">{d.overview.fieldCount} 个地块</div>
            </div>
            <div className="decisionItemStatic">
              <div className="decisionItemTitle">正常 / 风险地块</div>
              <div className="decisionItemMeta">{d.overview.normalFieldCount} / {d.overview.riskFieldCount}</div>
            </div>
            <div className="decisionItemStatic">
              <div className="decisionItemTitle">今日执行任务数</div>
              <div className="decisionItemMeta">{d.overview.todayExecutionCount} 项</div>
            </div>
            <div className="decisionItemStatic">
              <div className="decisionItemTitle">待验收数量</div>
              <div className="decisionItemMeta">{overviewPendingAcceptanceCount} 项</div>
            </div>
          </div>
        </article>

        <article className="card decisionColumn danger">
          <div className="decisionHeader">
            <div>
              <div className="sectionTitle">② 风险与告警（Risk）</div>
              <div className="sectionDesc">失败作业与验收风险，优先消除阻断点。</div>
            </div>
            <div className="decisionCount">{failedActions.length + riskAlerts.length}</div>
          </div>
          <div className="decisionList">
            {failedActions.slice(0, 3).map((a) => (
              <Link key={a.id} to={a.href || "/operations"} className="decisionItemLink">
                <div className="decisionItemTitle">{mapOperationActionLabel(a.actionLabel)}</div>
                <div className="decisionItemMeta">{mapFieldDisplayName(a.subjectName, a.subjectName)} · {mapOperationStatusLabel(a.statusLabel || a.finalStatus)}</div>
              </Link>
            ))}
            {riskAlerts.slice(0, 3).map((risk, idx) => (
              <div key={`risk_${idx}`} className="decisionItemStatic">
                <div className="decisionItemTitle">验收风险</div>
                <div className="decisionItemMeta">{risk}</div>
              </div>
            ))}
            {failedActions.length + riskAlerts.length === 0 ? <EmptyBlock text="当前没有高优先级风险告警" /> : null}
          </div>
        </article>

        <article className="card decisionColumn warning">
          <div className="decisionHeader">
            <div>
              <div className="sectionTitle">③ 待决策（Decisions）</div>
              <div className="sectionDesc">需要人工确认/审批后才能继续执行的建议事项。</div>
            </div>
            <div className="decisionCount">{pendingApprovals.length}</div>
          </div>
          <div className="decisionList">
            {pendingApprovals.slice(0, 4).map((item, idx) => (
              <Link key={`approval_${idx}`} to="/agronomy/recommendations" className="decisionItemLink">
                <div className="decisionItemTitle">建议待审批</div>
                <div className="decisionItemMeta">{item}</div>
              </Link>
            ))}
            {pendingApprovals.length === 0 ? <EmptyBlock text="当前没有待审批建议" /> : null}
          </div>
        </article>

        <article className="card decisionColumn warning">
          <div className="decisionHeader">
            <div>
              <div className="sectionTitle">④ 执行中（Execution）</div>
              <div className="sectionDesc">持续跟进任务时序，避免执行链中断。</div>
            </div>
            <div className="decisionCount">{runningActions.length}</div>
          </div>
          <div className="decisionList">
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

        <article className="card decisionColumn warning">
          <div className="decisionHeader">
            <div>
              <div className="sectionTitle">⑤ 待验收（Acceptance）</div>
              <div className="sectionDesc">已回传证据但仍需验收确认的任务。</div>
            </div>
            <div className="decisionCount">{overviewPendingAcceptanceCount}</div>
          </div>
          <div className="decisionList">
            {acceptanceTasks.map((e: any, i: number) => {
              const card = e?.card || {};
              return (
                <Link key={e?.id || i} to={e?.href || card?.href || "/audit-export"} className="decisionItemLink">
                  <div className="decisionItemTitle">{mapFieldDisplayName(e?.fieldName, e?.fieldName)}</div>
                  <div className="decisionItemMeta">{card?.constraintCheckLabel || "待验收"} · {card?.waterLabel || "--"}</div>
                </Link>
              );
            })}
            {acceptanceTasks.length === 0 ? <EmptyBlock text="当前没有待验收任务" /> : null}
          </div>
        </article>

        <article className="card decisionColumn">
          <div className="decisionHeader">
            <div>
              <div className="sectionTitle">⑥ 本周期表现（Performance）</div>
              <div className="sectionDesc">按业务优先级整理的跨模块动作清单。</div>
            </div>
            <div className="decisionCount">{keyActions.length}</div>
          </div>
          <div className="decisionList">
            {keyActions.map((item) => (
              <Link key={item.id} to={item.href} className="decisionItemLink">
                <div className="decisionItemTitle">{item.title}</div>
                <div className="decisionItemMeta">{item.detail}</div>
              </Link>
            ))}
            {keyActions.length === 0 ? <EmptyBlock text="当前没有关键动作，请关注后续新告警" /> : null}
          </div>
        </article>
      </section>
    </div>
  );
}
