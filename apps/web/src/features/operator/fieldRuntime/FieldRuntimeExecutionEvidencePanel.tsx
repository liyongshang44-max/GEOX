// apps/web/src/features/operator/fieldRuntime/FieldRuntimeExecutionEvidencePanel.tsx
// Purpose: render H60-H Execution Evidence availability and refs from read-only verification data.
// Boundary: this panel displays evidence only and does not create receipts, as-executed records, acceptance, or operation reports.

import React from "react";
import { type FieldRuntimeResidualViewModel } from "./fieldRuntimeResidualAdapter";

type FieldRuntimeExecutionEvidencePanelProps = {
  residual: FieldRuntimeResidualViewModel;
};

export default function FieldRuntimeExecutionEvidencePanel({ residual }: FieldRuntimeExecutionEvidencePanelProps): React.ReactElement {
  const evidence = residual.executionEvidence;
  return (
    <article className="operatorFieldRuntime__panel operatorFieldRuntime__executionEvidence" data-h60h-panel="execution-evidence">
      <div className="operatorFieldRuntime__panelHeader">
        <div>
          <p className="operatorFieldRuntime__eyebrow">Execution Evidence</p>
          <h2 className="operatorFieldRuntime__panelTitle">Execution Evidence</h2>
        </div>
        <span className="operatorFieldRuntime__panelMeta">{evidence.evidenceRefs.length} refs</span>
      </div>
      <p className="operatorFieldRuntime__stubLead">Execution Evidence is displayed as an existing evidence package only.</p>
      <div className="operatorFieldRuntime__metricGrid">
        <section className="operatorFieldRuntime__metricCard"><p className="operatorFieldRuntime__panelMeta">Receipt available</p><strong>{evidence.receiptAvailable ? "true" : "false"}</strong></section>
        <section className="operatorFieldRuntime__metricCard"><p className="operatorFieldRuntime__panelMeta">As-executed available</p><strong>{evidence.asExecutedAvailable ? "true" : "false"}</strong></section>
        <section className="operatorFieldRuntime__metricCard"><p className="operatorFieldRuntime__panelMeta">Acceptance available</p><strong>{evidence.acceptanceAvailable ? "true" : "false"}</strong></section>
        <section className="operatorFieldRuntime__metricCard"><p className="operatorFieldRuntime__panelMeta">Operation report available</p><strong>{evidence.operationReportAvailable ? "true" : "false"}</strong></section>
      </div>
      <details className="operatorFieldRuntime__residualRefs" open>
        <summary>Execution evidence refs</summary>
        <ul>{evidence.evidenceRefs.map((ref) => <li key={ref}>{ref}</li>)}</ul>
      </details>
    </article>
  );
}
