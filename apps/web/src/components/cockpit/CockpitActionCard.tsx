import React from "react";
import { Link } from "react-router-dom";
import type { CustomerActionItemVm } from "../../viewmodels/customerDashboardVm";
import { customerProductText } from "../../lib/customerProductLanguage";

type Props = { item: CustomerActionItemVm };

export default function CockpitActionCard({ item }: Props): React.ReactElement {
  return (
    <article className="customerListItem customerStructuredCard">
      <div><strong>{customerProductText(item.title)}</strong></div>
      <dl>
        <div><dt>当前状态</dt><dd>{customerProductText(item.currentStatus)}</dd></div>
        <div><dt>为什么</dt><dd>{customerProductText(item.why)}</dd></div>
        <div><dt>下一步</dt><dd>{customerProductText(item.nextStep)}</dd></div>
        <div><dt>正式性提示</dt><dd>{customerProductText(item.formality)}</dd></div>
      </dl>
      <div className="muted">{customerProductText(item.summary)}</div>
      {item.primaryAction.href ? (
        <Link className="customerButton customerSpacingTopXs" to={item.primaryAction.href}>{customerProductText(item.primaryAction.label)}</Link>
      ) : (
        <div className="muted customerSpacingTopXs">{customerProductText(item.primaryAction.disabledReason)}</div>
      )}
    </article>
  );
}
