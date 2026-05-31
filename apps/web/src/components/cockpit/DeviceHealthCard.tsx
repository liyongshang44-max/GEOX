import React from "react";
import type { CustomerDashboardVm } from "../../viewmodels/customerDashboardVm";
import { customerProductText } from "../../lib/customerProductLanguage";
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
      <div className="customerMetricLabel">{customerProductText(summary.globalText)}</div>
      <div className="customerMetricLabel">{customerProductText(summary.authorizedText)}</div>
      <div className="customerMetricLabel">{customerProductText(summary.fieldText)}</div>
      <div className="customerMetricLabel">{customerProductText(summary.offlineText)}</div>
      <div className="customerMetricLabel">{customerProductText(summary.alertText)}</div>
      <div className="muted">{customerProductText(summary.scopeText)}</div>
      <div className="muted">最近更新时间：{summary.updatedAtText ?? "暂无更新时间"}</div>
    </article>
  );
}
