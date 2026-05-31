import React from "react";
import { Link } from "react-router-dom";
import type { CustomerActionItemVm } from "../../viewmodels/customerDashboardVm";
import { customerProductText } from "../../lib/customerProductLanguage";

type Props = { item: CustomerActionItemVm };

export default function CockpitActionCard({ item }: Props): React.ReactElement {
  return (
    <article className="customerListItem">
      <div><strong>{customerProductText(item.title)}</strong></div>
      <div className="muted">{customerProductText(item.summary)}</div>
      {item.primaryAction.href ? (
        <Link className="customerButton customerSpacingTopXs" to={item.primaryAction.href}>{customerProductText(item.primaryAction.label)}</Link>
      ) : (
        <div className="muted customerSpacingTopXs">{customerProductText(item.primaryAction.disabledReason)}</div>
      )}
    </article>
  );
}
