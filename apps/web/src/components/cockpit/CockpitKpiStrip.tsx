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

  return (
    <section className="customerCard">
      <h3 className="customerReportSectionTitle">经营状态摘要</h3>
      {visibleItems.length ? (
        <div className="customerMetrics">
          {visibleItems.map((item) => <CockpitKpiCard key={item.key} item={item} />)}
        </div>
      ) : <CustomerEmptyState vm={emptyState} />}
    </section>
  );
}
