import React from "react";
import type { SlaSummary } from "../../../api/dashboard";
import SectionCard from "./SectionCard";

export default function OverviewMetrics({
  expert,
  sla,
  totalRevenue,
  fieldCount,
  riskFieldCount,
  todayExecutionCount,
}: {
  expert: boolean;
  sla: SlaSummary;
  totalRevenue: number;
  fieldCount: number;
  riskFieldCount: number;
  todayExecutionCount: number;
}): React.ReactElement {
  return (
    <SectionCard title="OverviewMetrics" subtitle="核心经营指标总览。">
      <div className="operationsSummaryGrid dashboardSectionMetricGrid">
        {expert ? (
          <article className="operationsSummaryMetric">
            <span className="operationsSummaryLabel">模式</span>
            <strong>研发模式</strong>
          </article>
        ) : null}
        <article className="operationsSummaryMetric">
          <span className="operationsSummaryLabel">作业成功率</span>
          <strong>{Math.round((sla.success_rate || 0) * 100)}%</strong>
        </article>
        <article className="operationsSummaryMetric">
          <span className="operationsSummaryLabel">无效执行率</span>
          <strong>{Math.round((sla.invalid_execution_rate || 0) * 100)}%</strong>
        </article>
        <article className="operationsSummaryMetric">
          <span className="operationsSummaryLabel">风险田块</span>
          <strong>{riskFieldCount} / {fieldCount}</strong>
        </article>
        <article className="operationsSummaryMetric">
          <span className="operationsSummaryLabel">今日执行</span>
          <strong>{todayExecutionCount} 次</strong>
        </article>
        <article className="operationsSummaryMetric">
          <span className="operationsSummaryLabel">累计费用</span>
          <strong>¥{totalRevenue.toFixed(2)}</strong>
        </article>
      </div>
    </SectionCard>
  );
}
