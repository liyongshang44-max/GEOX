import React from "react";
import { Link } from "react-router-dom";
import type { CustomerActionItemVm } from "../../viewmodels/customerDashboardVm";

type Props = { item: CustomerActionItemVm };

const ACTION_LABEL_BY_SOURCE: Record<CustomerActionItemVm["source"], string> = {
  RECOMMENDATION: "查看建议",
  APPROVAL_REQUIRED: "查看详情",
  PENDING_ACCEPTANCE: "查看作业",
  DEVICE_OFFLINE: "查看详情",
  EVIDENCE_MISSING: "查看证据",
  INVALID_EXECUTION: "查看异常",
  GENERAL: "查看详情",
};

function isCustomerRoute(href?: string): boolean {
  return Boolean(href && href.startsWith("/customer/"));
}

export default function CockpitActionCard({ item }: Props): React.ReactElement {
  const label = item.primaryAction.label || ACTION_LABEL_BY_SOURCE[item.source] || "查看详情";
  const canJump = isCustomerRoute(item.primaryAction.href);
  return (
    <article className="customerListItem">
      <div><strong>{item.title}</strong></div>
      <div className="muted">{item.summary}</div>
      {canJump ? (
        <Link className="customerButton customerSpacingTopXs" to={item.primaryAction.href!}>{label}</Link>
      ) : (
        <div className="muted customerSpacingTopXs">{item.primaryAction.disabledReason ?? "暂无可跳转的客户页面"}</div>
      )}
    </article>
  );
}
