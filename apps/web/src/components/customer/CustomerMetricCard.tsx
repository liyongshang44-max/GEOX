import React from "react";

export type CustomerMetricCardVm = {
  label: string;
  value: string;
  helperText?: string;
  trendText?: string;
};

export default function CustomerMetricCard({ vm }: { vm: CustomerMetricCardVm }): React.ReactElement {
  return (
    <article className="customerMetricCard">
      <div className="customerMetricValue">{vm.value}</div>
      <div className="customerMetricLabel">{vm.label}</div>
      {vm.trendText ? <div className="customerMetricLabel">{vm.trendText}</div> : null}
      {vm.helperText ? <div className="customerMetricLabel">{vm.helperText}</div> : null}
    </article>
  );
}
