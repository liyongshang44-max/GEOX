import React from "react";
import { Link } from "react-router-dom";
import type { CustomerDashboardVm } from "../../viewmodels/customerDashboardVm";
import { customerProductText, customerReviewStateText } from "../../lib/customerProductLanguage";
import { CustomerEmptyState, type CustomerEmptyStateVm } from "../customer";

type Props = {
  items: CustomerDashboardVm["recentOperations"];
  emptyState: CustomerEmptyStateVm;
};

export default function RecentOperationsSection({ items, emptyState }: Props): React.ReactElement {
  return (
    <section id="recent-operations" className="customerCard customerStructuredCard">
      <h3 className="customerCardTitle">近期作业摘要</h3>
      <dl>
        <div><dt>当前状态</dt><dd>{items.length ? `最近展示 ${items.length} 条作业记录。` : "暂无近期作业记录。"}</dd></div>
        <div><dt>为什么</dt><dd>作业证据决定能否形成正式验收、客户报告和后续田块记忆。</dd></div>
        <div><dt>下一步</dt><dd>先查看证据状态和验收状态；证据不足时不要直接使用价值结论。</dd></div>
        <div><dt>正式性提示</dt><dd>证据不足、待验收或需要复核的作业，不能生成正式客户价值结论。</dd></div>
      </dl>
      {items.length ? (
        <div className="customerList">
          {items.map((item) => (
            <article key={item.operationId || item.href} className="customerListItem">
              <div><strong>{item.operationName} / {item.fieldName}</strong></div>
              <div className="customerMetricLabel">状态：{customerProductText(item.stateText)}</div>
              <div className="customerMetricLabel">验收状态：{customerProductText(item.acceptanceText)}</div>
              <div className="customerMetricLabel">证据状态：{customerProductText(item.evidenceText)}</div>
              <div className="customerMetricLabel">正式链路：{customerProductText(item.scenarioSummaryText, "正式链路状态待确认")}</div>
              <div className="customerMetricLabel">复核状态：{customerReviewStateText(item.needsReviewText)}</div>
              <div className="muted">更新时间：{item.updatedAtText}</div>
              {item.href ? <Link className="customerButton customerSpacingTopXs" to={item.href}>查看作业证据</Link> : null}
            </article>
          ))}
        </div>
      ) : <CustomerEmptyState vm={emptyState} />}
    </section>
  );
}
