// apps/web/src/features/operator/fieldRuntime/FieldRuntimeForecastTabPanel.tsx
// Purpose: render the H60-F canonical Field Runtime Forecast tab from the existing read-only forecast panel.
// Boundary: this tab reviews forecast information only and creates no recommendations, scenarios, approvals, dispatches, or AO-ACT tasks.

import React from "react";
import { type FieldRuntimeForecastLoadState } from "./fieldRuntimeForecastAdapter";
import FieldRuntimeForecastBoundaryPanel from "./FieldRuntimeForecastBoundaryPanel";
import FieldRuntimeForecastEvidencePanel from "./FieldRuntimeForecastEvidencePanel";
import FieldRuntimeForecastTimelinePanel from "./FieldRuntimeForecastTimelinePanel";
import FieldRuntimeForecastWindowPanel from "./FieldRuntimeForecastWindowPanel";

const FIELD_RUNTIME_FORECAST_SOURCE_LABEL = "source: operator_field_twin_forecast_panel_v1";
const FIELD_RUNTIME_FORECAST_WINDOW_SOURCE_LABEL = "Forecast window source: forecast_window_v1";

type FieldRuntimeForecastTabPanelProps = {
  loadState?: FieldRuntimeForecastLoadState;
};

export default function FieldRuntimeForecastTabPanel({ loadState }: FieldRuntimeForecastTabPanelProps): React.ReactElement {
  if (!loadState || loadState.status === "idle") {
    return <article className="operatorFieldRuntime__panel"><h2 className="operatorFieldRuntime__panelTitle">Forecast</h2><p>{loadState?.message || "Forecast is waiting for a field context."}</p></article>;
  }
  if (loadState.status === "loading") {
    return <article className="operatorFieldRuntime__panel"><h2 className="operatorFieldRuntime__panelTitle">Forecast</h2><p>Loading read-only forecast panel...</p></article>;
  }
  if (loadState.status === "error") {
    return <article className="operatorFieldRuntime__panel"><h2 className="operatorFieldRuntime__panelTitle">Forecast</h2><p>Forecast load failed: {loadState.message}</p></article>;
  }

  const forecast = loadState.forecast;
  return (
    <div className="operatorFieldRuntime__forecastGrid" data-h60f="forecast-tab-ready" data-forecast-source={forecast.source} data-window-source={forecast.forecastWindow.source}>
      <article className="operatorFieldRuntime__panel" data-h60f-panel="forecast-intro">
        <div className="operatorFieldRuntime__panelHeader">
          <div>
            <p className="operatorFieldRuntime__eyebrow">Forecast</p>
            <h2 className="operatorFieldRuntime__panelTitle">Forecast</h2>
          </div>
          <span className="operatorFieldRuntime__panelMeta">{FIELD_RUNTIME_FORECAST_SOURCE_LABEL}</span>
        </div>
        <p className="operatorFieldRuntime__stubLead">{FIELD_RUNTIME_FORECAST_WINDOW_SOURCE_LABEL}</p>
        <p className="operatorFieldRuntime__stubLead">Forecast content is derived from the existing read-only Operator Field Twin forecast panel.</p>
        <p className="operatorFieldRuntime__stubLead">Forecast is displayed for review only.</p>
        <p className="operatorFieldRuntime__stubLead">Forecast is not a recommendation. Forecast does not create task. Forecast does not imply action.</p>
        <p className="operatorFieldRuntime__stubLead">No scenario comparison is performed. No approval / dispatch / AO-ACT task is created.</p>
      </article>

      <FieldRuntimeForecastWindowPanel forecast={forecast} />
      <FieldRuntimeForecastTimelinePanel forecast={forecast} />
      <FieldRuntimeForecastEvidencePanel forecast={forecast} />
      <FieldRuntimeForecastBoundaryPanel forecast={forecast} />
    </div>
  );
}
