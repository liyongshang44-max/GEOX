import React from "react";
import { Link } from "react-router-dom";
import { fetchOperationStates } from "../api";
import { StatusTag } from "../components/StatusTag";
import { RelativeTime } from "../components/RelativeTime";
import { CopyButton } from "../components/CopyButton";
import EmptyState from "../components/common/EmptyState";
import { resolveOperationPlanId, toOperationDetailPath } from "../lib/operationLink";

export default function OperationsPage(): React.ReactElement {
  const [items, setItems] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);

  const reload = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchOperationStates({ limit: 200 });
      const list = Array.isArray(res.items) ? res.items : [];
      const focused = list.filter((x) => ["READY", "DISPATCHED", "ACKED"].includes(String(x?.final_status || "").toUpperCase()) || Date.now() - Number(x?.last_event_ts || 0) > 2 * 3600 * 1000);
      setItems(focused);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { void reload(); }, [reload]);

  return (
    <div className="productPage">
      <section className="card sectionBlock">
        <div className="sectionHeader">
          <div><div className="sectionTitle">待执行动作</div><div className="muted">聚焦 READY / DISPATCHED / ACKED 与长时间未推进项</div></div>
          <button className="btn" onClick={() => void reload()} disabled={loading}>刷新</button>
        </div>
      </section>

      <section className="list modernList">
        {items.map((x) => (
          <article key={resolveOperationPlanId(x) || x.operation_id} className="infoCard">
            <div className="jobTitleRow"><div className="title">{String(x.action_type || "动作")}</div><StatusTag status={String(x.final_status || "UNKNOWN")} /></div>
            <div className="meta wrapMeta">
              <span>field_id：{String(x.field_id || "-")}</span>
              <span>device_id：{String(x.device_id || "-")}</span>
              <span>状态：{String(x.final_status || "-")}</span>
              <span>updated：<RelativeTime value={Number(x.last_event_ts || 0)} /></span>
              <span>recommendation_id：{String(x.recommendation_id || "-")}</span>
              <span>approval_request_id：{String(x.approval_request_id || "-")}</span>
              <span>operation_plan_id：{resolveOperationPlanId(x) || "-"}</span>
              <span>act_task_id：{String(x.task_id || "-")}</span>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
              <Link className="btn" to={toOperationDetailPath(x)}>查看作业详情</Link>
              <CopyButton value={resolveOperationPlanId(x)} label="复制 operation_plan_id" />
            </div>
          </article>
        ))}
        {!loading && !items.length ? <EmptyState title="当前没有待执行动作" description="建议稍后刷新查看最新计划状态" /> : null}
      </section>
    </div>
  );
}
