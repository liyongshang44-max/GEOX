import React from "react";
import { Link } from "react-router-dom";
import { fetchOperatorWorkbench } from "../../api/operatorWorkbench";
import OperatorEmptyState from "../../components/operator/OperatorEmptyState";
import OperatorLayout from "../../layouts/OperatorLayout";
import { buildOperatorWorkbenchVm, type OperatorWorkbenchVm } from "../../viewmodels/operatorWorkbenchVm";
import { OPERATOR_PAGE_META } from "./operatorPageMeta";

export default function OperatorWorkbenchPage(): React.ReactElement {
  const meta = OPERATOR_PAGE_META.workbench;
  const [loading, setLoading] = React.useState(true);
  const [vm, setVm] = React.useState<OperatorWorkbenchVm | null>(null);

  React.useEffect(() => {
    let alive = true;
    setLoading(true);
    void fetchOperatorWorkbench()
      .then((response) => {
        if (!alive) return;
        setVm(buildOperatorWorkbenchVm(response));
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
      {loading ? <div className="operatorEmptyState">运营总队列加载中...</div> : null}
      {!loading && vm ? (
        <div className="operatorWorkbench">
          <section className="operatorWorkbenchSummary">
            <div>
              <span>数据范围</span>
              <strong>{vm.dataScopeText}</strong>
            </div>
            <div>
              <span>待处理总数</span>
              <strong>{vm.totalCount}</strong>
            </div>
            <div>
              <span>更新时间</span>
              <strong>{vm.generatedAtText}</strong>
            </div>
          </section>

          {vm.dataScopeWarning ? <div className="operatorScopeWarning">{vm.dataScopeWarning}</div> : null}

          {vm.totalCount === 0 ? (
            <OperatorEmptyState title={vm.emptyTitle} description={vm.emptyDescription} reason="没有可处理列表时不伪造运营事项。" />
          ) : null}

          <section className="operatorQueueGrid" aria-label="运营待办队列">
            {vm.queues.map((queue) => (
              <article key={queue.key} className={`operatorQueueCard ${queue.count > 0 ? "hasItems" : ""}`}>
                <header className="operatorQueueHead">
                  <div>
                    <h2>{queue.title}</h2>
                    <p>{queue.description}</p>
                  </div>
                  <span>{queue.count}</span>
                </header>

                {queue.items.length ? (
                  <div className="operatorTodoList">
                    {queue.items.map((item) => (
                      <div key={`${queue.key}-${item.id}`} className="operatorTodoItem">
                        <div className="operatorTodoMain">
                          <strong>{item.title}</strong>
                          <p>{item.description}</p>
                          <small>{item.metaText} · {item.priorityText} · {item.updatedAtText} · {item.sourceText}</small>
                        </div>
                        <div className="operatorTodoActions">
                          <Link to={item.actionHref}>处理</Link>
                          {item.relatedHref ? <Link to={item.relatedHref}>查看对象</Link> : null}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="operatorQueueEmpty">暂无该类待办。</div>
                )}
              </article>
            ))}
          </section>
        </div>
      ) : null}
    </OperatorLayout>
  );
}
