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
  const hint = text(item.customerHint ?? "") === "--" ? "" : text(item.customerHint ?? "");

  const content = (
    <>
      <div className="customerMetricLabel">{label}</div>
      <div className="customerMetricValue">{value}</div>
      {hint ? <div className="muted">{hint}</div> : null}
    </>
  );

  if (item.href && !item.disabledReason) {
    return <Link className="customerMetricCard" to={item.href} title={item.sourceNote} data-source-note={item.sourceNote}>{content}</Link>;
  }
  return <article className="customerMetricCard" title={item.sourceNote} data-source-note={item.sourceNote}>{content}</article>;
}
