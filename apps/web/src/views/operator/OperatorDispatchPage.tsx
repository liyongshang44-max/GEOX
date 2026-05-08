import React from "react";
import { Link } from "react-router-dom";
import { fetchOperatorDispatch } from "../../api/operatorDispatch";
import OperatorEmptyState from "../../components/operator/OperatorEmptyState";
import OperatorLayout from "../../layouts/OperatorLayout";
import { buildOperatorDispatchVm, type OperatorDispatchGroupVm, type OperatorDispatchRowVm, type OperatorDispatchVm } from "../../viewmodels/operatorDispatchVm";
import { OPERATOR_PAGE_META } from "./operatorPageMeta";

function DispatchRow({ row, writeReady }: { row: OperatorDispatchRowVm; writeReady: boolean }): React.ReactElement {
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
        <div><span>失败原因</span><strong>{row.failureReasonText}</strong></div>
        <div><span>数据来源</span><strong>{row.sourceText}</strong></div>
      </div>

      <div className="operatorDispatchNotice">执行完成或收到回执不等于验收通过，验收结论请进入验收中心复核。</div>

      <div className="operatorDispatchActions">
        {row.taskHref ? <Link to={row.taskHref}>查看任务对象</Link> : null}
        {row.receiptHref ? <Link to={row.receiptHref}>查看回执对象</Link> : null}
        <button type="button" disabled>{writeReady ? "派发操作待授权" : "派发写操作未 ready"}</button>
      </div>
    </article>
  );
}

function DispatchGroup({ group, writeReady }: { group: OperatorDispatchGroupVm; writeReady: boolean }): React.ReactElement {
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
          {group.rows.map((row) => <DispatchRow key={`${group.key}-${row.taskId}-${row.receiptIdText}`} row={row} writeReady={writeReady} />)}
        </div>
      ) : <div className="operatorQueueEmpty">暂无该类派发任务。</div>}
    </section>
  );
}

export default function OperatorDispatchPage(): React.ReactElement {
  const meta = OPERATOR_PAGE_META.dispatch;
  const [loading, setLoading] = React.useState(true);
  const [vm, setVm] = React.useState<OperatorDispatchVm | null>(null);

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
            {vm.groups.map((group) => <DispatchGroup key={group.key} group={group} writeReady={vm.writeReady} />)}
          </section>
        </div>
      ) : null}
    </OperatorLayout>
  );
}
