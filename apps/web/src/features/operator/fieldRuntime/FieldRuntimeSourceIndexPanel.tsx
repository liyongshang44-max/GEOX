// apps/web/src/features/operator/fieldRuntime/FieldRuntimeSourceIndexPanel.tsx
// Purpose: render Field Runtime Source Index Inventory from the read-only evidence quality ViewModel.
// Boundary: table names are detail metadata and are not primary product titles.

import React from "react";
import { type FieldRuntimeEvidenceViewModel } from "./fieldRuntimeEvidenceAdapter";

type FieldRuntimeSourceIndexPanelProps = {
  evidence: FieldRuntimeEvidenceViewModel;
};

export default function FieldRuntimeSourceIndexPanel({ evidence }: FieldRuntimeSourceIndexPanelProps): React.ReactElement {
  return (
    <article className="operatorFieldRuntime__panel" data-h60e-panel="source-index">
      <div className="operatorFieldRuntime__panelHeader">
        <div>
          <p className="operatorFieldRuntime__eyebrow">Source Index</p>
          <h2 className="operatorFieldRuntime__panelTitle">Source Index</h2>
        </div>
        <span className="operatorFieldRuntime__panelMeta">{evidence.sourceIndexes.length} sources</span>
      </div>
      <div className="operatorFieldRuntime__sourceIndexTable" role="table" aria-label="Field Runtime source index inventory">
        <div className="operatorFieldRuntime__tableHeader" role="row"><span>Source label</span><span>Available</span><span>Rows</span><span>Missing reason</span><span>Refs</span></div>
        {evidence.sourceIndexes.map((row) => (
          <div className="operatorFieldRuntime__tableRow" role="row" key={row.tableName}>
            <span><strong>{row.sourceLabel}</strong><small>{row.tableName}</small></span>
            <span>{row.available ? "available" : "not available"}</span>
            <span>{row.rowCount}</span>
            <span>{row.missingReason}</span>
            <span>{row.latestEvidenceRefs.length}</span>
          </div>
        ))}
      </div>
    </article>
  );
}
