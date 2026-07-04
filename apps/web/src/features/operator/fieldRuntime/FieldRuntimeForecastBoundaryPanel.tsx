// apps/web/src/features/operator/fieldRuntime/FieldRuntimeForecastBoundaryPanel.tsx
// Purpose: render H60-F Forecast no-action boundary and backend contract boundary.
// Boundary: this panel displays boundary copy only and performs no mutation.

import React from "react";
import { type FieldRuntimeForecastViewModel } from "./fieldRuntimeForecastAdapter";

type FieldRuntimeForecastBoundaryPanelProps = {
  forecast: FieldRuntimeForecastViewModel;
};

const H60F_FORECAST_BOUNDARY_LINES = [
  "No facts write",
  "No recommendation creation",
  "No scenario comparison",
  "No approval",
  "No dispatch",
  "No AO-ACT task",
  "No ROI write",
  "No Field Memory write",
  "No forecast generation",
  "No backend contract change",
];

export default function FieldRuntimeForecastBoundaryPanel({ forecast }: FieldRuntimeForecastBoundaryPanelProps): React.ReactElement {
  return (
    <article className="operatorFieldRuntime__panel operatorFieldRuntime__forecastBoundary" data-h60f-panel="forecast-boundary">
      <div className="operatorFieldRuntime__panelHeader">
        <div>
          <p className="operatorFieldRuntime__eyebrow">Forecast Boundary</p>
          <h2 className="operatorFieldRuntime__panelTitle">Forecast Boundary</h2>
        </div>
        <span className="operatorFieldRuntime__panelMeta">read-only forecast review</span>
      </div>
      <ul className="operatorFieldRuntime__boundaryList">
        {H60F_FORECAST_BOUNDARY_LINES.map((line) => <li key={line}>{line}</li>)}
      </ul>
      {forecast.boundaryRules.length > 0 ? (
        <div>
          <p className="operatorFieldRuntime__panelMeta">Forecast read-model boundary rules</p>
          <ul className="operatorFieldRuntime__boundaryList">
            {forecast.boundaryRules.map((rule) => <li key={rule}>{rule}</li>)}
          </ul>
        </div>
      ) : null}
    </article>
  );
}
