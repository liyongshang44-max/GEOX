// apps/web/src/features/operator/fieldRuntime/FieldRuntimeScenarioBoundaryPanel.tsx
// Purpose: render H60-G canonical Scenario no-submission boundary and legacy isolation note.
// Boundary: this panel displays boundary copy only and performs no mutation.

import React from "react";
import { type FieldRuntimeScenarioViewModel } from "./fieldRuntimeScenarioAdapter";

type FieldRuntimeScenarioBoundaryPanelProps = {
  scenario: FieldRuntimeScenarioViewModel;
};

const H60G_SCENARIO_BOUNDARY_LINES = [
  "No facts write",
  "No recommendation creation",
  "No scenario submission",
  "No approval",
  "No dispatch",
  "No AO-ACT task",
  "No operation plan creation",
  "No ROI write",
  "No Field Memory write",
  "No backend contract change",
];

export default function FieldRuntimeScenarioBoundaryPanel({ scenario }: FieldRuntimeScenarioBoundaryPanelProps): React.ReactElement {
  return (
    <article className="operatorFieldRuntime__panel operatorFieldRuntime__scenarioBoundary" data-h60g-panel="scenario-boundary">
      <div className="operatorFieldRuntime__panelHeader">
        <div>
          <p className="operatorFieldRuntime__eyebrow">Scenario Boundary</p>
          <h2 className="operatorFieldRuntime__panelTitle">Scenario Boundary</h2>
        </div>
        <span className="operatorFieldRuntime__panelMeta">read-only scenario review</span>
      </div>
      <p className="operatorFieldRuntime__scenarioNotice">Legacy scenario submission remains isolated under /operator/twin/fields/:fieldId/scenarios.</p>
      <ul className="operatorFieldRuntime__boundaryList">
        {H60G_SCENARIO_BOUNDARY_LINES.map((line) => <li key={line}>{line}</li>)}
      </ul>
      {scenario.boundaryRules.length > 0 ? (
        <div>
          <p className="operatorFieldRuntime__panelMeta">Scenario read-model boundary rules</p>
          <ul className="operatorFieldRuntime__boundaryList">
            {scenario.boundaryRules.map((rule) => <li key={rule}>{rule}</li>)}
          </ul>
        </div>
      ) : null}
    </article>
  );
}
