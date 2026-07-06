// apps/web/src/features/operator/fieldRuntime/FieldRuntimeOverviewPanel.tsx
// Purpose: render H60-D Field Runtime Overview content derived from the existing read-only Operator Field Twin workspace.
// Boundary: this panel displays mapped read-model fields only and creates no recommendations or actions.

import React from "react";
import { ProductErrorState, ProductLoadingState, ProductStateBlock } from "../../../design-system/product";
import { type FieldRuntimeWorkspaceLoadState } from "./fieldRuntimeWorkspaceAdapter";

type FieldRuntimeOverviewPanelProps = {
  loadState?: FieldRuntimeWorkspaceLoadState;
};

export default function FieldRuntimeOverviewPanel({ loadState }: FieldRuntimeOverviewPanelProps): React.ReactElement {
  if (!loadState || loadState.status === "idle") {
    return (
      <article className="operatorFieldRuntime__panel">
        <h2 className="operatorFieldRuntime__panelTitle">Field Runtime Overview</h2>
        <ProductStateBlock
          kind="permissionLimited"
          surface="operator"
          title="Field context required"
          description="Select a field before loading the read-only Field Runtime overview."
          ariaLabel="Field Runtime overview idle state"
        />
      </article>
    );
  }

  if (loadState.status === "loading") {
    return (
      <article className="operatorFieldRuntime__panel">
        <h2 className="operatorFieldRuntime__panelTitle">Field Runtime Overview</h2>
        <ProductLoadingState
          surface="operator"
          label="Loading Field Runtime overview"
          description="Reading workspace-derived Operator Field Twin overview content."
          ariaLabel="Field Runtime overview loading state"
        />
      </article>
    );
  }

  if (loadState.status === "error") {
    return (
      <article className="operatorFieldRuntime__panel">
        <h2 className="operatorFieldRuntime__panelTitle">Field Runtime Overview</h2>
        <ProductErrorState
          surface="operator"
          title="Overview readback unavailable"
          message="The workspace-derived overview cannot be displayed safely right now. Try reading the field runtime page again."
          ariaLabel="Field Runtime overview safe error state"
        />
      </article>
    );
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
