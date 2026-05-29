import React from "react";
import { Link } from "react-router-dom";
import type { CustomerDashboardVm } from "../../viewmodels/customerDashboardVm";
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
              <div className="customerMetricLabel">状态：{item.stateText}</div>
              <div className="customerMetricLabel">验收状态：{item.acceptanceText}</div>
              <div className="customerMetricLabel">证据状态：{item.evidenceText}</div>
              <div className="customerMetricLabel">scenario_type：{item.scenarioTypeText}</div>
              <div className="customerMetricLabel">formal_chain_status：{item.formalChainStatusText}</div>
              <div className="customerMetricLabel">evidence_status：{item.evidenceStatusText}</div>
              <div className="customerMetricLabel">needs_review：{item.needsReviewText}</div>
              <div className="muted">更新时间：{item.updatedAtText}</div>
              {item.href ? <Link className="customerButton customerSpacingTopXs" to={item.href}>查看作业</Link> : null}
            </article>
          ))}
        </div>
      ) : <CustomerEmptyState vm={emptyState} />}
    </section>
  );
}
