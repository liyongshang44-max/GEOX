// apps/web/src/features/operator/fieldRuntime/FieldRuntimeHealthNonclaimsPanel.tsx
// Purpose: render H62 Runtime Health nonclaims.
// Boundary: rows are negative claims and do not introduce runtime capability.

import React from "react";
import { type FieldRuntimeHealthViewModel } from "./fieldRuntimeHealthAdapter";

type FieldRuntimeHealthNonclaimsPanelProps = {
  health: FieldRuntimeHealthViewModel;
};

export default function FieldRuntimeHealthNonclaimsPanel({ health }: FieldRuntimeHealthNonclaimsPanelProps): React.ReactElement {
  return (
    <article className="operatorFieldRuntime__panel operatorFieldRuntime__healthNonclaims" data-h62-panel="nonclaims">
      <div className="operatorFieldRuntime__panelHeader"><div><p className="operatorFieldRuntime__eyebrow">Nonclaims</p><h2 className="operatorFieldRuntime__panelTitle">Nonclaims</h2></div><span className="operatorFieldRuntime__panelMeta">claimAllowed=false</span></div>
      <ul className="operatorFieldRuntime__boundaryList">
        {health.runtimeNonclaims.map((row) => <li key={row.label}>{row.label}</li>)}
      </ul>
    </article>
  );
}
