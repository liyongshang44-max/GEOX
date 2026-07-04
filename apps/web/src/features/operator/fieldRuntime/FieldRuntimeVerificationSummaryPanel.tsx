// apps/web/src/features/operator/fieldRuntime/FieldRuntimeVerificationSummaryPanel.tsx
// Purpose: render H60-H Response Verification summary and downstream candidate metadata.
// Boundary: downstream candidate flags are metadata only and do not expose write controls.

import React from "react";
import { type FieldRuntimeResidualViewModel } from "./fieldRuntimeResidualAdapter";

type FieldRuntimeVerificationSummaryPanelProps = {
  residual: FieldRuntimeResidualViewModel;
};

export default function FieldRuntimeVerificationSummaryPanel({ residual }: FieldRuntimeVerificationSummaryPanelProps): React.ReactElement {
  const summary = residual.verificationSummary;
  return (
    <article className="operatorFieldRuntime__panel operatorFieldRuntime__verificationSummary" data-h60h-panel="verification-summary">
      <div className="operatorFieldRuntime__panelHeader">
        <div>
          <p className="operatorFieldRuntime__eyebrow">Response Verification</p>
          <h2 className="operatorFieldRuntime__panelTitle">Response Verification</h2>
        </div>
        <span className="operatorFieldRuntime__panelMeta">Downstream candidate metadata</span>
      </div>
      <p className="operatorFieldRuntime__stubLead">Downstream candidate flags are metadata only.</p>
      <div className="operatorFieldRuntime__metricGrid operatorFieldRuntime__residualMetadata">
        <section className="operatorFieldRuntime__metricCard"><p className="operatorFieldRuntime__panelMeta">Status</p><strong>{summary.statusText}</strong></section>
        <section className="operatorFieldRuntime__metricCard"><p className="operatorFieldRuntime__panelMeta">Reason</p><strong>{summary.reasonText}</strong></section>
        <section className="operatorFieldRuntime__metricCard"><p className="operatorFieldRuntime__panelMeta">Verification ID</p><strong>{summary.verificationId}</strong></section>
        <section className="operatorFieldRuntime__metricCard"><p className="operatorFieldRuntime__panelMeta">Class Transition</p><strong>{summary.classTransitionText}</strong></section>
        <section className="operatorFieldRuntime__metricCard"><p className="operatorFieldRuntime__panelMeta">Field Memory candidate metadata only</p><strong>{summary.fieldMemoryCandidate ? "true" : "false"}</strong></section>
        <section className="operatorFieldRuntime__metricCard"><p className="operatorFieldRuntime__panelMeta">ROI candidate metadata only</p><strong>{summary.roiCandidate ? "true" : "false"}</strong></section>
        <section className="operatorFieldRuntime__metricCard"><p className="operatorFieldRuntime__panelMeta">Write-readiness metadata only</p><strong>{summary.writeReadyMetadata ? "true" : "false"}</strong></section>
      </div>
    </article>
  );
}
