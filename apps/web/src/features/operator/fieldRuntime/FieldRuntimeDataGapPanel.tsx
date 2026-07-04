// apps/web/src/features/operator/fieldRuntime/FieldRuntimeDataGapPanel.tsx
// Purpose: render H60-D Data Gaps from the existing read-only Operator Field Twin workspace.
// Boundary: this panel does not create observation requests, AO-SENSE requests, or recommendations.

import React from "react";
import { type FieldRuntimeWorkspaceLoadState } from "./fieldRuntimeWorkspaceAdapter";

type FieldRuntimeDataGapPanelProps = {
  loadState?: FieldRuntimeWorkspaceLoadState;
};

export default function FieldRuntimeDataGapPanel({ loadState }: FieldRuntimeDataGapPanelProps): React.ReactElement {
  if (!loadState || loadState.status !== "ready") {
    return <article className="operatorFieldRuntime__panel"><h2 className="operatorFieldRuntime__panelTitle">Data Gaps</h2><p>Data gap summary is available after workspace overview loads.</p></article>;
  }

  const gaps = loadState.overview.dataGaps;
  return (
    <article className="operatorFieldRuntime__panel" data-h60d-panel="data-gaps">
      <div className="operatorFieldRuntime__panelHeader">
        <div>
          <p className="operatorFieldRuntime__eyebrow">Data Gaps</p>
          <h2 className="operatorFieldRuntime__panelTitle">Data Gaps</h2>
        </div>
        <span className="operatorFieldRuntime__panelMeta">source: operator_field_twin_workspace_v1</span>
      </div>
      {gaps.length === 0 ? <p>Workspace overview returned no data gaps.</p> : null}
      <ul className="operatorFieldRuntime__gapList">
        {gaps.map((gap) => (
          <li key={gap.gapCode}>
            <strong>{gap.label}</strong>
            <span>{gap.severityLabel}</span>
          </li>
        ))}
      </ul>
      <p className="operatorFieldRuntime__stubLead">This panel does not generate observation requests, AO-SENSE, or recommendations.</p>
    </article>
  );
}
