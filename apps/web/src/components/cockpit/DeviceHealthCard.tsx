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
      <article className="customerCard deviceHealthCard">
        <h3 className="customerCardTitle">设备状态</h3>
        <CustomerEmptyState vm={emptyState} />
      </article>
    );
  }

  const lines = [summary.authorizedText, summary.alertText, summary.scopeText].map((item) => customerProductText(item)).filter(Boolean);

  return (
    <article className="customerCard deviceHealthCard">
      <h3 className="customerCardTitle">设备状态</h3>
      <div className="deviceHealthNaturalText">
        {lines.map((line) => <p key={line}>{line}</p>)}
      </div>
      <div className="muted deviceHealthUpdatedAt">最近更新时间：{summary.updatedAtText ?? "暂无更新时间"}</div>
    </article>
  );
}
