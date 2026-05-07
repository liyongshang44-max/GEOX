import React from "react";
import { Link } from "react-router-dom";
import type { CustomerActionItemVm } from "../../viewmodels/customerDashboardVm";

type Props = { item: CustomerActionItemVm };

export default function CockpitActionCard({ item }: Props): React.ReactElement {
  return (
    <article className="customerListItem">
      <div><strong>{item.title}</strong></div>
      <div className="muted">{item.summary}</div>
      {item.primaryAction.href ? (
        <Link className="customerButton customerSpacingTopXs" to={item.primaryAction.href}>{item.primaryAction.label}</Link>
      ) : (
        <div className="muted customerSpacingTopXs">{item.primaryAction.disabledReason}</div>
      )}
    </article>
  );
}
