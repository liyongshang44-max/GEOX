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
      <article id="device-health" className="customerCard deviceHealthCard customerStructuredCard">
        <h3 className="customerCardTitle">设备状态</h3>
        <CustomerEmptyState vm={emptyState} />
        <dl>
          <div><dt>当前状态</dt><dd>当前暂无可见授权设备摘要。</dd></div>
          <div><dt>为什么</dt><dd>未取得设备状态时，不能判断设备对地块状态和作业证据的影响。</dd></div>
          <div><dt>下一步</dt><dd>等待运营人员补齐设备状态，或先查看地块报告中的可用证据。</dd></div>
          <div><dt>正式性提示</dt><dd>设备状态未确认前，不展示执行成功、客户 ROI 或 Field Memory 结论。</dd></div>
        </dl>
      </article>
    );
  }

  const lines = [summary.authorizedText, summary.alertText, summary.scopeText].map((item) => customerProductText(item)).filter(Boolean);

  return (
    <article id="device-health" className="customerCard deviceHealthCard customerStructuredCard">
      <h3 className="customerCardTitle">设备状态</h3>
      <div className="deviceHealthNaturalText">
        {lines.map((line) => <p key={line}>{line}</p>)}
      </div>
      <dl>
        <div><dt>当前状态</dt><dd>{customerProductText(summary.offlineText)}</dd></div>
        <div><dt>为什么</dt><dd>{customerProductText(summary.whyText)}</dd></div>
        <div><dt>下一步</dt><dd>{customerProductText(summary.nextStepText)}</dd></div>
        <div><dt>正式性提示</dt><dd>{customerProductText(summary.formalityText)}</dd></div>
      </dl>
      <div className="muted deviceHealthUpdatedAt">最近更新时间：{summary.updatedAtText ?? "暂无更新时间"}</div>
    </article>
  );
}
