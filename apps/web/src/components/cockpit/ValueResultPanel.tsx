import React from "react";
import type { CustomerDashboardVm } from "../../viewmodels/customerDashboardVm";

type Props = {
  roi: CustomerDashboardVm["roiSummary"];
};

export default function ValueResultPanel({ roi }: Props): React.ReactElement {
  if (!roi.totalRoiItems) {
    return <article className="customerCard"><h3 className="customerCardTitle">价值摘要</h3><div className="muted">{roi.emptyState?.title ?? "暂无可量化价值记录"}</div></article>;
  }

  return (
    <article className="customerCard">
      <h3 className="customerCardTitle">价值摘要</h3>
      <div className="customerMetricLabel">价值记录数量：{roi.totalRoiItems}</div>
      <div className="muted customerSpacingTopXs">可量化价值摘要：{roi.customerValueText || "暂无收益摘要"}</div>
      {roi.confidenceText ? <div className="muted customerSpacingTopXs">置信度提示：{roi.confidenceText}</div> : null}
      {roi.assumptionText ? <div className="muted customerSpacingTopXs">假设条件：{roi.assumptionText}</div> : null}
    </article>
  );
}
