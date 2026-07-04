// apps/web/src/features/operator/fieldRuntime/FieldRuntimeEvidenceGapPanel.tsx
// Purpose: render Field Runtime Evidence Gaps and low-quality reasons from the read-only evidence quality ViewModel.
// Boundary: gap status and quality reasons are metadata only and do not create AO-SENSE or recommendation actions.

import React from "react";
import { type FieldRuntimeEvidenceViewModel } from "./fieldRuntimeEvidenceAdapter";

type FieldRuntimeEvidenceGapPanelProps = {
  evidence: FieldRuntimeEvidenceViewModel;
};

export default function FieldRuntimeEvidenceGapPanel({ evidence }: FieldRuntimeEvidenceGapPanelProps): React.ReactElement {
  return (
    <article className="operatorFieldRuntime__panel" data-h60e-panel="evidence-gaps">
      <div className="operatorFieldRuntime__panelHeader">
        <div>
          <p className="operatorFieldRuntime__eyebrow">Evidence Gaps</p>
          <h2 className="operatorFieldRuntime__panelTitle">Evidence Gaps</h2>
        </div>
        <span className="operatorFieldRuntime__panelMeta">Evidence Gap Status metadata</span>
      </div>
      <p className="operatorFieldRuntime__stubLead">Evidence gaps do not trigger observation requests, AO-SENSE, or recommendations.</p>
      <div className="operatorFieldRuntime__evidenceGapList">
        {evidence.dataGaps.length === 0 ? <p>No evidence gaps returned.</p> : null}
        {evidence.dataGaps.map((gap) => (
          <section key={gap.code} className="operatorFieldRuntime__metricCard">
            <p className="operatorFieldRuntime__panelMeta">Evidence Gap Status: {gap.gapStatus}</p>
            <strong>{gap.label}</strong>
            <span>{gap.code}</span>
          </section>
        ))}
      </div>
      <div className="operatorFieldRuntime__evidenceGapList">
        {evidence.lowQualityReasons.length === 0 ? <p>No low-quality reasons returned.</p> : null}
        {evidence.lowQualityReasons.map((reason, index) => (
          <section key={reason.sourceTable + reason.reason + String(index)} className="operatorFieldRuntime__metricCard">
            <p className="operatorFieldRuntime__panelMeta">Low-quality reason</p>
            <strong>{reason.reason}</strong>
            <span>{reason.sourceTable}</span>
            <span>{reason.missingWindows.join(", ") || "no missing windows listed"}</span>
            <span>{reason.evidenceRefs.length} evidence refs</span>
          </section>
        ))}
      </div>
    </article>
  );
}
