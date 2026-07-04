// apps/web/src/features/operator/replayDemo/ReplayDemoHashesPanel.tsx
// Purpose: render H61 hash metadata as a dedicated Replay Demo panel.
// Boundary: hashes are snapshot metadata only.

import React from "react";
import { type ReplayDemoViewModel } from "./replayDemoViewModel";

type ReplayDemoHashesPanelProps = {
  vm: ReplayDemoViewModel;
};

export default function ReplayDemoHashesPanel({ vm }: ReplayDemoHashesPanelProps): React.ReactElement {
  return (
    <section className="operatorReplayDemo__panel operatorReplayDemo__hashes" aria-label="Hashes">
      <div className="operatorReplayDemo__panelHeader"><p className="operatorReplayDemo__eyebrow">Hashes</p><h2>Hashes</h2></div>
      <p>{vm.hashes.lead}</p>
      <div className="operatorReplayDemo__table">
        <div className="operatorReplayDemo__tableHeader"><span>Label</span><span>Value</span><span>Metadata</span></div>
        {vm.hashes.rows.map((row) => <div className="operatorReplayDemo__tableRow" key={row.label}><span>{row.label}</span><span>{row.value}</span><span>{row.metadataStatus || "metadata_only"}</span></div>)}
      </div>
    </section>
  );
}
