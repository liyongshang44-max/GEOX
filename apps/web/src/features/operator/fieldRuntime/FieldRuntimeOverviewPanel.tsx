// apps/web/src/features/operator/fieldRuntime/FieldRuntimeOverviewPanel.tsx
// Purpose: render H60-D Field Runtime Overview content derived from the existing read-only Operator Field Twin workspace.
// Boundary: this panel displays mapped read-model fields only and creates no recommendations or actions.

import React from "react";
import { type FieldRuntimeWorkspaceLoadState } from "./fieldRuntimeWorkspaceAdapter";

type FieldRuntimeOverviewPanelProps = {
  loadState?: FieldRuntimeWorkspaceLoadState;
};

export default function FieldRuntimeOverviewPanel({ loadState }: FieldRuntimeOverviewPanelProps): React.ReactElement {
  if (!loadState || loadState.status === "idle") {
    return <article className="operatorFieldRuntime__panel"><h2 className="operatorFieldRuntime__panelTitle">Field Runtime Overview</h2><p>{loadState?.message || "Overview is waiting for a field context."}</p></article>;
  }
  if (loadState.status === "loading") {
    return <article className="operatorFieldRuntime__panel"><h2 className="operatorFieldRuntime__panelTitle">Field Runtime Overview</h2><p>Loading workspace-derived overview...</p></article>;
  }
  if (loadState.status === "error") {
    return <article className="operatorFieldRuntime__panel"><h2 className="operatorFieldRuntime__panelTitle">Field Runtime Overview</h2><p>Overview load failed: {loadState.message}</p></article>;
  }

  const overview = loadState.overview;
  return (
    <article className="operatorFieldRuntime__panel" data-h60d-panel="overview">
      <div className="operatorFieldRuntime__panelHeader">
        <div>
          <p className="operatorFieldRuntime__eyebrow">Overview</p>
          <h2 className="operatorFieldRuntime__panelTitle">Field Runtime Overview</h2>
        </div>
        <span className="operatorFieldRuntime__panelMeta">source: {overview.source}</span>
      </div>
      <p className="operatorFieldRuntime__stubLead">Overview content is derived from the existing read-only Operator Field Twin workspace.</p>
      <p className="operatorFieldRuntime__stubLead">No facts are written. No recommendation is created. No dispatch or AO-ACT task is created.</p>
      <div className="operatorFieldRuntime__summaryGrid">
        {overview.summaryCards.map((card) => (
          <section className="operatorFieldRuntime__metricCard" key={card.label}>
            <p className="operatorFieldRuntime__panelMeta">{card.label}</p>
            <strong>{card.value}</strong>
            {card.detail ? <span>{card.detail}</span> : null}
          </section>
        ))}
      </div>
    </article>
  );
}
