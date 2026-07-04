// apps/web/src/features/operator/fieldRuntime/FieldRuntimeEvidenceBoundaryPanel.tsx
// Purpose: render H60-E Evidence no-write boundary and backend contract boundary.
// Boundary: this panel displays boundary copy only and performs no mutation.

import React from "react";
import { type FieldRuntimeEvidenceViewModel } from "./fieldRuntimeEvidenceAdapter";

type FieldRuntimeEvidenceBoundaryPanelProps = {
  evidence: FieldRuntimeEvidenceViewModel;
};

const H60E_EVIDENCE_BOUNDARY_LINES = [
  "No facts write",
  "No recommendation creation",
  "No approval",
  "No dispatch",
  "No AO-ACT task",
  "No ROI write",
  "No Field Memory write",
  "No evidence mutation",
  "No backend contract change",
];

export default function FieldRuntimeEvidenceBoundaryPanel({ evidence }: FieldRuntimeEvidenceBoundaryPanelProps): React.ReactElement {
  return (
    <article className="operatorFieldRuntime__panel operatorFieldRuntime__evidenceBoundary" data-h60e-panel="evidence-boundary">
      <div className="operatorFieldRuntime__panelHeader">
        <div>
          <p className="operatorFieldRuntime__eyebrow">Evidence Boundary</p>
          <h2 className="operatorFieldRuntime__panelTitle">Evidence Boundary</h2>
        </div>
        <span className="operatorFieldRuntime__panelMeta">read-only evidence review</span>
      </div>
      <ul className="operatorFieldRuntime__boundaryList">
        {H60E_EVIDENCE_BOUNDARY_LINES.map((line) => <li key={line}>{line}</li>)}
      </ul>
      {evidence.boundaryRules.length > 0 ? (
        <div>
          <p className="operatorFieldRuntime__panelMeta">Evidence read-model boundary rules</p>
          <ul className="operatorFieldRuntime__boundaryList">
            {evidence.boundaryRules.map((rule) => <li key={rule}>{rule}</li>)}
          </ul>
        </div>
      ) : null}
    </article>
  );
}
