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
    <section id="recent-operations" className="customerCard">
      <h3 className="customerCardTitle">近期作业摘要</h3>
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
              {item.href ? <Link className="customerButton customerSpacingTopXs" to={item.href}>查看作业</Link> : null}
            </article>
          ))}
        </div>
      ) : <CustomerEmptyState vm={emptyState} />}
    </section>
  );
}
