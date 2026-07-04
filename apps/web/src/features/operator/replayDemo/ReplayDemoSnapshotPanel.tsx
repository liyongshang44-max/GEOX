// apps/web/src/features/operator/replayDemo/ReplayDemoSnapshotPanel.tsx
// Purpose: render H61 snapshot provenance summary.
// Boundary: hashes are provenance metadata, not production certification.

import React from "react";
import { type ReplayDemoViewModel } from "./replayDemoViewModel";

type ReplayDemoSnapshotPanelProps = {
  vm: ReplayDemoViewModel;
};

export default function ReplayDemoSnapshotPanel({ vm }: ReplayDemoSnapshotPanelProps): React.ReactElement {
  const snapshot = vm.snapshot;
  const rows = [
    ["source_snapshot_ref", snapshot.sourceSnapshotRef],
    ["source_snapshot_checked_in_as", snapshot.checkedInAs],
    ["generated_by", snapshot.generatedBy],
    ["baseline_tag", snapshot.baselineTag],
    ["baseline_commit", snapshot.baselineCommit],
    ["p51_final_tag", snapshot.p51FinalTag],
    ["p51_final_commit", snapshot.p51FinalCommit],
    ["deterministic_hash", snapshot.deterministicHash],
  ];
  return (
    <section className="operatorReplayDemo__panel operatorReplayDemo__snapshot" aria-label="Snapshot Source">
      <div className="operatorReplayDemo__panelHeader"><p className="operatorReplayDemo__eyebrow">Snapshot Source</p><h2>Snapshot Source</h2></div>
      <p>Hashes are provenance metadata, not production certification.</p>
      <div className="operatorReplayDemo__table">
        <div className="operatorReplayDemo__tableHeader"><span>Label</span><span>Value</span></div>
        {rows.map(([label, value]) => <div className="operatorReplayDemo__tableRow" key={label}><span>{label}</span><span>{value}</span></div>)}
      </div>
    </section>
  );
}
