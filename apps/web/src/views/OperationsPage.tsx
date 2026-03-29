import React from "react";
import { Link } from "react-router-dom";
import { fetchOperationStates } from "../api";
import { RelativeTime } from "../components/RelativeTime";
import { CopyButton } from "../components/CopyButton";
import EmptyState from "../components/common/EmptyState";
import { resolveOperationPlanId, toOperationDetailPath } from "../lib/operationLink";
import { buildOperationSummary, mapDeviceDisplayName, mapFieldDisplayName, mapOperationActionLabel, mapOperationStatusLabel } from "../lib/operationLabels";

function shouldFocus(item: any): boolean {
  const status = String(item?.final_status || item?.status || "").toUpperCase();
  const last = Number(item?.last_event_ts || item?.updated_ts_ms || 0);
  return ["READY", "DISPATCHED", "ACKED", "RUNNING"].includes(status) || Date.now() - last > 2 * 3600 * 1000;
}

export default function OperationsPage(): React.ReactElement {
  const [items, setItems] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);

  const reload = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchOperationStates({ limit: 200 });
      const list = Array.isArray(res.items) ? res.items : [];
      setItems(list.filter(shouldFocus));
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { void reload(); }, [reload]);

  return (
    <div className="productPage operationsPageV2">
      <section className="card sectionBlock operationsHeroCard">
        <div className="sectionHeader">
          <div>
            <div className="eyebrow">GEOX / 远程农业控制平面</div>
            <div className="breadcrumbBar"><span className="breadcrumbCurrent">总览</span><span className="breadcrumbSep">/</span><span className="breadcrumbCurrent">待执行动作</span></div>
            <h1 className="pageTitle">待执行动作</h1>
            <div className="pageLead">聚焦待执行与长时间未推进动作，支持快速追溯经营方案。</div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn" onClick={() => void reload()} disabled={loading}>刷新</button>
          </div>
        </div>
      </section>

      <section className="operationsCardGrid">
        {items.map((x) => {
          const actionLabel = mapOperationActionLabel(x.action_type);
          const statusLabel = mapOperationStatusLabel(x.final_status || x.status);
          const fieldLabel = mapFieldDisplayName(x.field_name, x.field_id);
          const deviceLabel = mapDeviceDisplayName(x.device_name, x.device_id);
          const planId = resolveOperationPlanId(x);
          return (
            <article key={planId || x.operation_id} className="card operationsSummaryCard">
              <div className="operationsSummaryTop">
                <div>
                  <div className="operationsSummaryTitle">{actionLabel}</div>
                  <div className="operationsSummaryLead">{buildOperationSummary(x.final_status || x.status, x.action_type)}</div>
                </div>
                <span className="statusTag tone-neutral">{statusLabel}</span>
              </div>

              <div className="operationsSummaryGrid">
                <div className="operationsSummaryMetric">
                  <span className="operationsSummaryLabel">田块</span>
                  <strong>{fieldLabel}</strong>
                </div>
                <div className="operationsSummaryMetric">
                  <span className="operationsSummaryLabel">设备</span>
                  <strong>{deviceLabel}</strong>
                </div>
                <div className="operationsSummaryMetric">
                  <span className="operationsSummaryLabel">状态</span>
                  <strong>{statusLabel}</strong>
                </div>
                <div className="operationsSummaryMetric">
                  <span className="operationsSummaryLabel">更新时间</span>
                  <strong><RelativeTime value={Number(x.last_event_ts || x.updated_ts_ms || 0)} /></strong>
                </div>
              </div>

              <details className="traceDetails">
                <summary>技术追踪编号</summary>
                <div className="traceGrid">
                  <span>建议编号：{String(x.recommendation_id || "-")}</span>
                  <span>审批编号：{String(x.approval_request_id || "-")}</span>
                  <span>作业计划编号：{planId || "-"}</span>
                  <span>执行任务编号：{String(x.task_id || "-")}</span>
                </div>
              </details>

              <div className="operationsSummaryActions">
                <Link className="btn" to={toOperationDetailPath(x)}>查看作业详情</Link>
                <CopyButton value={planId} label="复制作业计划编号" />
              </div>
            </article>
          );
        })}
        {!loading && !items.length ? <EmptyState title="当前没有待执行动作" description="建议稍后刷新查看最新计划状态" /> : null}
      </section>
    </div>
  );
}
