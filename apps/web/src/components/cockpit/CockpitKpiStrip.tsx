import React from "react";
import type { CustomerKpiVm } from "../../viewmodels/customerDashboardVm";
import CockpitKpiCard from "./CockpitKpiCard";

type Props = {
  items: CustomerKpiVm[];
};

export default function CockpitKpiStrip({ items }: Props): React.ReactElement {
  return (
    <section className="customerCard">
      <h3 className="customerReportSectionTitle">KpiStrip</h3>
      <div className="customerMetrics">
        {items.slice(0, 5).map((item) => <CockpitKpiCard key={item.key} item={item} />)}
      </div>
    </section>
  );
}
