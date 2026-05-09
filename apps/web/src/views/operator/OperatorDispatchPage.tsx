import React from "react";
import { Link } from "react-router-dom";
import { fetchOperatorDispatch, submitOperatorDispatchAction, type OperatorDispatchActionKind } from "../../api/operatorDispatch";
import OperatorEmptyState from "../../components/operator/OperatorEmptyState";
import OperatorLayout from "../../layouts/OperatorLayout";
import { buildOperatorDispatchVm, type OperatorDispatchGroupVm, type OperatorDispatchRowVm, type OperatorDispatchVm } from "../../viewmodels/operatorDispatchVm";
import { OPERATOR_PAGE_META } from "./operatorPageMeta";

function safeMessage(value: unknown, fallback = "操作失败，请稍后重试。") {
  const text = String(value ?? "").trim();
  if (!text || text === "--") return fallback;
  if (/token|secret|credential|private\s*key|password|stack\s*trace|debug\s*json/i.test(text)) return fallback;
  return text;
}

function DispatchRow({
  row,
  writeReady,
  actionState,
  onAction,
}: {
  row: OperatorDispatchRowVm;
  writeReady: boolean;
  actionState: { pending: boolean; lastError: string | null };
  onAction: (row: OperatorDispatchRowVm, action: OperatorDispatchActionKind) => void;
}): React.ReactElement {
  const dispatchDisabled = !writeReady || !row.dispatchButtonState.canAction || actionState.pending;
  const retryDisabled = !writeReady || !row.retryButtonState.canAction || actionState.pending;
  const notice = row.dispatchButtonState.disabledReason || row.retryButtonState.disabledReason || row.disabledReason;

  return (
    <article className="operatorDispatchRow">
      <header className="operatorDispatchRowHead">
        <div>
          <h3>{row.title}</h3>
          <p>{row.objectText}</p>
        </div>
        <span className={`operatorDispatchStatus ${row.statusTone}`}>{row.statusText}</span>
      </header>

      <div className="operatorDispatchFlow" aria-label="任务派发状态链路">
        <div><span>AO-ACT Task</span><strong>{row.taskText}</strong></div>
        <div><span>Dispatch</span><strong>{row.dispatchText}</strong></div>
        <div><span>ACK</span><strong>{row.ackText}</strong></div>
        <div><span>Receipt</span><strong>{row.receiptText}</strong></div>
      </div>

      <div className="operatorDispatchMeta">
        <div><span>执行方式</span><strong>{row.executionModeText}</strong></div>
        <div><span>执行方</span><strong>{row.executorText}</strong></div>
        <div><span>失败原因</span><strong>{actionState.lastError || row.failureReasonText}</strong></div>
        <div><span>数据来源</span><strong>{row.sourceText}</strong></div>
      </div>

      <div className="operatorDispatchNotice">派发和重试只作用于 AO-ACT task。执行完成或收到回执不等于验收通过，客户作业报告不会因派发成功直接显示验收通过。</div>
      {actionState.lastError ? <div className="operatorScopeWarning">{actionState.lastError}</div> : null}

      <div className="operatorDispatchActions">
        {row.taskHref ? <Link to={row.taskHref}>查看任务对象</Link> : null}
        {row.receiptHref ? <Link to={row.receiptHref}>查看回执对象</Link> : null}
        <button type="button" disabled={dispatchDisabled} onClick={() => onAction(row, "dispatch")}>{actionState.pending ? "处理中..." : "派发"}</button>
        <button type="button" disabled={retryDisabled} onClick={() => onAction(row, "retry")}>{actionState.pending ? "处理中..." : "重试"}</button>
      </div>
      {notice ? <div className="operatorScopeWarning">{notice}</div> : null}
    </article>
  );
}

function DispatchGroup({
  group,
  writeReady,
  getActionState,
  onAction,
}: {
  group: OperatorDispatchGroupVm;
  writeReady: boolean;
  getActionState: (taskId: string) => { pending: boolean; lastError: string | null };
  onAction: (row: OperatorDispatchRowVm, action: OperatorDispatchActionKind) => void;
}): React.ReactElement {
  return (
    <section className="operatorDispatchGroup">
      <header className="operatorDispatchGroupHead">
        <div>
          <h2>{group.title}</h2>
          <p>{group.description}</p>
        </div>
        <span>{group.count}</span>
      </header>
      {group.rows.length ? (
        <div className="operatorDispatchList">
          {group.rows.map((row) => (
            <DispatchRow
              key={`${group.key}-${row.taskId}-${row.receiptIdText}`}
              row={row}
              writeReady={writeReady}
              actionState={getActionState(row.taskId)}
              onAction={onAction}
            />
          ))}
        </div>
      ) : <div className="operatorQueueEmpty">暂无该类派发任务。</div>}
    </section>
  );
}

export default function OperatorDispatchPage(): React.ReactElement {
  const meta = OPERATOR_PAGE_META.dispatch;
  const [loading, setLoading] = React.useState(true);
  const [vm, setVm] = React.useState<OperatorDispatchVm | null>(null);
  const [actionStateByTask, setActionStateByTask] = React.useState<Record<string, { pending: boolean; lastError: string | null }>>({});

  const loadDispatch = React.useCallback(() => {
    setLoading(true);
    return fetchOperatorDispatch()
      .then((response) => {
        setVm(buildOperatorDispatchVm(response));
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  React.useEffect(() => {
    let alive = true;
    setLoading(true);
    void fetchOperatorDispatch()
      .then((response) => {
        if (!alive) return;
        setVm(buildOperatorDispatchVm(response));
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const getActionState = React.useCallback((taskId: string) => {
    return actionStateByTask[taskId] ?? { pending: false, lastError: null };
  }, [actionStateByTask]);

  const onAction = React.useCallback((row: OperatorDispatchRowVm, action: OperatorDispatchActionKind) => {
    const allowed = action === "dispatch" ? row.dispatchButtonState.canAction : row.retryButtonState.canAction;
    if (!allowed) return;
    setActionStateByTask((prev) => ({
      ...prev,
      [row.taskId]: { pending: true, lastError: null },
    }));

    void submitOperatorDispatchAction(row.taskId, action)
      .then((result) => {
        if (!result.ok) {
          const errorText = safeMessage(result.permission?.reason || result.message || result.error_code);
          setActionStateByTask((prev) => ({
            ...prev,
            [row.taskId]: { pending: false, lastError: errorText },
          }));
          return;
        }
        setActionStateByTask((prev) => ({
          ...prev,
          [row.taskId]: { pending: false, lastError: null },
        }));
        return loadDispatch();
      })
      .catch((error: unknown) => {
        setActionStateByTask((prev) => ({
          ...prev,
          [row.taskId]: { pending: false, lastError: safeMessage(error instanceof Error ? error.message : error) },
        }));
      });
  }, [loadDispatch]);

  return (
    <OperatorLayout title={meta.title} lead={meta.lead}>
      {loading ? <div className="operatorEmptyState">派发状态加载中...</div> : null}
      {!loading && vm ? (
        <div className="operatorDispatchPage">
          <section className="operatorWorkbenchSummary">
            <div><span>数据范围</span><strong>{vm.dataScopeText}</strong></div>
            <div><span>派发任务总数</span><strong>{vm.totalCount}</strong></div>
            <div><span>更新时间</span><strong>{vm.generatedAtText}</strong></div>
          </section>

          {vm.dataScopeWarning ? <div className="operatorScopeWarning">{vm.dataScopeWarning}</div> : null}
          {!vm.writeReady ? <div className="operatorScopeWarning">派发写操作未 ready：后端权限、审计和错误码未完成前，当前页面只读。</div> : null}

          {vm.totalCount === 0 ? <OperatorEmptyState title={vm.emptyTitle} description={vm.emptyDescription} reason="没有派发数据时不伪造任务或回执。" /> : null}

          <section className="operatorDispatchGrid" aria-label="派发状态分组">
            {vm.groups.map((group) => (
              <DispatchGroup
                key={group.key}
                group={group}
                writeReady={vm.writeReady}
                getActionState={getActionState}
                onAction={onAction}
              />
            ))}
          </section>
        </div>
      ) : null}
    </OperatorLayout>
  );
}
