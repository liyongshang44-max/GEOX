// apps/web/src/features/operator/fieldRuntime/FieldRuntimeScenarioTabPanel.tsx
// Purpose: render the H60-G canonical Field Runtime Scenario tab from the existing read-only scenario compare read model.
// Boundary: this tab reviews comparison data only and creates no recommendation, task, approval, dispatch, or AO-ACT action.

import React from "react";
import { type FieldRuntimeScenarioLoadState } from "./fieldRuntimeScenarioAdapter";
import FieldRuntimeScenarioBoundaryPanel from "./FieldRuntimeScenarioBoundaryPanel";
import FieldRuntimeScenarioEvidencePanel from "./FieldRuntimeScenarioEvidencePanel";
import FieldRuntimeScenarioOptionsPanel from "./FieldRuntimeScenarioOptionsPanel";
import FieldRuntimeScenarioStatusPanel from "./FieldRuntimeScenarioStatusPanel";

const FIELD_RUNTIME_SCENARIO_SOURCE_LABEL = "source: operator_field_twin_scenario_compare_v1";
const FIELD_RUNTIME_SCENARIO_COMPARE_SOURCE_LABEL = "scenario source: scenario_compare_v1";

type FieldRuntimeScenarioTabPanelProps = {
  loadState?: FieldRuntimeScenarioLoadState;
};

export default function FieldRuntimeScenarioTabPanel({ loadState }: FieldRuntimeScenarioTabPanelProps): React.ReactElement {
  if (!loadState || loadState.status === "idle") {
    return <article className="operatorFieldRuntime__panel"><h2 className="operatorFieldRuntime__panelTitle">Scenario</h2><p>{loadState?.message || "Scenario is waiting for a field context."}</p></article>;
  }
  if (loadState.status === "loading") {
    return <article className="operatorFieldRuntime__panel"><h2 className="operatorFieldRuntime__panelTitle">Scenario</h2><p>Loading read-only scenario compare...</p></article>;
  }
  if (loadState.status === "error") {
    return <article className="operatorFieldRuntime__panel"><h2 className="operatorFieldRuntime__panelTitle">Scenario</h2><p>Scenario load failed: {loadState.message}</p></article>;
  }

  const scenario = loadState.scenario;
  return (
    <div className="operatorFieldRuntime__scenarioGrid" data-h60g="scenario-tab-ready" data-scenario-source={scenario.source} data-compare-source={scenario.scenarioCompare.source}>
      <article className="operatorFieldRuntime__panel" data-h60g-panel="scenario-intro">
        <div className="operatorFieldRuntime__panelHeader">
          <div>
            <p className="operatorFieldRuntime__eyebrow">Scenario</p>
            <h2 className="operatorFieldRuntime__panelTitle">Scenario Review</h2>
          </div>
          <span className="operatorFieldRuntime__panelMeta">{FIELD_RUNTIME_SCENARIO_SOURCE_LABEL}</span>
        </div>
        <p className="operatorFieldRuntime__stubLead">{FIELD_RUNTIME_SCENARIO_COMPARE_SOURCE_LABEL}</p>
        <p className="operatorFieldRuntime__stubLead">Scenario content is derived from the existing read-only Operator Field Twin scenario compare read model.</p>
        <p className="operatorFieldRuntime__stubLead">Scenario Review is displayed for comparison only.</p>
        <p className="operatorFieldRuntime__stubLead">Scenario is not a recommendation. Scenario does not create recommendation. Scenario does not create task. Scenario does not imply action.</p>
        <p className="operatorFieldRuntime__stubLead">No scenario submission exists in canonical Field Runtime. No approval / dispatch / AO-ACT task is created.</p>
      </article>

      <FieldRuntimeScenarioStatusPanel scenario={scenario} />
      <FieldRuntimeScenarioOptionsPanel scenario={scenario} />
      <FieldRuntimeScenarioEvidencePanel scenario={scenario} />
      <FieldRuntimeScenarioBoundaryPanel scenario={scenario} />
    </div>
  );
}
