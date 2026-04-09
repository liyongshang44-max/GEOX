import React from "react";
import { Link } from "react-router-dom";
import { useOperationsListQuery } from "../../../features/operations/queries/useOperationsListQuery";
import { RelativeTime } from "../../../components/RelativeTime";
import EmptyState from "../../../components/common/EmptyState";
import { resolveOperationPlanId, toOperationDetailPath } from "../../../lib/operationLink";
import { buildOperationSummary, mapDeviceDisplayName, mapFieldDisplayName, mapOperationActionLabel, normalizeOperationFinalStatus, toBusinessExecutionNarrative } from "../../../lib/operationLabels";

type GroupKey = "TODO" | "PENDING_ACCEPTANCE" | "DONE_OR_EXCEPTION";

function normalizeStatus(item: any): string {
  return normalizeOperationFinalStatus(item?.final_status);
}

function groupOf(item: any): GroupKey {
  const status = normalizeStatus(item);
  if (status === "PENDING_ACCEPTANCE") return "PENDING_ACCEPTANCE";
  if (["SUCCESS", "INVALID_EXECUTION", "FAILED"].includes(status)) return "DONE_OR_EXCEPTION";
  return "TODO";
}

export default function OperationsPage(): React.ReactElement {
  const { data: items = [], isLoading: loading, refetch } = useOperationsListQuery();

  const reload = React.useCallback(async () => {
    await refetch();
  }, [refetch]);

  const grouped = React.useMemo(() => {
    const base: Record<GroupKey, any[]> = { TODO: [], PENDING_ACCEPTANCE: [], DONE_OR_EXCEPTION: [] };
    for (const item of items) base[groupOf(item)].push(item);
    for (const key of Object.keys(base) as GroupKey[]) {
      base[key].sort((a, b) => Number(b?.last_event_ts ?? b?.updated_ts_ms ?? 0) - Number(a?.last_event_ts ?? a?.updated_ts_ms ?? 0));
    }
    return base;
  }, [items]);

  const groupMeta: Array<{ key: GroupKey; title: string; lead: string }> = [
    { key: "TODO", title: "待执行", lead: "先确认条件，再下发任务。" },
    { key: "PENDING_ACCEPTANCE", title: "待验收", lead: "重点补证据、看约束、给结论。" },
    { key: "DONE_OR_EXCEPTION", title: "已完成 / 异常", lead: "用于复盘影响与审计留痕。" },
  ];

  return (
    <div className="productPage operationsPageV2">
      <section className="card sectionBlock operationsHeroCard">
        <div className="sectionHeader">
          <div>
            <div className="eyebrow">GEOX / 作业页收口</div>
            <h1 className="pageTitle">作业列表</h1>
            <div className="pageLead">页面聚焦“为什么执行、怎么执行、如何证明、产生什么影响”。</div>
          </div>
          <button className="btn" onClick={() => void reload()} disabled={loading}>刷新</button>
        </div>
      </section>

      {groupMeta.map((group) => (
        <section key={group.key} className="operationsGroupSection">
          <div className="operationsGroupHeader">
            <h2>{group.title}</h2>
            <span>{group.lead}（{grouped[group.key].length}）</span>
          </div>
          <div className="operationsCardGrid">
            {grouped[group.key].map((x) => {
              const normalized = normalizeStatus(x);
              const actionLabel = mapOperationActionLabel(x.action_type);
              const fieldLabel = mapFieldDisplayName(x.field_name, x.field_id);
              const deviceLabel = mapDeviceDisplayName(x.device_name, x.device_id);
              const planId = resolveOperationPlanId(x);
              return (
                <article key={planId || x.operation_id} className="card operationsSummaryCard">
                  <div className="operationsSummaryTop">
                    <div>
                      <div className="operationsSummaryTitle">{actionLabel}</div>
                      <div className="operationsSummaryLead">{buildOperationSummary(x.final_status, x.action_type)}</div>
                    </div>
                    <span className="statusTag tone-neutral">{group.title}</span>
                  </div>

                  <div className="operationsSummaryGrid">
                    <div className="operationsSummaryMetric"><span className="operationsSummaryLabel">田块</span><strong>{fieldLabel}</strong></div>
                    <div className="operationsSummaryMetric"><span className="operationsSummaryLabel">设备</span><strong>{deviceLabel}</strong></div>
                    <div className="operationsSummaryMetric"><span className="operationsSummaryLabel">业务状态</span><strong>{toBusinessExecutionNarrative(normalized)}</strong></div>
                    <div className="operationsSummaryMetric"><span className="operationsSummaryLabel">更新时间</span><strong><RelativeTime value={Number(x.last_event_ts || x.updated_ts_ms || 0)} /></strong></div>
                  </div>

                  <div className="operationsSummaryActions">
                    <Link className="btn" to={toOperationDetailPath(x)}>查看完整故事</Link>
                    {group.key === "TODO" ? <Link className="btn" to="/agronomy/recommendations">回到建议池</Link> : null}
                    {group.key === "PENDING_ACCEPTANCE" ? <Link className="btn" to={`/evidence?operation_plan_id=${encodeURIComponent(String(planId || ""))}`}>查看证据</Link> : null}
                  </div>
                </article>
              );
            })}
            {!loading && !grouped[group.key].length ? <EmptyState title={`${group.title}为空`} description="当前分组暂无作业。" actionText="返回总览" onAction={() => { window.location.assign("/dashboard"); }} /> : null}
          </div>
        </section>
      ))}
    </div>
  );
}
