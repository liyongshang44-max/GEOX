// apps/web/src/features/operator/replayDemo/ReplayDemoIngestionPanel.tsx
// Purpose: render H61 duplicate handling, clock skew, and ingestion window rows.
// Boundary: blocked and warn counts are metadata labels only and not business risk colors.

import React from "react";
import { type ReplayDemoViewModel } from "./replayDemoViewModel";

type ReplayDemoIngestionPanelProps = {
  vm: ReplayDemoViewModel;
};

export default function ReplayDemoIngestionPanel({ vm }: ReplayDemoIngestionPanelProps): React.ReactElement {
  return (
    <section className="operatorReplayDemo__panel" aria-label="Ingestion Window">
      <div className="operatorReplayDemo__panelHeader"><p className="operatorReplayDemo__eyebrow">Duplicate and Clock-skew Handling</p><h2>Ingestion Window</h2></div>
      <p>{vm.ingestionWindow.lead}</p>
      <div className="operatorReplayDemo__table">
        <div className="operatorReplayDemo__tableHeader"><span>Label</span><span>Value</span><span>Metadata</span></div>
        {vm.ingestionWindow.rows.map((row) => <div className="operatorReplayDemo__tableRow" key={row.label}><span>{row.label}</span><span>{row.value}</span><span>{row.metadataStatus || "metadata_only"}</span></div>)}
      </div>
    </section>
  );
}
