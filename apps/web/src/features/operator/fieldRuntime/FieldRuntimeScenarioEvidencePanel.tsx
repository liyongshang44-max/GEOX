// apps/web/src/features/operator/fieldRuntime/FieldRuntimeScenarioEvidencePanel.tsx
// Purpose: render H60-G Scenario Evidence refs summary without duplicating the full H60-E Evidence tab.
// Boundary: this panel lists scenario compare refs only and does not render the full evidence trace.

import React from "react";
import { type FieldRuntimeScenarioViewModel } from "./fieldRuntimeScenarioAdapter";

type FieldRuntimeScenarioEvidencePanelProps = {
  scenario: FieldRuntimeScenarioViewModel;
};

export default function FieldRuntimeScenarioEvidencePanel({ scenario }: FieldRuntimeScenarioEvidencePanelProps): React.ReactElement {
  return (
    <article className="operatorFieldRuntime__panel operatorFieldRuntime__scenarioEvidence" data-h60g-panel="scenario-evidence">
      <div className="operatorFieldRuntime__panelHeader">
        <div>
          <p className="operatorFieldRuntime__eyebrow">Scenario Evidence</p>
          <h2 className="operatorFieldRuntime__panelTitle">Scenario Evidence</h2>
        </div>
        <span className="operatorFieldRuntime__panelMeta">{scenario.evidenceRefs.length} refs</span>
      </div>
      <p className="operatorFieldRuntime__stubLead">Full Evidence trace is available in Evidence tab.</p>
      <p className="operatorFieldRuntime__stubLead">Scenario Evidence only lists refs used by scenario compare.</p>
      <details className="operatorFieldRuntime__scenarioRefs" open>
        <summary>Scenario evidence refs</summary>
        <ul>{scenario.evidenceRefs.map((ref) => <li key={ref}>{ref}</li>)}</ul>
      </details>
    </article>
  );
}
