// apps/web/src/features/operator/fieldRuntime/FieldRuntimeForecastWindowPanel.tsx
// Purpose: render the H60-F Forecast Window from the read-only forecast ViewModel.
// Boundary: forecast window is availability metadata only and is not an action window or automatic execution window.

import React from "react";
import { type FieldRuntimeForecastViewModel } from "./fieldRuntimeForecastAdapter";

type FieldRuntimeForecastWindowPanelProps = {
  forecast: FieldRuntimeForecastViewModel;
};

export default function FieldRuntimeForecastWindowPanel({ forecast }: FieldRuntimeForecastWindowPanelProps): React.ReactElement {
  const window = forecast.forecastWindow;
  return (
    <article className="operatorFieldRuntime__panel operatorFieldRuntime__forecastWindow" data-h60f-panel="forecast-window">
      <div className="operatorFieldRuntime__panelHeader">
        <div>
          <p className="operatorFieldRuntime__eyebrow">Forecast Window</p>
          <h2 className="operatorFieldRuntime__panelTitle">Forecast Window</h2>
        </div>
        <span className="operatorFieldRuntime__panelMeta">Forecast window is a read-only availability window.</span>
      </div>
      <p className="operatorFieldRuntime__stubLead">Forecast window is not an action window.</p>
      <div className="operatorFieldRuntime__metricGrid">
        <section className="operatorFieldRuntime__metricCard"><p className="operatorFieldRuntime__panelMeta">Available Horizon</p><strong>{window.availableHorizon}</strong></section>
        <section className="operatorFieldRuntime__metricCard"><p className="operatorFieldRuntime__panelMeta">Horizon limited</p><strong>{window.horizonLimited ? "true" : "false"}</strong></section>
        <section className="operatorFieldRuntime__metricCard"><p className="operatorFieldRuntime__panelMeta">Unavailable Horizons</p><strong>{window.unavailableHorizons.join(", ") || "None"}</strong></section>
        <section className="operatorFieldRuntime__metricCard"><p className="operatorFieldRuntime__panelMeta">Forecast Limitation Reason</p><strong>{window.limitationReason}</strong></section>
        <section className="operatorFieldRuntime__metricCard"><p className="operatorFieldRuntime__panelMeta">Forecast Evidence</p><strong>{window.evidenceRefs.length} refs</strong></section>
      </div>
    </article>
  );
}
