import React from "react";
import { Link } from "react-router-dom";
import type { CustomerRiskFieldVm } from "../../viewmodels/customerDashboardVm";

type Props = {
  fields: CustomerRiskFieldVm[];
  mode?: "LIST" | "MATRIX";
};

function toneColor(tone: CustomerRiskFieldVm["riskTone"]): string {
  if (tone === "danger") return "#ef4444";
  if (tone === "warning") return "#f59e0b";
  return "#9ca3af";
}

function Matrix({ fields }: { fields: CustomerRiskFieldVm[] }): React.ReactElement {
  return (
    <svg viewBox="0 0 300 120" role="img" aria-label="风险状态矩阵" className="customerSpacingTopSm">
      {fields.slice(0, 6).map((field, idx) => {
        const x = 10 + (idx % 3) * 95;
        const y = 10 + Math.floor(idx / 3) * 50;
        return <rect key={field.fieldId || `${field.fieldName}-${idx}`} x={x} y={y} width="85" height="36" rx="6" fill={toneColor(field.riskTone)} opacity="0.8" />;
      })}
    </svg>
  );
}

export default function CockpitFieldRiskPanel({ fields, mode = "LIST" }: Props): React.ReactElement {
  return (
    <article className="customerCard">
      <h3 className="customerCardTitle">地块风险分布</h3>
      {mode === "MATRIX" ? <Matrix fields={fields} /> : null}
      <ul className="customerList">
        {fields.map((field) => (
          <li key={field.fieldId || field.fieldName} className="customerListItem">
            {field.fieldId ? <Link to={`/customer/fields/${encodeURIComponent(field.fieldId)}`}>{field.fieldName}</Link> : <span>{field.fieldName}</span>}
            <div className="customerPill customerSpacingTopXs">{field.riskLabel}</div>
            <div className="muted">{field.reasons.join("；") || "暂无风险原因"}</div>
          </li>
        ))}
        {!fields.length ? <li className="muted">暂无风险地块数据</li> : null}
      </ul>
    </article>
  );
}
