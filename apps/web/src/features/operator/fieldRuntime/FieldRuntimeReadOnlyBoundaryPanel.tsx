// apps/web/src/features/operator/fieldRuntime/FieldRuntimeReadOnlyBoundaryPanel.tsx
// Purpose: render the no-write boundary for canonical Field Runtime Overview and State.
// Boundary: this panel is only boundary copy and performs no action.

import React from "react";
import { type FieldRuntimeWorkspaceLoadState } from "./fieldRuntimeWorkspaceAdapter";

type FieldRuntimeReadOnlyBoundaryPanelProps = {
  loadState?: FieldRuntimeWorkspaceLoadState;
};

const FIELD_RUNTIME_BOUNDARY_LINES = [
  "No facts write",
  "No recommendation creation",
  "No approval",
  "No dispatch",
  "No work order creation",
  "No ROI write",
  "No Field Memory write",
];

export default function FieldRuntimeReadOnlyBoundaryPanel({ loadState }: FieldRuntimeReadOnlyBoundaryPanelProps): React.ReactElement {
  const workspaceRules = loadState?.status === "ready" ? loadState.overview.boundaryRules : [];

  return (
    <article className="operatorFieldRuntime__panel operatorFieldRuntime__boundaryPanel" data-h60d-panel="read-only-boundary">
      <div className="operatorFieldRuntime__panelHeader">
        <div>
          <p className="operatorFieldRuntime__eyebrow">Boundary</p>
          <h2 className="operatorFieldRuntime__panelTitle">Read-only Boundary</h2>
        </div>
        <span className="operatorFieldRuntime__panelMeta">No-write product boundary</span>
      </div>
      <ul className="operatorFieldRuntime__boundaryList">
        {FIELD_RUNTIME_BOUNDARY_LINES.map((line) => <li key={line}>{line}</li>)}
      </ul>
      {workspaceRules.length > 0 ? (
        <div>
          <p className="operatorFieldRuntime__panelMeta">Workspace boundary rules</p>
          <ul className="operatorFieldRuntime__boundaryList">
            {workspaceRules.map((rule) => <li key={rule}>{rule}</li>)}
          </ul>
        </div>
      ) : null}
    </article>
  );
}
