import React from "react";
import { Link } from "react-router-dom";
import type { CustomerRiskFieldVm } from "../../viewmodels/customerDashboardVm";
import { CustomerEmptyState, type CustomerEmptyStateVm } from "../customer";

type Props = {
  fields: CustomerRiskFieldVm[];
  emptyState: CustomerEmptyStateVm;
  mode?: "LIST" | "MATRIX";
};

function fieldKey(field: CustomerRiskFieldVm): string {
  return field.fieldId || field.href || field.fieldName;
}

function toneClass(tone: CustomerRiskFieldVm["riskTone"]): string {
  if (tone === "danger") return "isDanger";
  if (tone === "warning") return "isWarning";
  return "isNeutral";
}

function RiskTile({ field }: { field: CustomerRiskFieldVm }): React.ReactElement {
  const className = `cockpitRiskTile ${toneClass(field.riskTone)}`;
  const content = (
    <>
      <strong>{field.fieldName}</strong>
      <span>{field.riskLabel}</span>
      <small>{field.reasons[0] || "暂无风险原因"}</small>
      <em>{field.fieldId ? "查看地块" : "暂无入口"}</em>
    </>
  );

  if (field.fieldId) {
    return <Link className={className} to={`/customer/fields/${encodeURIComponent(field.fieldId)}`}>{content}</Link>;
  }

  return <span className={`${className} isDisabled`}>{content}</span>;
}

export default function CockpitFieldRiskPanel({ fields, emptyState, mode = "LIST" }: Props): React.ReactElement {
  const visibleFields = fields.slice(0, 6);

  return (
    <article id="top-risk-fields" className="customerCard cockpitRiskPanel">
      <div className="customerCardHeaderRow">
        <div>
          <h3 className="customerCardTitle">地块风险分布面板</h3>
          <p className="customerMetricLabel">P0 非真实地图；无 geometry 时以风险矩阵承载地块入口。</p>
        </div>
        <span className="customerPill">P0</span>
      </div>
      {visibleFields.length ? (
        <>
          {mode === "MATRIX" ? (
            <div className="cockpitRiskMatrix" aria-label="地块风险矩阵">
              {visibleFields.map((field) => <RiskTile key={fieldKey(field)} field={field} />)}
            </div>
          ) : null}
          <div className="customerList cockpitRiskList">
            {fields.map((field) => (
              <Link key={fieldKey(field)} className="cockpitRiskListItem" to={field.fieldId ? `/customer/fields/${encodeURIComponent(field.fieldId)}` : "/customer/dashboard"}>
                <strong>{field.fieldName}</strong>
                <span>{field.riskLabel}</span>
                <small>{field.reasons.join("；") || "暂无风险原因"}</small>
              </Link>
            ))}
          </div>
        </>
      ) : <CustomerEmptyState vm={emptyState} />}
    </article>
  );
}
