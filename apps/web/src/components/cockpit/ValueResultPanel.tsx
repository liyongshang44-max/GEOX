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
      <article className="customerCard customerStructuredCard">
        <h3 className="customerCardTitle">价值记录</h3>
        <CustomerEmptyState vm={roi.emptyState ?? emptyState} />
        <dl>
          <div><dt>当前状态</dt><dd>{customerProductText(roi.currentStatus)}</dd></div>
          <div><dt>为什么</dt><dd>{customerProductText(roi.whyText)}</dd></div>
          <div><dt>下一步</dt><dd>{customerProductText(roi.nextStepText)}</dd></div>
          <div><dt>正式性提示</dt><dd>{customerProductText(roi.formalityText)}</dd></div>
        </dl>
      </article>
    );
  }

  return (
    <article className="customerCard customerStructuredCard">
      <h3 className="customerCardTitle">价值记录</h3>
      <div className="customerMetricLabel">价值记录数量：{roi.totalRoiItems}</div>
      <dl>
        <div><dt>当前状态</dt><dd>{customerProductText(roi.currentStatus)}</dd></div>
        <div><dt>为什么</dt><dd>{customerProductText(roi.whyText)}</dd></div>
        <div><dt>下一步</dt><dd>{customerProductText(roi.nextStepText)}</dd></div>
        <div><dt>正式性提示</dt><dd>{customerProductText(roi.formalityText)}</dd></div>
      </dl>
      <div className="muted customerSpacingTopXs">{customerProductText(roi.customerValueText)}</div>
      <div className="muted customerSpacingTopXs">{customerProductText(roi.scopeText)}</div>
      {roi.confidenceText ? <div className="muted customerSpacingTopXs">置信度提示：{customerProductText(roi.confidenceText)}</div> : null}
      {roi.assumptionText ? <div className="muted customerSpacingTopXs">假设条件：{customerProductText(roi.assumptionText)}</div> : null}
    </article>
  );
}
