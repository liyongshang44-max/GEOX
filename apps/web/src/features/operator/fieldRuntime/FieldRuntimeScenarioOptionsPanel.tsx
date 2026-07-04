// apps/web/src/features/operator/fieldRuntime/FieldRuntimeScenarioOptionsPanel.tsx
// Purpose: render H60-G Scenario Options in backend return order from the read-only scenario ViewModel.
// Boundary: this panel presents comparison rows only and offers no action controls.

import React from "react";
import { type FieldRuntimeScenarioViewModel } from "./fieldRuntimeScenarioAdapter";

type FieldRuntimeScenarioOptionsPanelProps = {
  scenario: FieldRuntimeScenarioViewModel;
};

export default function FieldRuntimeScenarioOptionsPanel({ scenario }: FieldRuntimeScenarioOptionsPanelProps): React.ReactElement {
  return (
    <article className="operatorFieldRuntime__panel operatorFieldRuntime__scenarioOptions" data-h60g-panel="scenario-options">
      <div className="operatorFieldRuntime__panelHeader">
        <div>
          <p className="operatorFieldRuntime__eyebrow">Scenario Options</p>
          <h2 className="operatorFieldRuntime__panelTitle">Scenario Options</h2>
        </div>
        <span className="operatorFieldRuntime__panelMeta">Backend return order is preserved.</span>
      </div>
      <p className="operatorFieldRuntime__stubLead">Scenario option confidence is metadata, not action eligibility. Scenario delta is displayed as comparison metadata, not task priority.</p>
      <div className="operatorFieldRuntime__scenarioOptionList">
        {scenario.options.map((option) => (
          <section className="operatorFieldRuntime__scenarioOption" key={option.optionId + option.label}>
            <div>
              <p className="operatorFieldRuntime__panelMeta">{option.optionId}</p>
              <strong>{option.label}</strong>
            </div>
            <dl className="operatorFieldRuntime__scenarioDetailList">
              <div><dt>Forecast Delta</dt><dd>{option.forecastDeltaText}</dd></div>
              <div><dt>Confidence Metadata</dt><dd>{option.confidenceText}</dd></div>
              <div><dt>No-action Baseline</dt><dd>{option.isNoActionBaseline ? "true" : "false"}</dd></div>
              <div><dt>Failure Conditions</dt><dd>{option.failureConditions.join(", ") || "None"}</dd></div>
            </dl>
          </section>
        ))}
      </div>
    </article>
  );
}
