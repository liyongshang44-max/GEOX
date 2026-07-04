// apps/web/src/features/operator/fieldRuntime/FieldRuntimeEvidenceSummaryPanel.tsx
// Purpose: render H60-D Evidence Summary only, leaving full evidence trace migration to H60-E.
// Boundary: this panel displays workspace summary refs and does not inspect full trace quality.

import React from "react";
import { type FieldRuntimeWorkspaceLoadState } from "./fieldRuntimeWorkspaceAdapter";

type FieldRuntimeEvidenceSummaryPanelProps = {
  loadState?: FieldRuntimeWorkspaceLoadState;
};

export default function FieldRuntimeEvidenceSummaryPanel({ loadState }: FieldRuntimeEvidenceSummaryPanelProps): React.ReactElement {
  if (!loadState || loadState.status !== "ready") {
    return <article className="operatorFieldRuntime__panel"><h2 className="operatorFieldRuntime__panelTitle">Evidence Summary</h2><p>Evidence summary is available after workspace overview loads.</p></article>;
  }

  const evidence = loadState.overview.evidenceSummary;
  return (
    <article className="operatorFieldRuntime__panel" data-h60d-panel="evidence-summary">
      <div className="operatorFieldRuntime__panelHeader">
        <div>
          <p className="operatorFieldRuntime__eyebrow">Evidence Summary</p>
          <h2 className="operatorFieldRuntime__panelTitle">Evidence Summary</h2>
        </div>
        <span className="operatorFieldRuntime__panelMeta">source: {evidence.source}</span>
      </div>
      <p className="operatorFieldRuntime__stubLead">This is only an Evidence summary. Full Evidence trace remains H60-E.</p>
      <p>{evidence.summaryText}</p>
      <ul className="operatorFieldRuntime__boundaryList">
        {evidence.evidenceRefs.slice(0, 8).map((ref) => <li key={ref}>{ref}</li>)}
        {evidence.evidenceRefs.length > 8 ? <li>{evidence.evidenceRefs.length - 8} additional refs not shown in H60-D summary</li> : null}
      </ul>
    </article>
  );
}
