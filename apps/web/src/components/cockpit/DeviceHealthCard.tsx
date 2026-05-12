import React from "react";
import type { CustomerDashboardVm } from "../../viewmodels/customerDashboardVm";
import { CustomerEmptyState, type CustomerEmptyStateVm } from "../customer";

type Props = {
  summary: CustomerDashboardVm["deviceHealth"];
  emptyState: CustomerEmptyStateVm;
};

export default function DeviceHealthCard({ summary, emptyState }: Props): React.ReactElement {
  if (summary.empty) {
    return (
      <article className="customerCard">
        <h3 className="customerCardTitle">设备状态</h3>
        <CustomerEmptyState vm={emptyState} />
      </article>
    );
  }

  return (
    <article className="customerCard">
      <h3 className="customerCardTitle">设备状态</h3>
      <div className="customerMetricLabel">{summary.globalText}</div>
      <div className="customerMetricLabel">{summary.authorizedText}</div>
      <div className="customerMetricLabel">{summary.fieldText}</div>
      <div className="muted">{summary.scopeText}</div>
      <div className="muted">最近更新时间：{summary.updatedAtText ?? "暂无更新时间"}</div>
    </article>
  );
}
