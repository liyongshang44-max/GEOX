// apps/web/src/features/operator/fieldRuntime/FieldRuntimeScenarioStatusPanel.tsx
// Purpose: render H60-G Scenario status details from the read-only scenario ViewModel.
// Boundary: status fields are comparison metadata only and do not represent executable state.

import React from "react";
import { type FieldRuntimeScenarioViewModel } from "./fieldRuntimeScenarioAdapter";

type FieldRuntimeScenarioStatusPanelProps = {
  scenario: FieldRuntimeScenarioViewModel;
};

export default function FieldRuntimeScenarioStatusPanel({ scenario }: FieldRuntimeScenarioStatusPanelProps): React.ReactElement {
  const compare = scenario.scenarioCompare;
  return (
    <article className="operatorFieldRuntime__panel operatorFieldRuntime__scenarioStatus" data-h60g-panel="scenario-status">
      <div className="operatorFieldRuntime__panelHeader">
        <div>
          <p className="operatorFieldRuntime__eyebrow">Scenario Review</p>
          <h2 className="operatorFieldRuntime__panelTitle">Scenario Status</h2>
        </div>
        <span className="operatorFieldRuntime__panelMeta">Scenario set id is source/detail metadata.</span>
      </div>
      <p className="operatorFieldRuntime__stubLead">No-action Baseline is a comparison reference, not a recommended plan.</p>
      <div className="operatorFieldRuntime__metricGrid">
        <section className="operatorFieldRuntime__metricCard"><p className="operatorFieldRuntime__panelMeta">Status</p><strong>{compare.status}</strong></section>
        <section className="operatorFieldRuntime__metricCard"><p className="operatorFieldRuntime__panelMeta">No-action Baseline</p><strong>{compare.noActionBaselinePresent ? "present" : "not present"}</strong></section>
        <section className="operatorFieldRuntime__metricCard"><p className="operatorFieldRuntime__panelMeta">Unavailable reason</p><strong>{compare.unavailableReason}</strong></section>
        <section className="operatorFieldRuntime__metricCard"><p className="operatorFieldRuntime__panelMeta">Scenario set id</p><strong>{compare.scenarioSetId}</strong></section>
      </div>
    </article>
  );
}
