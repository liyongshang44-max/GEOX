import React from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  fetchDashboardAcceptanceRisks,
  fetchDashboardPendingActions,
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
      getAcceptanceRisks: async (params?: { limit?: number }) => fetchDashboardAcceptanceRisks(params?.limit ?? 6),
      getPendingActions: async (params?: { limit?: number }) => fetchDashboardPendingActions(params?.limit ?? 6),
      getRecommendations: async (params?: { limit?: number }) => fetchDashboardRecommendations(params?.limit ?? 50),
      getOperationStates: async (params?: { limit?: number }) => fetchDashboardOperationStates(params?.limit ?? 100),
      getAssignments: async (params?: { limit?: number }) => fetchDashboardAssignments(params?.limit ?? 100),
    }),
    [],
  );
  const d = useDashboard(api);

  const failedActions = d.actions.filter((x) => x.finalStatus === "failed");
  const runningActions = d.actions.filter((x) => x.finalStatus === "pending" || x.finalStatus === "running");
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

  const receiptCount = d.evidences.filter((x) => x.hasReceipt).length;
  const passCount = d.evidences.filter((x) => x.acceptanceVerdict === "PASS").length;
  const pendingEvidenceCount = d.evidences.filter((x) => x.isPendingAcceptance).length;
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
              <div className="sectionTitle">③ 待决策（Decisions）</div>
              <div className="sectionDesc">来自 recommendation + approval 的决策入口。</div>
            </div>
            <Link to={jumpTargets.decisions} className="decisionCount">{d.decisions.pendingRecommendationCount + d.decisions.pendingApprovalCount}</Link>
          </div>
          <div className="decisionList">
            <div className="decisionItemStatic">
              <div className="decisionItemTitle">待审批建议</div>
              <div className="decisionItemMeta">建议 {d.decisions.pendingRecommendationCount} 条 · 审批 {d.decisions.pendingApprovalCount} 条</div>
            </div>
            <div className="decisionItemStatic">
              <div className="decisionItemTitle">高置信建议</div>
              <div className="decisionItemMeta">{d.decisions.potentialBenefitEstimate}</div>
            </div>
            <div className="decisionItemStatic">
              <div className="decisionItemTitle">执行缺失风险</div>
              <div className="decisionItemMeta">{d.decisions.nonExecutionRiskEstimate}</div>
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
              <div className="sectionTitle">④ 执行中（Execution）</div>
              <div className="sectionDesc">来自 operation + assignment 的任务网络视图。</div>
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
              <div className="sectionTitle">⑤ 待验收（Acceptance）</div>
              <div className="sectionDesc">核心商业点：receipt 存在且 acceptance != PASS。</div>
            </div>
            <Link to={jumpTargets.acceptance} className="decisionCount">{overviewPendingAcceptanceCount}</Link>
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
              <div className="sectionTitle">⑥ 作业证据（Evidence）</div>
              <div className="sectionDesc">已执行作业的回执与证据清单，可直接用于客户演示/售前。</div>
            </div>
            <div className="decisionCount">{d.evidences.length}</div>
          </div>
          <div className="decisionList">
            <div className="decisionItemStatic">
              <div className="decisionItemTitle">回执覆盖数</div>
              <div className="decisionItemMeta">{receiptCount} / {d.evidences.length}</div>
            </div>
            <div className="decisionItemStatic">
              <div className="decisionItemTitle">验收通过 / 待验收</div>
              <div className="decisionItemMeta">{passCount} / {pendingEvidenceCount}</div>
            </div>
            <div className="decisionItemStatic">
              <div className="decisionItemTitle">最近作业证据</div>
              <div className="decisionItemMeta">展示作业类型、时间、执行者、状态与资源使用</div>
            </div>
            {d.evidences.slice(0, 4).map((item) => (
              <Link key={item.id} to={item.href || "/audit-export"} className="decisionItemLink">
                <div className="decisionItemTitle">{mapFieldDisplayName(item.fieldName, item.fieldName)}</div>
                <div className="decisionItemMeta">作业类型：{item.operationName || "未知作业"}</div>
                <div className="decisionItemMeta">时间：{item.card?.finishedAtLabel || "-"}</div>
                <div className="decisionItemMeta">执行者：{item.card?.executorLabel || "-"}</div>
                <div className="decisionItemMeta">状态：{item.card?.statusLabel || (item.acceptanceVerdict === "PASS" ? "验收通过" : item.isPendingAcceptance ? "待验收" : "待回执")}</div>
                {item.card?.waterLabel || item.card?.powerLabel || item.card?.chemicalLabel ? (
                  <div className="decisionItemMeta">
                    资源使用：{[item.card?.waterLabel, item.card?.powerLabel, item.card?.chemicalLabel].filter(Boolean).join(" / ")}
                  </div>
                ) : null}
              </Link>
            ))}
            {d.evidences.length === 0 ? <EmptyBlock text="当前没有可展示的作业证据" /> : null}
          </div>
        </article>
      </section>
    </div>
  );
}
