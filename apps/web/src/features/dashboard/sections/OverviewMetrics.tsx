import React from "react";
import { Link } from "react-router-dom";
import type { SlaSummary } from "../../../api/dashboard";
import { SectionCard } from "../../../shared/ui";

export default function OverviewMetrics({
  expert,
  sla,
  totalRevenue,
  fieldCount,
  riskFieldCount,
  todayExecutionCount,
  overviewMockData,
}: {
  expert: boolean;
  sla: SlaSummary;
  totalRevenue: number;
  fieldCount: number;
  riskFieldCount: number;
  todayExecutionCount: number;
  overviewMockData: {
    field_total: number;
    device_online: number;
    device_offline: number;
    pending_today: number;
    anomalies_24h: number;
    executing_ops: number;
  };
}): React.ReactElement {
  const cards = [
    { label: "田块总数", value: `${overviewMockData.field_total}`, to: "/fields?from=dashboard_overview" },
    { label: "设备在线/离线", value: `${overviewMockData.device_online} / ${overviewMockData.device_offline}`, to: "/devices?from=dashboard_overview" },
    { label: "今日待处理", value: `${overviewMockData.pending_today} 项`, to: "/operations?status=pending&from=dashboard_overview" },
    { label: "24h 异常", value: `${overviewMockData.anomalies_24h} 项`, to: "/operations?status=invalid_execution&from=dashboard_overview" },
    { label: "执行中作业", value: `${overviewMockData.executing_ops} 项`, to: "/operations?status=running&from=dashboard_overview" },
    { label: "风险田块", value: `${riskFieldCount} / ${fieldCount}`, to: "/fields?status=risk&from=dashboard_overview" },
    { label: "今日执行", value: `${todayExecutionCount} 次`, to: "/operations?from=dashboard_overview" },
    { label: "累计费用", value: `¥${totalRevenue.toFixed(2)}`, to: "/operations?tab=billing&from=dashboard_overview" },
  ];

  return (
    <SectionCard title="OverviewMetrics" subtitle="顶部总览（假数据结构已对齐：field_total/device_online-offline/pending_today/anomalies_24h/executing_ops）。">
      <div className="operationsSummaryGrid dashboardSectionMetricGrid">
        {expert ? (
          <Link className="operationsSummaryMetric" to="/settings?tab=mode">
            <span className="operationsSummaryLabel">模式</span>
            <strong>研发模式</strong>
          </Link>
        ) : null}
        {cards.map((card) => (
          <Link key={card.label} className="operationsSummaryMetric" to={card.to}>
            <span className="operationsSummaryLabel">{card.label}</span>
            <strong>{card.value}</strong>
          </Link>
        ))}
        <Link className="operationsSummaryMetric" to="/operations?metric=success_rate&from=dashboard_overview">
          <span className="operationsSummaryLabel">作业成功率</span>
          <strong>{Math.round((sla.success_rate || 0) * 100)}%</strong>
        </Link>
        <Link className="operationsSummaryMetric" to="/operations?metric=invalid_rate&from=dashboard_overview">
          <span className="operationsSummaryLabel">无效执行率</span>
          <strong>{Math.round((sla.invalid_execution_rate || 0) * 100)}%</strong>
        </Link>
      </div>
    </SectionCard>
  );
}
