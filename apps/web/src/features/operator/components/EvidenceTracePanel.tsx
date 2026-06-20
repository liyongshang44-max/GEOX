import React from "react";
import type { OperatorEvidenceTraceItem } from "../../../api/operatorTwin";

export default function EvidenceTracePanel({ items }: { items: OperatorEvidenceTraceItem[] }): React.ReactElement {
  return (
    <article className="operatorPanel" data-card="EvidenceTracePanel">
      <p className="operatorEyebrow">evidence_trace_v1</p>
      <h3>Evidence Trace</h3>
      <ul className="operatorList">
        {items.map((item) => (
          <li key={item.source_table}>
            <strong>{item.stage}</strong> · {item.label} · {item.available ? "available" : "missing"} · {item.source_table}
            <br />evidence_refs: {item.evidence_refs.join(", ") || "none"}
            <br />quality_flags: {item.quality_flags.join(", ") || "none"}
          </li>
        ))}
      </ul>
    </article>
  );
}
