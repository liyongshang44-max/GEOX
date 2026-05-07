import React from "react";
import { CustomerEmptyState, CustomerMetricCard, type CustomerEmptyStateVm, type CustomerMetricCardVm } from "../customer";

export type ExecutionAcceptanceSummaryVm = {
  title: string;
  subtitle?: string;
  metrics: Array<CustomerMetricCardVm & { key: string }>;
  emptyState: CustomerEmptyStateVm;
};

export default function ExecutionAcceptanceSummary({ vm }: { vm: ExecutionAcceptanceSummaryVm }): React.ReactElement {
  return (
    <section className="customerCard">
      <h3 className="customerCardTitle">{vm.title}</h3>
      {vm.subtitle ? <p className="customerMetricLabel">{vm.subtitle}</p> : null}
      {vm.metrics.length ? (
        <div className="customerMetrics customerSpacingTopSm">
          {vm.metrics.map((metric) => <CustomerMetricCard key={metric.key} vm={metric} />)}
        </div>
      ) : <CustomerEmptyState vm={vm.emptyState} />}
    </section>
  );
}
