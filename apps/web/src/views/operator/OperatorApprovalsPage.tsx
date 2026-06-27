import React from "react";
import { fetchOperatorApprovals, submitOperatorApprovalAction, type OperatorApprovalActionKind } from "../../api/operatorApprovals";
import { fetchSessionMe, type SessionMe } from "../../api/session";
import OperatorEmptyState from "../../components/operator/OperatorEmptyState";
import { isPermissionDeniedError, OperatorPageStateView, sanitizeOperatorError, withOperatorLoadTimeout, type OperatorPageRuntimeState } from "../../components/operator/OperatorPageState";
import PermissionGate from "../../components/operator/PermissionGate";
import OperatorLayout from "../../layouts/OperatorLayout";
import { hasOperatorPermission, permissionReason } from "../../lib/permissions";
import { buildOperatorApprovalsVm, type OperatorApprovalRowVm, type OperatorApprovalsVm } from "../../viewmodels/operatorApprovalsVm";
import { OPERATOR_PAGE_META } from "./operatorPageMeta";

type ApprovalSectionKey = "pending" | "highRiskPrescriptions" | "noPermission" | "selfApprovalRisk" | "history";

type ApprovalSectionProps = {
  sectionKey: ApprovalSectionKey;
  title: string;
  description: string;
  rows: OperatorApprovalRowVm[];
  writeReady: boolean;
  getActionState: (approvalRequestId: string) => { pending: boolean; lastError: string | null };
  onAction: (row: OperatorApprovalRowVm, action: OperatorApprovalActionKind) => void;
  sessionAllowed: boolean;
  sessionLoading: boolean;
  sessionDeniedReason: string;
};

const PAGE_NAME = "审批中心";

function safeMessage(value: unknown, fallback = "操作失败，请稍后重试。") {
  return sanitizeOperatorError(value, fallback);
}

function DisabledApprovalButtons({ pending }: { pending: boolean }): React.ReactElement {
  return <div className="operatorApprovalDecisionActions" aria-disabled="true"><button type="button" disabled>{pending ? "处理中..." : "通过"}</button><button type="button" disabled>{pending ? "处理中..." : "拒绝"}</button><button type="button" disabled>{pending ? "处理中..." : "退回补充"}</button></div>;
}

function ApprovalDecisionActions({ row, writeReady, pending, lastError, onAction, sessionAllowed, sessionLoading, sessionDeniedReason }: { row: OperatorApprovalRowVm; writeReady: boolean; pending: boolean; lastError: string | null; onAction: (action: OperatorApprovalActionKind) => void; sessionAllowed: boolean; sessionLoading: boolean; sessionDeniedReason: string }): React.ReactElement {
  const disabledReason = row.selfApprovalRisk ? "当前不可操作：发起人与审批人相同" : (!writeReady ? "当前不可操作：审批写操作未 ready，当前只读。" : (sessionDeniedReason ? `当前不可操作：${sessionDeniedReason}` : (!row.actionButtonState.canAction ? row.permissionReason : null)));
  const disabled = Boolean(disabledReason) || pending;
  return <div className="operatorApprovalDecisionPanel" aria-label="审批决策区" aria-disabled={disabled}>{disabledReason ? <div className="operatorApprovalDecisionNotice">{disabledReason}</div> : null}{lastError ? <div className="operatorApprovalDecisionNotice">{lastError}</div> : null}<PermissionGate permissionKey="approve" allowed={sessionAllowed && !row.selfApprovalRisk && writeReady} loading={sessionLoading} disabledReason={disabledReason ?? sessionDeniedReason} fallback={() => <DisabledApprovalButtons pending={pending} />}>{() => <div className="operatorApprovalDecisionActions" aria-disabled={disabled}><button type="button" disabled={disabled} onClick={() => onAction("approve")}>{pending ? "处理中..." : "通过"}</button><button type="button" disabled={disabled} onClick={() => onAction("reject")}>{pending ? "处理中..." : "拒绝"}</button><button type="button" disabled={disabled} onClick={() => onAction("return")}>{pending ? "处理中..." : "退回补充"}</button></div>}</PermissionGate><small>审批动作由会话权限、审计记录和状态回写共同控制。</small></div>;
}

function ApprovalCard({ row, writeReady, actionState, onAction, sessionAllowed, sessionLoading, sessionDeniedReason }: { row: OperatorApprovalRowVm; writeReady: boolean; actionState: { pending: boolean; lastError: string | null }; onAction: (row: OperatorApprovalRowVm, action: OperatorApprovalActionKind) => void; sessionAllowed: boolean; sessionLoading: boolean; sessionDeniedReason: string }): React.ReactElement {
  return (
    <article className="operatorApprovalCard">
      <header className="operatorApprovalCardHead"><div><h3>{row.title}</h3><p>{row.description}</p></div><span className={`operatorRiskBadge ${row.riskTone}`}>{row.riskText}</span></header>
      <div className="operatorApprovalMetaGrid"><div><span>对象</span><strong>{row.objectText}</strong></div><div><span>状态</span><strong>{row.statusText}</strong></div><div><span>风险</span><strong>{row.riskText}</strong></div><div><span>下一步</span><strong>{row.nextActionText}</strong></div><div><span>发起人</span><strong>{row.requestedByText}</strong></div><div><span>审批人</span><strong>{row.approverText}</strong></div><div><span>更新时间</span><strong>{row.updatedAtText}</strong></div></div>
      <div className="operatorPrescriptionBox"><div><span>处方查看</span><strong>{row.prescriptionText}</strong><small>建议关联：{row.recommendationText}</small></div><button type="button" disabled={!row.prescriptionHref}>查看处方</button></div>
      <details className="operationTechDetailsMuted"><summary className="operationTechDetailsSummary">技术引用</summary><div className="operatorApprovalMetaGrid customerSpacingTopSm"><div><span>审批记录</span><strong>{row.technicalRefs.approvalRequestIdText}</strong></div><div><span>处方记录</span><strong>{row.technicalRefs.prescriptionIdText}</strong></div><div><span>建议记录</span><strong>{row.technicalRefs.recommendationIdText}</strong></div><div><span>来源</span><strong>{row.technicalRefs.sourceText}</strong></div></div></details>
      <ApprovalDecisionActions row={row} writeReady={writeReady} pending={actionState.pending} lastError={actionState.lastError} onAction={(action) => onAction(row, action)} sessionAllowed={sessionAllowed} sessionLoading={sessionLoading} sessionDeniedReason={sessionDeniedReason} />
    </article>
  );
}

function ApprovalSection({ sectionKey, title, description, rows, writeReady, getActionState, onAction, sessionAllowed, sessionLoading, sessionDeniedReason }: ApprovalSectionProps): React.ReactElement {
  return <section className="operatorApprovalSection"><header className="operatorApprovalSectionHead"><div><h2>{title}</h2><p>{description}</p></div><span>{rows.length}</span></header>{rows.length ? <div className="operatorApprovalList">{rows.map((row) => <ApprovalCard key={`${sectionKey}-${row.approvalRequestId}`} row={row} writeReady={writeReady} actionState={getActionState(row.approvalRequestId)} onAction={onAction} sessionAllowed={sessionAllowed} sessionLoading={sessionLoading} sessionDeniedReason={sessionDeniedReason} />)}</div> : <div className="operatorQueueEmpty">暂无该类审批事项。</div>}</section>;
}

export default function OperatorApprovalsPage(): React.ReactElement {
  const meta = OPERATOR_PAGE_META.approvals;
  const [pageState, setPageState] = React.useState<OperatorPageRuntimeState>("loading");
  const [errorReason, setErrorReason] = React.useState("");
  const [vm, setVm] = React.useState<OperatorApprovalsVm | null>(null);
  const [actionStateById, setActionStateById] = React.useState<Record<string, { pending: boolean; lastError: string | null }>>({});
  const [session, setSession] = React.useState<SessionMe | null>(null);
  const [sessionLoading, setSessionLoading] = React.useState(true);

  const applyResponse = React.useCallback((response: Awaited<ReturnType<typeof fetchOperatorApprovals>>) => {
    const nextVm = buildOperatorApprovalsVm(response);
    setVm(nextVm);
    setPageState(nextVm.totalCount === 0 ? "empty" : "data-ready");
  }, []);

  const loadApprovals = React.useCallback(() => {
    setPageState("loading");
    setErrorReason("");
    return withOperatorLoadTimeout(fetchOperatorApprovals(), PAGE_NAME)
      .then(applyResponse)
      .catch((error: unknown) => {
        setVm(null);
        setErrorReason(sanitizeOperatorError(error));
        setPageState(isPermissionDeniedError(error) ? "permission-denied" : "error");
      });
  }, [applyResponse]);

  React.useEffect(() => { let alive = true; setSessionLoading(true); void fetchSessionMe().then((resp) => { if (alive) setSession(resp); }).catch(() => { if (alive) setSession(null); }).finally(() => { if (alive) setSessionLoading(false); }); return () => { alive = false; }; }, []);
  const sessionAllowed = hasOperatorPermission(session, "approve");
  const sessionDeniedReason = sessionAllowed ? "" : (sessionLoading ? "会话权限加载中..." : permissionReason(session, "approve"));

  React.useEffect(() => { let alive = true; setPageState("loading"); setErrorReason(""); setVm(null); void withOperatorLoadTimeout(fetchOperatorApprovals(), PAGE_NAME).then((response) => { if (!alive) return; applyResponse(response); }).catch((error: unknown) => { if (!alive) return; setVm(null); setErrorReason(sanitizeOperatorError(error)); setPageState(isPermissionDeniedError(error) ? "permission-denied" : "error"); }); return () => { alive = false; }; }, [applyResponse]);
  const getActionState = React.useCallback((approvalRequestId: string) => actionStateById[approvalRequestId] ?? { pending: false, lastError: null }, [actionStateById]);

  const onAction = React.useCallback((row: OperatorApprovalRowVm, action: OperatorApprovalActionKind) => {
    if (!sessionAllowed || !row.actionButtonState.canAction || row.selfApprovalRisk) return;
    setActionStateById((prev) => ({ ...prev, [row.approvalRequestId]: { pending: true, lastError: null } }));
    void submitOperatorApprovalAction(row.approvalRequestId, action).then((result) => {
      if (!result.ok) { const errorText = safeMessage(result.permission?.reason || result.message || result.error_code); setActionStateById((prev) => ({ ...prev, [row.approvalRequestId]: { pending: false, lastError: errorText } })); return; }
      setActionStateById((prev) => ({ ...prev, [row.approvalRequestId]: { pending: false, lastError: null } }));
      return loadApprovals();
    }).catch((error: unknown) => { setActionStateById((prev) => ({ ...prev, [row.approvalRequestId]: { pending: false, lastError: safeMessage(error instanceof Error ? error.message : error) } })); });
  }, [loadApprovals, sessionAllowed]);

  return (
    <OperatorLayout title={meta.title} lead={meta.lead}>
      {pageState === "loading" ? <OperatorPageStateView state="loading" /> : null}
      {pageState === "error" ? <OperatorPageStateView state="error" reason={errorReason} /> : null}
      {pageState === "permission-denied" ? <OperatorPageStateView state="permission-denied" reason={errorReason} /> : null}
      {vm ? (
        <div className="operatorApprovalsPage">
          <section className="operatorWorkbenchSummary"><div><span>数据范围</span><strong>{vm.dataScopeText}</strong></div><div><span>审批事项总数</span><strong>{vm.totalCount}</strong></div><div><span>更新时间</span><strong>{vm.generatedAtText}</strong></div></section>
          {vm.dataScopeWarning ? <div className="operatorScopeWarning">{vm.dataScopeWarning}</div> : null}
          {!vm.writeReady ? <div className="operatorScopeWarning">审批写操作未 ready：后端权限、审计和错误码未完成前，审批中心保持只读。</div> : null}
          {vm.totalCount === 0 ? <OperatorEmptyState title={vm.emptyTitle || "暂无待处理事项"} description={vm.emptyDescription || "当前没有待审批或历史审批记录。"} reason="没有审批数据时不伪造审批事项。" /> : null}
          <div className="operatorApprovalGrid"><ApprovalSection sectionKey="pending" title="待审批列表" description="当前需要运营人员处理的审批请求。" rows={vm.pending} writeReady={vm.writeReady} getActionState={getActionState} onAction={onAction} sessionAllowed={sessionAllowed} sessionLoading={sessionLoading} sessionDeniedReason={sessionDeniedReason} /><ApprovalSection sectionKey="highRiskPrescriptions" title="高风险处方" description="高风险且关联正式处方的审批事项。" rows={vm.highRiskPrescriptions} writeReady={vm.writeReady} getActionState={getActionState} onAction={onAction} sessionAllowed={sessionAllowed} sessionLoading={sessionLoading} sessionDeniedReason={sessionDeniedReason} /><ApprovalSection sectionKey="noPermission" title="无权限审批" description="当前身份不可执行审批动作的事项。" rows={vm.noPermission} writeReady={vm.writeReady} getActionState={getActionState} onAction={onAction} sessionAllowed={sessionAllowed} sessionLoading={sessionLoading} sessionDeniedReason={sessionDeniedReason} /><ApprovalSection sectionKey="selfApprovalRisk" title="自审批风险" description="发起人与审批人存在重合风险的事项。" rows={vm.selfApprovalRisk} writeReady={vm.writeReady} getActionState={getActionState} onAction={onAction} sessionAllowed={sessionAllowed} sessionLoading={sessionLoading} sessionDeniedReason={sessionDeniedReason} /><ApprovalSection sectionKey="history" title="审批历史" description="已通过、已拒绝或已退回的审批记录。" rows={vm.history} writeReady={vm.writeReady} getActionState={getActionState} onAction={onAction} sessionAllowed={sessionAllowed} sessionLoading={sessionLoading} sessionDeniedReason={sessionDeniedReason} /></div>
        </div>
      ) : null}
    </OperatorLayout>
  );
}
