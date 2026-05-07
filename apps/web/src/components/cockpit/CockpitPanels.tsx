import React from "react";

export function ValueResultPanel({ valueText, roiItems }: { valueText: string; roiItems: number }): React.ReactElement {
  return <article className="customerCard"><h3 className="customerCardTitle">价值结果</h3><div className="customerMetricLabel">价值记录 {roiItems} 条</div><div className="muted customerSpacingTopXs">{valueText}</div></article>;
}
