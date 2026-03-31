import React from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  fetchDashboardRecommendations,
  fetchDashboardRecentExecutions,
  fetchDashboardOperationStates,
  fetchDashboardAssignments,
  getOverview,
  getRecentEvidence,
} from "../api/dashboard";
import { useDashboard } from "../hooks/useDashboard";
import { buildOperationSummary, mapFieldDisplayName, mapOperationActionLabel } from "../lib/operationLabels";

function EmptyBlock({ text }: { text: string }): React.ReactElement {
  return <div className="card muted" style={{ padding: 16 }}>{text}</div>;
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
      getAssignments: async (params?: { limit?: number }) => fetchDashboardAssignments(params?.limit ?? 100),
      enableLegacyDashboardEndpoints: false,
    }),
    [],
  );
  const d = useDashboard(api);

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

  const invalidCountForAction = Math.max(d.execution.invalidExecutionCount, invalidExecutionTasks.length);
  const keyActions = [
    {
      id: "key_fix_invalid_execution",
      title: `处理无效执行（${invalidCountForAction}项）`,
      detail: "优先补齐证据，避免执行无效持续累积",
      status: invalidCountForAction > 0 ? "需立即处理" : "已清零",
      href: "/operations?status=invalid_execution",
    },
    {
      id: "key_complete_acceptance",
      title: `补充验收（${overviewPendingAcceptanceCount}项）`,
      detail: "完成 PASS/FAIL 判定，推动作业闭环",
      status: overviewPendingAcceptanceCount > 0 ? "待验收" : "已完成",
      href: "/operations?status=done_unaccepted",
    },
    {
      id: "key_approve_recommendations",
      title: `审批建议（${d.decisions.pendingRecommendationCount}项）`,
      detail: "处理高优先级建议，减少后续执行阻塞",
      status: d.decisions.pendingRecommendationCount > 0 ? "待审批" : "已完成",
      href: "/agronomy/recommendations",
    },
  ];
  const indicatorChangeLabel = `高置信建议 ${d.decisions.pendingRecommendationCount} 条 · 今日执行 ${d.overview.todayExecutionCount} 次`;
  const riskChangeLabel = `高风险 ${riskLevelCount.high} 项 · 执行缺失 ${riskSourceCount.执行缺失} 项`;
  const jumpTargets = {
    decisions: "/operations?status=pending",
    execution: "/operations?status=running",
    acceptance: "/operations?status=done_unaccepted",
  } as const;
  const onCardClick = (to: string) => (evt: React.MouseEvent<HTMLElement>) => {
    const target = evt.target as HTMLElement | null;
    if (target?.closest("a")) return;
    navigate(to);
  };

  return (
    <div className="productPage demoDashboardPage">
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
            <div className="decisionCount">{keyActions.length}</div>
          </div>
          <div className="decisionList">
            {keyActions.map((item, idx) => (
              <Link key={item.id} to={item.href} className="decisionItemLink">
                <div className="decisionItemTitle">动作{idx + 1}：{item.title}</div>
                <div className="decisionItemMeta">{item.detail}</div>
                <div className="muted" style={{ fontSize: 12 }}>状态：{item.status}</div>
              </Link>
            ))}
            {!keyActions.length ? <EmptyBlock text="当前没有需要立即处理的动作" /> : null}
          </div>
        </article>
      </section>
    </div>
  );
}
