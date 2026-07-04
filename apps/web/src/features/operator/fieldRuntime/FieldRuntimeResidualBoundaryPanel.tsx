// apps/web/src/features/operator/fieldRuntime/FieldRuntimeResidualBoundaryPanel.tsx
// Purpose: render H60-H Residual / Verification no-write and no-causality boundary.
// Boundary: this panel displays boundary copy only and performs no mutation.

import React from "react";
import { type FieldRuntimeResidualViewModel } from "./fieldRuntimeResidualAdapter";

type FieldRuntimeResidualBoundaryPanelProps = {
  residual: FieldRuntimeResidualViewModel;
};

const H60H_RESIDUAL_BOUNDARY_LINES = [
  "No facts write",
  "No recommendation creation",
  "No approval",
  "No dispatch",
  "No AO-ACT task",
  "No ROI write",
  "No Field Memory write",
  "No causal proof claim",
  "No operation plan creation",
  "No backend contract change",
];

export default function FieldRuntimeResidualBoundaryPanel({ residual }: FieldRuntimeResidualBoundaryPanelProps): React.ReactElement {
  return (
    <article className="operatorFieldRuntime__panel operatorFieldRuntime__residualBoundary" data-h60h-panel="residual-boundary">
      <div className="operatorFieldRuntime__panelHeader">
        <div>
          <p className="operatorFieldRuntime__eyebrow">Residual Boundary</p>
          <h2 className="operatorFieldRuntime__panelTitle">Residual Boundary</h2>
        </div>
        <span className="operatorFieldRuntime__panelMeta">read-only verification review</span>
      </div>
      <ul className="operatorFieldRuntime__boundaryList">
        {H60H_RESIDUAL_BOUNDARY_LINES.map((line) => <li key={line}>{line}</li>)}
      </ul>
      {residual.boundaryRules.length > 0 ? (
        <div>
          <p className="operatorFieldRuntime__panelMeta">Verification read-model boundary rules</p>
          <ul className="operatorFieldRuntime__boundaryList">
            {residual.boundaryRules.map((rule) => <li key={rule}>{rule}</li>)}
          </ul>
        </div>
      ) : null}
    </article>
  );
}
