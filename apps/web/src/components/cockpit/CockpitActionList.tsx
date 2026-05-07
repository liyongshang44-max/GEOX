import React from "react";
import type { CustomerActionItemVm } from "../../viewmodels/customerDashboardVm";
import CockpitActionCard from "./CockpitActionCard";

export default function CockpitActionList({ items }: { items: CustomerActionItemVm[] }): React.ReactElement {
  return (
    <article className="customerCard">
      <h3 className="customerCardTitle">今日建议与待处理事项</h3>
      <div className="customerList">
        {items.slice(0, 5).map((item) => <CockpitActionCard key={item.id} item={item} />)}
      </div>
    </article>
  );
}
