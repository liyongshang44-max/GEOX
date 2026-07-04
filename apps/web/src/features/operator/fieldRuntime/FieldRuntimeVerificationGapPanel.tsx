// apps/web/src/features/operator/fieldRuntime/FieldRuntimeVerificationGapPanel.tsx
// Purpose: render H60-H Verification Gaps from read-only verification data.
// Boundary: gap status is metadata only and is not priority, severity, or action ranking.

import React from "react";
import { type FieldRuntimeResidualViewModel } from "./fieldRuntimeResidualAdapter";

type FieldRuntimeVerificationGapPanelProps = {
  residual: FieldRuntimeResidualViewModel;
};

export default function FieldRuntimeVerificationGapPanel({ residual }: FieldRuntimeVerificationGapPanelProps): React.ReactElement {
  return (
    <article className="operatorFieldRuntime__panel operatorFieldRuntime__verificationGaps" data-h60h-panel="verification-gaps">
      <div className="operatorFieldRuntime__panelHeader">
        <div>
          <p className="operatorFieldRuntime__eyebrow">Verification Gaps</p>
          <h2 className="operatorFieldRuntime__panelTitle">Verification Gaps</h2>
        </div>
        <span className="operatorFieldRuntime__panelMeta">Verification Gap Status metadata</span>
      </div>
      <div className="operatorFieldRuntime__residualGapList">
        {residual.verificationGaps.length === 0 ? <p>No verification gaps returned.</p> : null}
        {residual.verificationGaps.map((gap) => (
          <section className="operatorFieldRuntime__metricCard" key={gap.gapCode}>
            <p className="operatorFieldRuntime__panelMeta">Verification Gap Status: {gap.gapStatus}</p>
            <strong>{gap.label}</strong>
            <span>{gap.gapCode}</span>
          </section>
        ))}
      </div>
    </article>
  );
}
