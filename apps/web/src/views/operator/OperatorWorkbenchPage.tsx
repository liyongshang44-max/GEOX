import React from "react";
import { Link } from "react-router-dom";
import { fetchOperatorWorkbench } from "../../api/operatorWorkbench";
import OperatorEmptyState from "../../components/operator/OperatorEmptyState";
import { isPermissionDeniedError, OperatorPageStateView, sanitizeOperatorError, withOperatorLoadTimeout, type OperatorPageRuntimeState } from "../../components/operator/OperatorPageState";
import OperatorLayout from "../../layouts/OperatorLayout";
import { buildOperatorWorkbenchVm, type OperatorWorkbenchVm } from "../../viewmodels/operatorWorkbenchVm";
import { OPERATOR_PAGE_META } from "./operatorPageMeta";

const PAGE_NAME = "运营总队列";

export default function OperatorWorkbenchPage(): React.ReactElement {
  const meta = OPERATOR_PAGE_META.workbench;
  const [pageState, setPageState] = React.useState<OperatorPageRuntimeState>("loading");
  const [errorReason, setErrorReason] = React.useState("");
  const [vm, setVm] = React.useState<OperatorWorkbenchVm | null>(null);

  React.useEffect(() => {
    let alive = true;
    setPageState("loading");
    setErrorReason("");
    setVm(null);
    void withOperatorLoadTimeout(fetchOperatorWorkbench(), PAGE_NAME)
      .then((response) => {
        if (!alive) return;
        const nextVm = buildOperatorWorkbenchVm(response);
        setVm(nextVm);
        setPageState(nextVm.totalCount === 0 ? "empty" : "data-ready");
      })
      .catch((error: unknown) => {
        if (!alive) return;
        setVm(null);
        setErrorReason(sanitizeOperatorError(error));
        setPageState(isPermissionDeniedError(error) ? "permission-denied" : "error");
      });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <OperatorLayout title={meta.title} lead={meta.lead}>
      {pageState === "loading" ? <OperatorPageStateView state="loading" /> : null}
      {pageState === "error" ? <OperatorPageStateView state="error" reason={errorReason} /> : null}
      {pageState === "permission-denied" ? <OperatorPageStateView state="permission-denied" reason={errorReason} /> : null}
      {vm ? (
        <div className="operatorWorkbench">
          <section className="operatorPrinciplesCard" aria-label="运营处理原则">
            <h2>处理原则</h2>
            <ol>
              <li>先处理设备离线和执行异常，因为它们会影响证据可信度。</li>
              <li>再处理待审批、待验收和证据不足。</li>
              <li>所有处理动作只写审计记录，不自动生成正式验收或客户价值结论。</li>
            </ol>
            <p>动作后果：运营按钮用于记录处理事实、排查建议或候选任务；需要人工确认后，才可能进入正式作业、客户 ROI 或 Field Memory。</p>
          </section>

          <section className="operatorWorkbenchSummary">
            <div><span>数据范围</span><strong>{vm.dataScopeText}</strong></div>
            <div><span>待处理总数</span><strong>{vm.summary.total}</strong></div>
            <div><span>作业待办</span><strong>{vm.summary.operationTodos}</strong></div>
            <div><span>设备待办</span><strong>{vm.summary.deviceTodos}</strong></div>
            <div><span>证据待办</span><strong>{vm.summary.evidenceTodos}</strong></div>
            <div><span>告警待办</span><strong>{vm.summary.alertTodos}</strong></div>
            <div><span>更新时间</span><strong>{vm.generatedAtText}</strong></div>
          </section>

          <div className="operatorScopeWarning">{vm.summary.explanationText}</div>
          {vm.summary.deviceTodos > 0 && vm.summary.operationTodos === 0 ? <div className="operatorScopeWarning">当前待处理主要来自设备待办，不代表有 {vm.summary.deviceTodos} 条作业待办。</div> : null}
          {vm.dataScopeWarning ? <div className="operatorScopeWarning">{vm.dataScopeWarning}</div> : null}
          {vm.totalCount === 0 ? <OperatorEmptyState title={vm.emptyTitle || "暂无待处理事项"} description={vm.emptyDescription || "当前没有可展示的正式运营数据。"} reason="没有可处理列表时不伪造运营事项。" /> : null}

          <section className="operatorQueueGrid" aria-label="运营待办队列">
            {vm.queues.map((queue) => (
              <article key={queue.key} className={`operatorQueueCard ${queue.count > 0 ? "hasItems" : ""}`}>
                <header className="operatorQueueHead"><div><h2>{queue.title}</h2><p>{queue.description}</p></div><span>{queue.count}</span></header>
                <p className="operatorQueuePrinciple">处理后果：进入该队列只建立审计和复核链路，不自动生成正式验收或客户价值结论。</p>
                {queue.items.length ? (
                  <div className="operatorTodoList">
                    {queue.items.map((item) => (
                      <div key={`${queue.key}-${item.id}`} className="operatorTodoItem">
                        <div className="operatorTodoMain"><strong>{item.title}</strong><p>{item.description}</p><small>{item.metaText} · {item.priorityText} · {item.updatedAtText} · {item.sourceText}</small></div>
                        <div className="operatorTodoActions"><Link to={item.actionHref}>处理</Link>{item.relatedHref ? <Link to={item.relatedHref}>查看对象</Link> : null}</div>
                      </div>
                    ))}
                  </div>
                ) : <div className="operatorQueueEmpty">暂无该类待办。</div>}
              </article>
            ))}
          </section>
        </div>
      ) : null}
    </OperatorLayout>
  );
}
