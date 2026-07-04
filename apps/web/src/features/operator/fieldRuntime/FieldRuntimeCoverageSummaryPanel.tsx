// apps/web/src/features/operator/fieldRuntime/FieldRuntimeCoverageSummaryPanel.tsx
// Purpose: render H60-D Coverage Summary from the existing read-only Operator Field Twin workspace.
// Boundary: this panel displays coverage and freshness-like summary fields without ranking risk.

import React from "react";
import { type FieldRuntimeWorkspaceLoadState } from "./fieldRuntimeWorkspaceAdapter";

type FieldRuntimeCoverageSummaryPanelProps = {
  loadState?: FieldRuntimeWorkspaceLoadState;
};

function availability(value: boolean): string {
  return value ? "available" : "limited";
}

export default function FieldRuntimeCoverageSummaryPanel({ loadState }: FieldRuntimeCoverageSummaryPanelProps): React.ReactElement {
  if (!loadState || loadState.status !== "ready") {
    return <article className="operatorFieldRuntime__panel"><h2 className="operatorFieldRuntime__panelTitle">Coverage Summary</h2><p>Coverage summary is available after workspace overview loads.</p></article>;
  }

  const coverage = loadState.overview.coverageSummary;
  return (
    <article className="operatorFieldRuntime__panel" data-h60d-panel="coverage-summary">
      <div className="operatorFieldRuntime__panelHeader">
        <div>
          <p className="operatorFieldRuntime__eyebrow">Coverage Summary</p>
          <h2 className="operatorFieldRuntime__panelTitle">Coverage Summary</h2>
        </div>
        <span className="operatorFieldRuntime__panelMeta">source: {coverage.source}</span>
      </div>
      <div className="operatorFieldRuntime__coverageMatrix">
        <section className="operatorFieldRuntime__metricCard"><p className="operatorFieldRuntime__panelMeta">Coverage</p><strong>{coverage.coverageText}</strong></section>
        <section className="operatorFieldRuntime__metricCard"><p className="operatorFieldRuntime__panelMeta">Sensing</p><strong>{availability(coverage.sensingAvailable)}</strong></section>
        <section className="operatorFieldRuntime__metricCard"><p className="operatorFieldRuntime__panelMeta">Weather</p><strong>{availability(coverage.weatherAvailable)}</strong></section>
        <section className="operatorFieldRuntime__metricCard"><p className="operatorFieldRuntime__panelMeta">Forecast Window</p><strong>{coverage.forecastWindow}</strong><span>{coverage.reason}</span></section>
      </div>
    </article>
  );
}
