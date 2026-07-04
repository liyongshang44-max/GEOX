// apps/web/src/features/operator/fieldRuntime/FieldRuntimeForecastTimelinePanel.tsx
// Purpose: render H60-F Forecast Timeline items from the read-only forecast ViewModel.
// Boundary: timeline is forecast signal display only; confidence is metadata and does not become task priority.

import React from "react";
import { type FieldRuntimeForecastViewModel } from "./fieldRuntimeForecastAdapter";

type FieldRuntimeForecastTimelinePanelProps = {
  forecast: FieldRuntimeForecastViewModel;
};

export default function FieldRuntimeForecastTimelinePanel({ forecast }: FieldRuntimeForecastTimelinePanelProps): React.ReactElement {
  return (
    <article className="operatorFieldRuntime__panel operatorFieldRuntime__forecastTimeline" data-h60f-panel="forecast-timeline">
      <div className="operatorFieldRuntime__panelHeader">
        <div>
          <p className="operatorFieldRuntime__eyebrow">Forecast Timeline</p>
          <h2 className="operatorFieldRuntime__panelTitle">Forecast Timeline</h2>
        </div>
        <span className="operatorFieldRuntime__panelMeta">{forecast.timelineItems.length} timeline items</span>
      </div>
      <p className="operatorFieldRuntime__stubLead">Timeline is forecast signal display. Confidence is forecast metadata, not action eligibility.</p>
      <div className="operatorFieldRuntime__forecastTimelineList">
        {forecast.timelineItems.map((item) => (
          <section className="operatorFieldRuntime__forecastTimelineItem" key={item.horizon}>
            <div>
              <p className="operatorFieldRuntime__panelMeta">{item.horizon}</p>
              <strong>{item.forecastText}</strong>
            </div>
            <p className="operatorFieldRuntime__forecastReason">Confidence: {item.confidenceText}</p>
            <details className="operatorFieldRuntime__forecastRefs">
              <summary>{item.evidenceRefs.length} evidence refs</summary>
              <ul>{item.evidenceRefs.map((ref) => <li key={ref}>{ref}</li>)}</ul>
            </details>
          </section>
        ))}
      </div>
    </article>
  );
}
