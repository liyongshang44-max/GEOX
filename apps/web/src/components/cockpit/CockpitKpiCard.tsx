import React from "react";
import { Link } from "react-router-dom";
import type { CustomerKpiVm } from "../../viewmodels/customerDashboardVm";

type Props = { item: CustomerKpiVm };

function text(value: unknown): string {
  if (value === null || value === undefined) return "--";
  const s = String(value).trim();
  return s && s !== "NaN" && s !== "undefined" && s !== "null" ? s : "--";
}

export default function CockpitKpiCard({ item }: Props): React.ReactElement {
  const label = text(item.label);
  const value = `${text(item.value)}${text(item.unit) === "--" ? "" : text(item.unit)}`;
  const source = text(item.sourceNote);
  const reason = item.disabledReason ? text(item.disabledReason) : "";

  const content = (
    <>
      <div className="customerMetricLabel">{label}</div>
      <div className="customerMetricValue">{value}</div>
      <div className="muted">{source}</div>
      {reason ? <div className="muted" title={reason}>说明：{reason}</div> : null}
    </>
  );

  if (item.href && !item.disabledReason) {
    return <Link className="customerMetricCard" to={item.href}>{content}</Link>;
  }
  return <article className="customerMetricCard">{content}</article>;
}
