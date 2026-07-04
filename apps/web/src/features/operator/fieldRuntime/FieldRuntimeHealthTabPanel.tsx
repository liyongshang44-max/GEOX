// apps/web/src/features/operator/fieldRuntime/FieldRuntimeHealthTabPanel.tsx
// Purpose: compose the H62 Runtime Health Review tab.

import React from "react";
import { type FieldRuntimeHealthLoadState } from "./fieldRuntimeHealthAdapter";
import FieldRuntimeHealthBoundaryPanel from "./FieldRuntimeHealthBoundaryPanel";
import FieldRuntimeHealthEvidencePipelinePanel from "./FieldRuntimeHealthEvidencePipelinePanel";
import FieldRuntimeHealthGatewayBoundaryPanel from "./FieldRuntimeHealthGatewayBoundaryPanel";
import FieldRuntimeHealthModePanel from "./FieldRuntimeHealthModePanel";
import FieldRuntimeHealthNonclaimsPanel from "./FieldRuntimeHealthNonclaimsPanel";
import FieldRuntimeHealthReadModelPanel from "./FieldRuntimeHealthReadModelPanel";
import FieldRuntimeHealthSourcePanel from "./FieldRuntimeHealthSourcePanel";
import FieldRuntimeHealthTraceabilityPanel from "./FieldRuntimeHealthTraceabilityPanel";

type FieldRuntimeHealthTabPanelProps = {
  loadState?: FieldRuntimeHealthLoadState;
};

export default function FieldRuntimeHealthTabPanel({ loadState }: FieldRuntimeHealthTabPanelProps): React.ReactElement {
  if (!loadState || loadState.status !== "ready") {
    return <article className="operatorFieldRuntime__panel"><h2 className="operatorFieldRuntime__panelTitle">Runtime Health</h2><p>Runtime Health metadata is not available.</p></article>;
  }
  const health = loadState.health;
  return (
    <div className="operatorFieldRuntime__healthGrid" data-h62="health-ready" data-health-source={health.source}>
      <article className="operatorFieldRuntime__panel" data-h62-panel="health-intro">
        <div className="operatorFieldRuntime__panelHeader"><div><p className="operatorFieldRuntime__eyebrow">Runtime Health</p><h2 className="operatorFieldRuntime__panelTitle">Runtime Health Review</h2></div><span className="operatorFieldRuntime__panelMeta">source: field_runtime_health_review_v1</span></div>
        <p className="operatorFieldRuntime__stubLead">Replay-backed Health Review</p>
        <p className="operatorFieldRuntime__stubLead">mode: replay_backed_health_review</p>
        <p className="operatorFieldRuntime__stubLead">Runtime Health Review is displayed for review only.</p>
        <p className="operatorFieldRuntime__stubLead">Runtime Health does not claim live device connection.</p>
        <p className="operatorFieldRuntime__stubLead">Runtime Health does not claim production gateway online.</p>
        <p className="operatorFieldRuntime__stubLead">Runtime Health does not claim continuous production monitoring.</p>
      </article>
      <FieldRuntimeHealthModePanel health={health} />
      <FieldRuntimeHealthSourcePanel health={health} />
      <FieldRuntimeHealthReadModelPanel health={health} />
      <FieldRuntimeHealthEvidencePipelinePanel health={health} />
      <FieldRuntimeHealthGatewayBoundaryPanel health={health} />
      <FieldRuntimeHealthTraceabilityPanel health={health} />
      <FieldRuntimeHealthNonclaimsPanel health={health} />
      <FieldRuntimeHealthBoundaryPanel />
    </div>
  );
}
