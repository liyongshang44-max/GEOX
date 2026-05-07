import React from "react";
import type { CustomerActionItemVm } from "../../viewmodels/customerDashboardVm";
import { CustomerEmptyState, type CustomerEmptyStateVm } from "../customer";
import CockpitActionCard from "./CockpitActionCard";

type Props = {
  items: CustomerActionItemVm[];
  emptyState: CustomerEmptyStateVm;
};

export default function CockpitActionList({ items, emptyState }: Props): React.ReactElement {
  const visibleItems = items.slice(0, 5);

  return (
    <article className="customerCard">
      <h3 className="customerCardTitle">今日建议与待处理事项</h3>
      {visibleItems.length ? (
        <div className="customerList">
          {visibleItems.map((item) => <CockpitActionCard key={item.id} item={item} />)}
        </div>
      ) : <CustomerEmptyState vm={emptyState} />}
    </article>
  );
}
