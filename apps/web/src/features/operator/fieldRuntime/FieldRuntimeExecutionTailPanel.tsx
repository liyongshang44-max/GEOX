// apps/web/src/features/operator/fieldRuntime/FieldRuntimeExecutionTailPanel.tsx
// Purpose: render H60-H Execution Tail Summary from read-only H31-H45 closure and verification data.
// Boundary: this panel is trace summary only and is not the full Audit drawer.

import React from "react";
import { type FieldRuntimeResidualViewModel } from "./fieldRuntimeResidualAdapter";

type FieldRuntimeExecutionTailPanelProps = {
  residual: FieldRuntimeResidualViewModel;
};

export default function FieldRuntimeExecutionTailPanel({ residual }: FieldRuntimeExecutionTailPanelProps): React.ReactElement {
  return (
    <article className="operatorFieldRuntime__panel operatorFieldRuntime__executionTail" data-h60h-panel="execution-tail">
      <div className="operatorFieldRuntime__panelHeader">
        <div>
          <p className="operatorFieldRuntime__eyebrow">Execution Tail Summary</p>
          <h2 className="operatorFieldRuntime__panelTitle">Execution Tail Summary</h2>
        </div>
        <span className="operatorFieldRuntime__panelMeta">Trace summary only</span>
      </div>
      <p className="operatorFieldRuntime__stubLead">Execution Tail Summary is not Audit drawer.</p>
      <div className="operatorFieldRuntime__residualTable" role="table" aria-label="Field Runtime execution tail summary">
        <div className="operatorFieldRuntime__residualTableHeader" role="row"><span>Stage</span><span>Label</span><span>Status</span><span>Ref</span></div>
        {residual.executionTail.map((stage) => (
          <div className="operatorFieldRuntime__residualTableRow" role="row" key={stage.stageCode}>
            <span>{stage.stageCode}</span>
            <span>{stage.label}</span>
            <span>{stage.statusText}</span>
            <span>{stage.ref}</span>
          </div>
        ))}
      </div>
    </article>
  );
}
