import React from "react";
import type { CustomerKpiVm } from "../../viewmodels/customerDashboardVm";
import { CustomerEmptyState, type CustomerEmptyStateVm } from "../customer";
import CockpitKpiCard from "./CockpitKpiCard";

type Props = {
  items: CustomerKpiVm[];
  emptyState: CustomerEmptyStateVm;
};

export default function CockpitKpiStrip({ items, emptyState }: Props): React.ReactElement {
  const visibleItems = items.slice(0, 5);

  if (!visibleItems.length) {
    return (
      <section className="customerDashboardKpiEmpty customerCard">
        <CustomerEmptyState vm={emptyState} />
      </section>
    );
  }

  return (
    <section className="customerDashboardKpiRow" aria-label="经营状态摘要">
      {visibleItems.map((item) => <CockpitKpiCard key={item.key} item={item} />)}
    </section>
  );
}
