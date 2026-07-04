// apps/web/src/features/operator/fieldRuntime/FieldRuntimeEvidenceQualityPanel.tsx
// Purpose: render Field Runtime Quality Summary from the read-only evidence quality ViewModel.
// Boundary: AVAILABLE / LIMITED / BLOCKING are evidence quality statuses, not agronomic risk or task priority.

import React from "react";
import { type FieldRuntimeEvidenceViewModel } from "./fieldRuntimeEvidenceAdapter";

type FieldRuntimeEvidenceQualityPanelProps = {
  evidence: FieldRuntimeEvidenceViewModel;
};

export default function FieldRuntimeEvidenceQualityPanel({ evidence }: FieldRuntimeEvidenceQualityPanelProps): React.ReactElement {
  const summary = evidence.qualitySummary;
  return (
    <article className="operatorFieldRuntime__panel operatorFieldRuntime__qualitySummary" data-h60e-panel="quality-summary">
      <div className="operatorFieldRuntime__panelHeader">
        <div>
          <p className="operatorFieldRuntime__eyebrow">Quality Summary</p>
          <h2 className="operatorFieldRuntime__panelTitle">Quality Summary</h2>
        </div>
        <span className="operatorFieldRuntime__qualityBadge">evidence quality status: {summary.status}</span>
      </div>
      <p className="operatorFieldRuntime__stubLead">Evidence quality status is not agronomic risk and is not task priority.</p>
      <div className="operatorFieldRuntime__metricGrid">
        <section className="operatorFieldRuntime__metricCard"><p className="operatorFieldRuntime__panelMeta">Blocking reason</p><strong>{summary.blockingReason}</strong></section>
        <section className="operatorFieldRuntime__metricCard"><p className="operatorFieldRuntime__panelMeta">Simulation data present</p><strong>{summary.simulationDataPresent ? "true" : "false"}</strong></section>
        <section className="operatorFieldRuntime__metricCard"><p className="operatorFieldRuntime__panelMeta">Official data qualified</p><strong>{summary.officialDataQualified ? "true" : "false"}</strong></section>
        <section className="operatorFieldRuntime__metricCard"><p className="operatorFieldRuntime__panelMeta">Low-quality reasons</p><strong>{summary.lowQualityReasonCount}</strong></section>
      </div>
    </article>
  );
}
