// apps/web/src/features/operator/fieldRuntime/FieldRuntimeStatePanel.tsx
// Purpose: render H60-D State Summary and state vector details from the existing read-only Operator Field Twin workspace.
// Boundary: this panel does not compute new state estimates or convert confidence into recommendations.

import React from "react";
import { type FieldRuntimeWorkspaceLoadState } from "./fieldRuntimeWorkspaceAdapter";

type FieldRuntimeStatePanelProps = {
  loadState?: FieldRuntimeWorkspaceLoadState;
  mode: "summary" | "full";
};

export default function FieldRuntimeStatePanel({ loadState, mode }: FieldRuntimeStatePanelProps): React.ReactElement {
  if (!loadState || loadState.status === "idle") {
    return <article className="operatorFieldRuntime__panel"><h2 className="operatorFieldRuntime__panelTitle">State Summary</h2><p>{loadState?.message || "State is waiting for a field context."}</p></article>;
  }
  if (loadState.status === "loading") {
    return <article className="operatorFieldRuntime__panel"><h2 className="operatorFieldRuntime__panelTitle">State Summary</h2><p>Loading workspace-derived state...</p></article>;
  }
  if (loadState.status === "error") {
    return <article className="operatorFieldRuntime__panel"><h2 className="operatorFieldRuntime__panelTitle">State Summary</h2><p>State load failed: {loadState.message}</p></article>;
  }

  const state = loadState.state;
  return (
    <article className="operatorFieldRuntime__panel" data-h60d-panel="state" data-state-panel-mode={mode}>
      <div className="operatorFieldRuntime__panelHeader">
        <div>
          <p className="operatorFieldRuntime__eyebrow">State</p>
          <h2 className="operatorFieldRuntime__panelTitle">State Summary</h2>
        </div>
        <span className="operatorFieldRuntime__panelMeta">source: {state.source}</span>
      </div>
      <p className="operatorFieldRuntime__stubLead">State vector is read from workspace-derived state metadata. It is not a newly computed state estimate.</p>
      <div className="operatorFieldRuntime__stateVector">
        {state.stateVectorItems.map((item) => (
          <section className="operatorFieldRuntime__metricCard" key={item.label}>
            <p className="operatorFieldRuntime__panelMeta">{item.label}</p>
            <strong>{item.value}</strong>
            {item.confidenceLabel ? <span>{item.confidenceLabel}</span> : null}
            {typeof item.evidenceRefCount === "number" ? <span>{item.evidenceRefCount} evidence refs</span> : null}
          </section>
        ))}
      </div>
      {mode === "full" ? (
        <ul className="operatorFieldRuntime__boundaryList">
          {state.boundaryCopy.map((line) => <li key={line}>{line}</li>)}
        </ul>
      ) : null}
    </article>
  );
}
