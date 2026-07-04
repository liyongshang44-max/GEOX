// apps/web/src/features/operator/fieldRuntime/FieldRuntimeEvidenceCoveragePanel.tsx
// Purpose: render Field Runtime Data Coverage Matrix rows from the read-only evidence quality ViewModel.
// Boundary: coverage is evidence coverage status, not live monitoring or production outage status.

import React from "react";
import { type FieldRuntimeEvidenceViewModel } from "./fieldRuntimeEvidenceAdapter";

type FieldRuntimeEvidenceCoveragePanelProps = {
  evidence: FieldRuntimeEvidenceViewModel;
};

export default function FieldRuntimeEvidenceCoveragePanel({ evidence }: FieldRuntimeEvidenceCoveragePanelProps): React.ReactElement {
  return (
    <article className="operatorFieldRuntime__panel" data-h60e-panel="evidence-coverage">
      <div className="operatorFieldRuntime__panelHeader">
        <div>
          <p className="operatorFieldRuntime__eyebrow">Data Coverage</p>
          <h2 className="operatorFieldRuntime__panelTitle">Data Coverage</h2>
        </div>
        <span className="operatorFieldRuntime__panelMeta">Coverage is evidence coverage status, not live monitoring.</span>
      </div>
      <div className="operatorFieldRuntime__coverageTable" role="table" aria-label="Field Runtime evidence coverage matrix">
        <div className="operatorFieldRuntime__tableHeader" role="row"><span>Metric</span><span>Available</span><span>Rows</span><span>Latest timestamp</span><span>Refs</span></div>
        {evidence.coverageRows.map((row) => (
          <div className="operatorFieldRuntime__tableRow" role="row" key={row.metric + row.sourceTable}>
            <span><strong>{row.metric}</strong><small>{row.sourceTable}</small></span>
            <span>{row.available ? "available" : "limited"}</span>
            <span>{row.rowCount}</span>
            <span>{row.latestTsText}</span>
            <span>{row.evidenceRefCount}</span>
            <small className="operatorFieldRuntime__tableNote">{row.gapNotes.join(", ") || row.qualityStatus}</small>
          </div>
        ))}
      </div>
    </article>
  );
}
