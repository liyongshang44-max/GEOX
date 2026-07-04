// apps/web/src/features/operator/replayDemo/ReplayDemoDeviceEvidencePanel.tsx
// Purpose: render H61 device evidence package rows.
// Boundary: device evidence package is snapshot metadata and is not Runtime Health v1 or live device status.

import React from "react";
import { type ReplayDemoViewModel } from "./replayDemoViewModel";

type ReplayDemoDeviceEvidencePanelProps = {
  vm: ReplayDemoViewModel;
};

export default function ReplayDemoDeviceEvidencePanel({ vm }: ReplayDemoDeviceEvidencePanelProps): React.ReactElement {
  return (
    <section className="operatorReplayDemo__panel" aria-label="Device Evidence Package">
      <div className="operatorReplayDemo__panelHeader"><p className="operatorReplayDemo__eyebrow">Device Evidence</p><h2>Device Evidence Package</h2></div>
      <p>Device evidence package is snapshot metadata. It is not Runtime Health v1. It is not live device status.</p>
      <div className="operatorReplayDemo__table">
        <div className="operatorReplayDemo__tableHeader"><span>Device</span><span>Snapshot metadata</span><span>Status</span></div>
        {vm.deviceEvidence.rows.map((row) => <div className="operatorReplayDemo__tableRow" key={row.label}><span>{row.label}</span><span>{row.value}</span><span>{row.metadataStatus || "metadata_only"}</span></div>)}
      </div>
    </section>
  );
}
