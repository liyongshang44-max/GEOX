import React from "react";
import { Link } from "react-router-dom";
import type { CustomerDashboardVm } from "../../viewmodels/customerDashboardVm";

type Props = { items: CustomerDashboardVm["recentOperations"] };

export default function RecentOperationsSection({ items }: Props): React.ReactElement {
  return (
    <section className="customerCard">
      <h3 className="customerCardTitle">近期作业摘要</h3>
      <div className="customerList">
        {items.map((item) => (
          <article key={item.operationId || item.href} className="customerListItem">
            <div><strong>{item.operationName} / {item.fieldName}</strong></div>
            <div className="customerMetricLabel">状态：{item.stateText}</div>
            <div className="customerMetricLabel">验收状态：{item.acceptanceText}</div>
            <div className="customerMetricLabel">证据状态：{item.evidenceText}</div>
            <div className="muted">更新时间：{item.updatedAtText}</div>
            {item.operationId ? <Link className="customerButton customerSpacingTopXs" to={`/customer/operations/${encodeURIComponent(item.operationId)}`}>查看作业</Link> : <div className="muted customerSpacingTopXs">暂无可跳转作业</div>}
          </article>
        ))}
        {!items.length ? <div className="muted">暂无近期作业</div> : null}
      </div>
    </section>
  );
}
