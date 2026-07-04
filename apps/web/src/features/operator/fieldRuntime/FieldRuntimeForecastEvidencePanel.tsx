// apps/web/src/features/operator/fieldRuntime/FieldRuntimeForecastEvidencePanel.tsx
// Purpose: render H60-F Forecast Evidence refs summary without duplicating the full H60-E Evidence tab.
// Boundary: this panel lists forecast refs only and does not render the full evidence trace.

import React from "react";
import { type FieldRuntimeForecastViewModel } from "./fieldRuntimeForecastAdapter";

type FieldRuntimeForecastEvidencePanelProps = {
  forecast: FieldRuntimeForecastViewModel;
};

export default function FieldRuntimeForecastEvidencePanel({ forecast }: FieldRuntimeForecastEvidencePanelProps): React.ReactElement {
  return (
    <article className="operatorFieldRuntime__panel operatorFieldRuntime__forecastEvidence" data-h60f-panel="forecast-evidence">
      <div className="operatorFieldRuntime__panelHeader">
        <div>
          <p className="operatorFieldRuntime__eyebrow">Forecast Evidence</p>
          <h2 className="operatorFieldRuntime__panelTitle">Forecast Evidence</h2>
        </div>
        <span className="operatorFieldRuntime__panelMeta">{forecast.evidenceRefs.length} refs</span>
      </div>
      <p className="operatorFieldRuntime__stubLead">Full Evidence trace is available in Evidence tab.</p>
      <p className="operatorFieldRuntime__stubLead">Forecast Evidence only lists refs used by forecast window / timeline.</p>
      <details className="operatorFieldRuntime__forecastRefs" open>
        <summary>Forecast evidence refs</summary>
        <ul>{forecast.evidenceRefs.map((ref) => <li key={ref}>{ref}</li>)}</ul>
      </details>
    </article>
  );
}
