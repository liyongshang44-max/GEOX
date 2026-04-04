import React from "react";
import { Link } from "react-router-dom";
import { fetchOperationStates } from "../api";
import { RelativeTime } from "../components/RelativeTime";
import { CopyButton } from "../components/CopyButton";
import EmptyState from "../components/common/EmptyState";
import { resolveOperationPlanId, toOperationDetailPath } from "../lib/operationLink";
import { buildOperationSummary, mapDeviceDisplayName, mapFieldDisplayName, mapOperationActionLabel } from "../lib/operationLabels";

type StatusFilter = "ALL" | "SUCCESS" | "INVALID_EXECUTION" | "PENDING";

function normalizeStatus(item: any): string {
  const status = String(item?.final_status || item?.status || "").toUpperCase();
  if (status === "INVALID_EXECUTION") return "INVALID_EXECUTION";
  if (["SUCCESS", "SUCCEEDED", "DONE", "EXECUTED"].includes(status)) return "SUCCESS";
  if (["PENDING", "READY", "DISPATCHED", "ACKED", "RUNNING", "PENDING_ACCEPTANCE"].includes(status)) return "PENDING";
  return status || "PENDING";
}

export default function OperationsPage(): React.ReactElement {
  const [items, setItems] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [filter, setFilter] = React.useState<StatusFilter>("ALL");

  const reload = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchOperationStates({ limit: 200 });
      const list = Array.isArray(res.items) ? res.items : [];
      setItems(list);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { void reload(); }, [reload]);

  const filteredItems = React.useMemo(() => {
    if (filter === "ALL") return items;
    return items.filter((item) => normalizeStatus(item) === filter);
  }, [filter, items]);

  const statusBadge = (status: string): { text: string; tone: string } => {
    if (status === "SUCCESS") return { text: "已完成", tone: "tone-success" };
    if (status === "INVALID_EXECUTION") return { text: "执行无效", tone: "tone-danger" };
    return { text: "待执行", tone: "tone-neutral" };
  };

  return (
    <div className="productPage operationsPageV2">
      <section className="card sectionBlock operationsHeroCard">
        <div className="sectionHeader">
          <div>
            <div className="eyebrow">GEOX / 远程农业控制平面</div>
            <div className="breadcrumbBar"><span className="breadcrumbCurrent">总览</span><span className="breadcrumbSep">/</span><span className="breadcrumbCurrent">待执行动作</span></div>
            <h1 className="pageTitle">待执行动作</h1>
            <div className="pageLead">支持 SUCCESS / INVALID_EXECUTION / PENDING 的状态识别与筛选。</div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn" onClick={() => void reload()} disabled={loading}>刷新</button>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
          {([
            ["ALL", "全部"],
            ["SUCCESS", "已完成"],
            ["INVALID_EXECUTION", "执行无效"],
            ["PENDING", "待执行"],
          ] as Array<[StatusFilter, string]>).map(([value, label]) => (
            <button key={value} className="btn" onClick={() => setFilter(value)} disabled={loading || filter === value}>{label}</button>
          ))}
        </div>
      </section>

      <section className="operationsCardGrid">
        {filteredItems.map((x) => {
          const actionLabel = mapOperationActionLabel(x.action_type);
          const normalized = normalizeStatus(x);
          const statusLabel = normalized === "SUCCESS" ? "已完成" : normalized === "INVALID_EXECUTION" ? "执行无效" : "待执行";
          const fieldLabel = mapFieldDisplayName(x.field_name, x.field_id);
          const deviceLabel = mapDeviceDisplayName(x.device_name, x.device_id);
          const planId = resolveOperationPlanId(x);
          const badge = statusBadge(normalized);
          const suggestionSource = String(x.skill_id || x.rule_id || "-");
          const reasonCodesLabel = Array.isArray(x.reason_codes) && x.reason_codes.length > 0 ? x.reason_codes.join(", ") : "-";
          return (
            <article key={planId || x.operation_id} className="card operationsSummaryCard">
              <div className="operationsSummaryTop">
                <div>
                  <div className="operationsSummaryTitle">{actionLabel}</div>
                  <div className="operationsSummaryLead">{buildOperationSummary(x.final_status || x.status, x.action_type)}</div>
                </div>
                <span className={`statusTag ${badge.tone}`}>{badge.text}</span>
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

              <div className="operationsSummaryGrid" style={{ marginTop: 8 }}>
                <div className="operationsSummaryMetric">
                  <span className="operationsSummaryLabel">建议来源</span>
                  <strong>{suggestionSource}</strong>
                </div>
                <div className="operationsSummaryMetric">
                  <span className="operationsSummaryLabel">原因</span>
                  <strong>{reasonCodesLabel}</strong>
                </div>
              </div>

              <div className="operationsSummaryActions">
                <Link className="btn" to={toOperationDetailPath(x)}>查看作业详情</Link>
                <CopyButton value={planId} label="复制作业计划编号" />
              </div>
            </article>
          );
        })}
        {!loading && !filteredItems.length ? <EmptyState title="当前没有匹配作业" description="请切换筛选条件或稍后刷新" /> : null}
      </section>
    </div>
  );
}
