import React from "react";
import type { OperatorLowQualityReason, OperatorTwinGap } from "../../../api/operatorTwin";

export default function LowQualityReasonList({ reasons, gaps }: { reasons: OperatorLowQualityReason[]; gaps: OperatorTwinGap[] }): React.ReactElement {
  return (
    <article className="operatorPanel" data-card="LowQualityReasonList">
      <h3>Data Gaps</h3>
      <ul className="operatorList">
        {reasons.map((reason) => <li key={reason.source_table}>{reason.source_table}：{reason.reason} · evidence_refs: {reason.evidence_refs.join(", ") || "none"}</li>)}
        {gaps.map((gap) => <li key={gap.gap_code}>{gap.severity} · {gap.label} · missing reason: {gap.gap_code}</li>)}
      </ul>
    </article>
  );
}
