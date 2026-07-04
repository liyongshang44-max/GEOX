// apps/web/src/features/operator/fieldRuntime/FieldRuntimeEvidenceTracePanel.tsx
// Purpose: render Field Runtime Evidence Trace rows from the read-only evidence quality ViewModel.
// Boundary: quality flags are metadata only and do not create observation requests or action recommendations.

import React from "react";
import { type FieldRuntimeEvidenceViewModel } from "./fieldRuntimeEvidenceAdapter";

type FieldRuntimeEvidenceTracePanelProps = {
  evidence: FieldRuntimeEvidenceViewModel;
};

export default function FieldRuntimeEvidenceTracePanel({ evidence }: FieldRuntimeEvidenceTracePanelProps): React.ReactElement {
  return (
    <article className="operatorFieldRuntime__panel operatorFieldRuntime__evidenceTrace" data-h60e-panel="evidence-trace">
      <div className="operatorFieldRuntime__panelHeader">
        <div>
          <p className="operatorFieldRuntime__eyebrow">Evidence Trace</p>
          <h2 className="operatorFieldRuntime__panelTitle">Evidence Trace</h2>
        </div>
        <span className="operatorFieldRuntime__panelMeta">{evidence.traceItems.length} trace items</span>
      </div>
      <p className="operatorFieldRuntime__stubLead">Source table is detail metadata. Quality flags are evidence metadata, not action advice.</p>
      <div className="operatorFieldRuntime__evidenceTraceList">
        {evidence.traceItems.map((item, index) => (
          <section className="operatorFieldRuntime__evidenceTraceItem" key={item.stage + item.label + String(index)}>
            <div>
              <p className="operatorFieldRuntime__panelMeta">{item.stage}</p>
              <strong>{item.label}</strong>
            </div>
            <dl className="operatorFieldRuntime__evidenceDetailList">
              <div><dt>Available</dt><dd>{item.available ? "available" : "not available"}</dd></div>
              <div><dt>Source table</dt><dd>{item.sourceTable}</dd></div>
              <div><dt>Latest timestamp</dt><dd>{item.latestTsText}</dd></div>
              <div><dt>Quality flags</dt><dd>{item.qualityFlags.join(", ") || "none"}</dd></div>
            </dl>
            <details className="operatorFieldRuntime__evidenceRefs">
              <summary>{item.evidenceRefs.length} evidence refs</summary>
              <ul>{item.evidenceRefs.map((ref) => <li key={ref}>{ref}</li>)}</ul>
            </details>
          </section>
        ))}
      </div>
    </article>
  );
}
