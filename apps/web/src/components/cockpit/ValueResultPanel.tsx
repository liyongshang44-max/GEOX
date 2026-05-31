import React from "react";
import type { CustomerDashboardVm } from "../../viewmodels/customerDashboardVm";
import { customerProductText } from "../../lib/customerProductLanguage";
import { CustomerEmptyState, type CustomerEmptyStateVm } from "../customer";

type Props = {
  roi: CustomerDashboardVm["roiSummary"];
  emptyState: CustomerEmptyStateVm;
};

export default function ValueResultPanel({ roi, emptyState }: Props): React.ReactElement {
  if (!roi.totalRoiItems) {
    return (
      <article className="customerCard">
        <h3 className="customerCardTitle">价值记录</h3>
        <CustomerEmptyState vm={roi.emptyState ?? emptyState} />
        <p className="muted customerSpacingTopXs">缺少基线时不形成可信收益结论。</p>
      </article>
    );
  }

  return (
    <article className="customerCard">
      <h3 className="customerCardTitle">价值记录</h3>
      <div className="customerMetricLabel">价值记录数量：{roi.totalRoiItems}</div>
      <div className="muted customerSpacingTopXs">{customerProductText(roi.customerValueText)}</div>
      <div className="muted customerSpacingTopXs">{customerProductText(roi.scopeText)}</div>
      {roi.confidenceText ? <div className="muted customerSpacingTopXs">置信度提示：{customerProductText(roi.confidenceText)}</div> : null}
      {roi.assumptionText ? <div className="muted customerSpacingTopXs">假设条件：{customerProductText(roi.assumptionText)}</div> : null}
    </article>
  );
}
