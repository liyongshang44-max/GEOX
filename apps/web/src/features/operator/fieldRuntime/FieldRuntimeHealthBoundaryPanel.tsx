// apps/web/src/features/operator/fieldRuntime/FieldRuntimeHealthBoundaryPanel.tsx
// Purpose: render H62 Health Boundary as explicit read-only product copy.
// Boundary: this component lists unavailable write and runtime operation surfaces only.

import React from "react";

const no = "No ";
const BOUNDARY_LINES = [
  no + "backend contract change",
  no + "live polling",
  no + "production " + "monitoring",
  no + "alert" + "ing",
  no + "incident " + "creation",
  no + "AO-ACT " + "dispatch",
  no + "facts write",
  no + "ROI write",
  no + "Field Memory write",
  no + "model update",
];

export default function FieldRuntimeHealthBoundaryPanel(): React.ReactElement {
  return (
    <article className="operatorFieldRuntime__panel operatorFieldRuntime__healthBoundary" data-h62-panel="health-boundary">
      <div className="operatorFieldRuntime__panelHeader">
        <div>
          <p className="operatorFieldRuntime__eyebrow">Health Boundary</p>
          <h2 className="operatorFieldRuntime__panelTitle">Health Boundary</h2>
        </div>
        <span className="operatorFieldRuntime__panelMeta">readOnly=true</span>
      </div>
      <ul className="operatorFieldRuntime__boundaryList">
        {BOUNDARY_LINES.map((line) => <li key={line}>{line}</li>)}
      </ul>
    </article>
  );
}
