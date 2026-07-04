// apps/web/src/features/operator/replayDemo/ReplayDemoTraceabilityPanel.tsx
// Purpose: render H61 traceability readback metadata plus hashes and evidence refs.
// Boundary: this panel displays checked-in snapshot metadata and does not create trace records.

import React from "react";
import { type ReplayDemoViewModel } from "./replayDemoViewModel";

type ReplayDemoTraceabilityPanelProps = {
  vm: ReplayDemoViewModel;
};

export default function ReplayDemoTraceabilityPanel({ vm }: ReplayDemoTraceabilityPanelProps): React.ReactElement {
  return (
    <section className="operatorReplayDemo__panel operatorReplayDemo__traceability" aria-label="Traceability">
      <div className="operatorReplayDemo__panelHeader"><p className="operatorReplayDemo__eyebrow">Traceability Readback</p><h2>Traceability</h2></div>
      <p>{vm.traceability.lead}</p>
      <div className="operatorReplayDemo__table">
        <div className="operatorReplayDemo__tableHeader"><span>Label</span><span>Readback metadata</span><span>Status</span></div>
        {vm.traceability.rows.map((row) => <div className="operatorReplayDemo__tableRow" key={row.label}><span>{row.label}</span><span>{row.value}</span><span>{row.metadataStatus || "metadata_only"}</span></div>)}
      </div>
      <div className="operatorReplayDemo__panelHeader"><p className="operatorReplayDemo__eyebrow">Hashes</p><h2>Hashes</h2></div>
      <p>{vm.hashes.lead}</p>
      <div className="operatorReplayDemo__table">
        <div className="operatorReplayDemo__tableHeader"><span>Label</span><span>Value</span><span>Metadata</span></div>
        {vm.hashes.rows.map((row) => <div className="operatorReplayDemo__tableRow" key={row.label}><span>{row.label}</span><span>{row.value}</span><span>{row.metadataStatus || "metadata_only"}</span></div>)}
      </div>
      <div className="operatorReplayDemo__panelHeader"><p className="operatorReplayDemo__eyebrow">Evidence refs</p><h2>Evidence refs</h2></div>
      <p>Every displayed demo value is tied to checked-in snapshot refs or hashes.</p>
      <ul className="operatorReplayDemo__refs">{vm.evidenceRefs.map((ref) => <li key={ref}>{ref}</li>)}</ul>
    </section>
  );
}
