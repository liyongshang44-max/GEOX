import React from "react";
import { Link } from "react-router-dom";
import { fetchOperatorDispatch, submitOperatorDispatchAction, type OperatorDispatchActionKind } from "../../api/operatorDispatch";
import { fetchSessionMe, type SessionMe } from "../../api/session";
import OperatorEmptyState from "../../components/operator/OperatorEmptyState";
import { isPermissionDeniedError, OperatorPageStateView, sanitizeOperatorError, withOperatorLoadTimeout, type OperatorPageRuntimeState } from "../../components/operator/OperatorPageState";
import PermissionGate from "../../components/operator/PermissionGate";
import OperatorLayout from "../../layouts/OperatorLayout";
import { replaceOperatorTerms } from "../../lib/operatorStatusLabels";
import { hasOperatorPermission, permissionReason } from "../../lib/permissions";
import { buildOperatorDispatchVm, type OperatorDispatchGroupVm, type OperatorDispatchRowVm, type OperatorDispatchVm } from "../../viewmodels/operatorDispatchVm";
import { OPERATOR_PAGE_META } from "./operatorPageMeta";

const PAGE_NAME = "派发状态";

function safeMessage(value: unknown, fallback = "操作失败，请稍后重试。") {
  return sanitizeOperatorError(value, fallback);
}

function DisabledDispatchButtons({ pending }: { pending: boolean }): React.ReactElement {
  return <><button type="button" disabled>{pending ? "处理中..." : "查看任务对象"}</button><button type="button" disabled>{pending ? "处理中..." : "派发"}</button><button type="button" disabled>{pending ? "处理中..." : "重试"}</button></>;
}

function DispatchRow({ row, writeReady, actionState, onAction, sessionAllowed, sessionLoading, sessionDeniedReason }: { row: OperatorDispatchRowVm; writeReady: boolean; actionState: { pending: boolean; lastError: string | null }; onAction: (row: OperatorDispatchRowVm, action: OperatorDispatchActionKind) => void; sessionAllowed: boolean; sessionLoading: boolean; sessionDeniedReason: string }): React.ReactElement {
  const dispatchDisabled = !writeReady || !row.dispatchButtonState.canAction || actionState.pending;
  const retryDisabled = !writeReady || !row.retryButtonState.canAction || actionState.pending;
  const dispatchNotice = sessionDeniedReason || row.dispatchButtonState.disabledReason;
  const retryNotice = row.retryButtonState.disabledReason;
  const notice = dispatchNotice || retryNotice || row.disabledReason;
  return (
    <article className="operatorDispatchRow">
      <header className="operatorDispatchRowHead"><div><h3>{row.title}</h3><p>{row.objectText}</p></div><span className={`operatorDispatchStatus ${row.statusTone}`}>{row.statusText}</span></header>
      <div className="operatorDispatchFlow" aria-label="任务派发状态链路"><div><span>状态</span><strong>{row.statusText}</strong></div><div><span>下一步</span><strong>{row.nextActionText}</strong></div><div><span>执行任务</span><strong>{row.taskText}</strong></div><div><span>派发</span><strong>{row.dispatchText}</strong></div><div><span>接单确认</span><strong>{row.ackText}</strong></div><div><span>执行回执</span><strong>{row.receiptText}</strong></div></div>
      <div className="operatorDispatchMeta"><div><span>执行方式</span><strong>{row.executionModeText}</strong></div><div><span>执行方</span><strong>{row.executorText}</strong></div><div><span>设备</span><strong>{row.deviceText}</strong></div><div><span>失败原因</span><strong>{actionState.lastError || row.failureReasonText}</strong></div></div>
      <details className="operationTechDetailsMuted"><summary className="operationTechDetailsSummary">技术引用</summary><div className="operatorDispatchMeta customerSpacingTopSm"><div><span>执行任务 ID</span><strong>{row.technicalRefs.taskIdText}</strong></div><div><span>执行回执 ID</span><strong>{row.technicalRefs.receiptIdText}</strong></div><div><span>数据来源</span><strong>{row.technicalRefs.sourceText}</strong></div></div></details>
      <div className="operatorDispatchNotice">派发和重试只作用于执行任务。执行完成或收到执行回执不等于验收通过，客户作业报告不会因派发成功直接显示验收通过。</div>
      {actionState.lastError ? <div className="operatorScopeWarning">{actionState.lastError}</div> : null}
      <div className="operatorDispatchActions">{row.taskHref ? <Link to={row.taskHref}>查看任务对象</Link> : <button type="button" disabled>查看任务对象</button>}<PermissionGate permissionKey="dispatch" allowed={sessionAllowed} loading={sessionLoading} disabledReason={sessionDeniedReason} fallback={() => <DisabledDispatchButtons pending={actionState.pending} />}>{() => <><button type="button" disabled={dispatchDisabled} onClick={() => onAction(row, "dispatch")}>{actionState.pending ? "处理中..." : "派发"}</button><button type="button" disabled={retryDisabled} onClick={() => onAction(row, "retry")}>{actionState.pending ? "处理中..." : "重试"}</button></>}</PermissionGate></div>
      {notice ? <div className="operatorScopeWarning">{replaceOperatorTerms(notice)}</div> : null}
      {retryNotice && !row.canRetry ? <div className="operatorScopeWarning">{replaceOperatorTerms(retryNotice)}</div> : null}
    </article>
  );
}

function DispatchGroup({ group, writeReady, getActionState, onAction, sessionAllowed, sessionLoading, sessionDeniedReason }: { group: OperatorDispatchGroupVm; writeReady: boolean; getActionState: (taskId: string) => { pending: boolean; lastError: string | null }; onAction: (row: OperatorDispatchRowVm, action: OperatorDispatchActionKind) => void; sessionAllowed: boolean; sessionLoading: boolean; sessionDeniedReason: string }): React.ReactElement {
  return <section className="operatorDispatchGroup"><header className="operatorDispatchGroupHead"><div><h2>{group.title}</h2><p>{group.description}</p></div><span>{group.count}</span></header>{group.rows.length ? <div className="operatorDispatchList">{group.rows.map((row) => <DispatchRow key={`${group.key}-${row.taskId}-${row.receiptIdText}`} row={row} writeReady={writeReady} actionState={getActionState(row.taskId)} onAction={onAction} sessionAllowed={sessionAllowed} sessionLoading={sessionLoading} sessionDeniedReason={sessionDeniedReason} />)}</div> : <div className="operatorQueueEmpty">暂无该类派发任务。</div>}</section>;
}

export default function OperatorDispatchPage(): React.ReactElement {
  const meta = OPERATOR_PAGE_META.dispatch;
  const [pageState, setPageState] = React.useState<OperatorPageRuntimeState>("loading");
  const [errorReason, setErrorReason] = React.useState("");
  const [vm, setVm] = React.useState<OperatorDispatchVm | null>(null);
  const [actionStateByTask, setActionStateByTask] = React.useState<Record<string, { pending: boolean; lastError: string | null }>>({});
  const [session, setSession] = React.useState<SessionMe | null>(null);
  const [sessionLoading, setSessionLoading] = React.useState(true);

  const applyResponse = React.useCallback((response: Awaited<ReturnType<typeof fetchOperatorDispatch>>) => {
    const nextVm = buildOperatorDispatchVm(response);
    setVm(nextVm);
    setPageState(nextVm.totalCount === 0 ? "empty" : "data-ready");
  }, []);

  const loadDispatch = React.useCallback(() => {
    setPageState("loading");
    setErrorReason("");
    return withOperatorLoadTimeout(fetchOperatorDispatch(), PAGE_NAME).then(applyResponse).catch((error: unknown) => { setVm(null); setErrorReason(sanitizeOperatorError(error)); setPageState(isPermissionDeniedError(error) ? "permission-denied" : "error"); });
  }, [applyResponse]);

  React.useEffect(() => { let alive = true; setSessionLoading(true); void fetchSessionMe().then((resp) => { if (alive) setSession(resp); }).catch(() => { if (alive) setSession(null); }).finally(() => { if (alive) setSessionLoading(false); }); return () => { alive = false; }; }, []);
  const sessionAllowed = hasOperatorPermission(session, "dispatch");
  const sessionDeniedReason = sessionAllowed ? "" : (sessionLoading ? "会话权限加载中..." : permissionReason(session, "dispatch"));

  React.useEffect(() => { let alive = true; setPageState("loading"); setErrorReason(""); setVm(null); void withOperatorLoadTimeout(fetchOperatorDispatch(), PAGE_NAME).then((response) => { if (!alive) return; applyResponse(response); }).catch((error: unknown) => { if (!alive) return; setVm(null); setErrorReason(sanitizeOperatorError(error)); setPageState(isPermissionDeniedError(error) ? "permission-denied" : "error"); }); return () => { alive = false; }; }, [applyResponse]);
  const getActionState = React.useCallback((taskId: string) => actionStateByTask[taskId] ?? { pending: false, lastError: null }, [actionStateByTask]);

  const onAction = React.useCallback((row: OperatorDispatchRowVm, action: OperatorDispatchActionKind) => {
    const allowed = action === "dispatch" ? row.dispatchButtonState.canAction : row.retryButtonState.canAction;
    if (!sessionAllowed || !allowed) return;
    setActionStateByTask((prev) => ({ ...prev, [row.taskId]: { pending: true, lastError: null } }));
    void submitOperatorDispatchAction(row.taskId, action).then((result) => {
      if (!result.ok) { const errorText = safeMessage(result.permission?.reason || result.message || result.error_code); setActionStateByTask((prev) => ({ ...prev, [row.taskId]: { pending: false, lastError: errorText } })); return; }
      setActionStateByTask((prev) => ({ ...prev, [row.taskId]: { pending: false, lastError: null } }));
      return loadDispatch();
    }).catch((error: unknown) => { setActionStateByTask((prev) => ({ ...prev, [row.taskId]: { pending: false, lastError: safeMessage(error instanceof Error ? error.message : error) } })); });
  }, [loadDispatch, sessionAllowed]);

  return (
    <OperatorLayout title={meta.title} lead={meta.lead}>
      {pageState === "loading" ? <OperatorPageStateView state="loading" /> : null}
      {pageState === "error" ? <OperatorPageStateView state="error" reason={errorReason} /> : null}
      {pageState === "permission-denied" ? <OperatorPageStateView state="permission-denied" reason={errorReason} /> : null}
      {vm ? (
        <div className="operatorDispatchPage">
          <section className="operatorWorkbenchSummary"><div><span>数据范围</span><strong>{vm.dataScopeText}</strong></div><div><span>派发任务总数</span><strong>{vm.totalCount}</strong></div><div><span>更新时间</span><strong>{vm.generatedAtText}</strong></div></section>
          {vm.dataScopeWarning ? <div className="operatorScopeWarning">{vm.dataScopeWarning}</div> : null}
          {!vm.writeReady ? <div className="operatorScopeWarning">派发写操作未 ready：后端权限、审计和错误码未完成前，当前页面只读。</div> : null}
          {vm.totalCount === 0 ? <OperatorEmptyState title={vm.emptyTitle || "暂无待处理事项"} description={vm.emptyDescription || "当前没有派发任务或执行回执。"} reason="没有派发数据时不伪造任务或回执。" /> : null}
          <section className="operatorDispatchGrid" aria-label="派发状态分组">{vm.groups.map((group) => <DispatchGroup key={group.key} group={group} writeReady={vm.writeReady} getActionState={getActionState} onAction={onAction} sessionAllowed={sessionAllowed} sessionLoading={sessionLoading} sessionDeniedReason={sessionDeniedReason} />)}</section>
        </div>
      ) : null}
    </OperatorLayout>
  );
}
