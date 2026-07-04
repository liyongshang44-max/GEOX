// apps/web/src/features/operator/replayDemo/ReplayDemoStandardsPanel.tsx
// Purpose: render H61 standards mapping evidence chain.
// Boundary: standards mapping is replay evidence mapping and not external certification.

import React from "react";
import { type ReplayDemoViewModel } from "./replayDemoViewModel";

type ReplayDemoStandardsPanelProps = {
  vm: ReplayDemoViewModel;
};

export default function ReplayDemoStandardsPanel({ vm }: ReplayDemoStandardsPanelProps): React.ReactElement {
  return (
    <section className="operatorReplayDemo__panel" aria-label="Standards Mapping">
      <div className="operatorReplayDemo__panelHeader"><p className="operatorReplayDemo__eyebrow">Standards Mapping</p><h2>Standards Mapping</h2></div>
      <p>Standards mapping is replay evidence mapping, not external certification.</p>
      <div className="operatorReplayDemo__table">
        <div className="operatorReplayDemo__tableHeader"><span>Layer</span><span>Value</span></div>
        {vm.standardsMapping.rows.map((row) => <div className="operatorReplayDemo__tableRow" key={row.label}><span>{row.label}</span><span>{row.value}</span></div>)}
      </div>
    </section>
  );
}
