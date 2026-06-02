import React from "react";
import { Link } from "react-router-dom";
import type { CustomerRiskFieldVm } from "../../viewmodels/customerDashboardVm";
import { customerProductText } from "../../lib/customerProductLanguage";
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

function boundarySummary(fields: CustomerRiskFieldVm[]): string {
  const boundaryCount = fields.filter((field) => field.boundaryAvailable).length;
  if (!fields.length) return "地块边界：暂未接入。当前没有需要重点关注的风险地块。";
  if (boundaryCount > 0) return `地块边界：已接入。当前可见 ${boundaryCount} 块风险地块已接入边界。`;
  return "地块边界：暂未接入。当前风险地块暂未返回边界信息。";
}

function RiskTile({ field }: { field: CustomerRiskFieldVm }): React.ReactElement {
  const className = `cockpitRiskTile ${toneClass(field.riskTone)}`;
  const content = (
    <>
      <strong>{field.fieldName}</strong>
      <span>{field.riskLabel}</span>
      <small>{customerProductText(field.reasons[0] || "暂无风险原因")}</small>
      <small>{customerProductText(field.boundaryText)}</small>
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
          <h3 className="customerCardTitle">地块风险分布</h3>
          <p className="customerMetricLabel">{boundarySummary(fields)}</p>
        </div>
        <span className="customerPill">当前授权地块</span>
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
                <small>{field.secondaryText}</small>
                <small>{customerProductText(field.boundaryText)}</small>
                <small>{field.reasons.map((reason) => customerProductText(reason)).join("；") || "暂无风险原因"}</small>
              </Link>
            ))}
          </div>
        </>
      ) : <CustomerEmptyState vm={emptyState} />}
    </article>
  );
}
