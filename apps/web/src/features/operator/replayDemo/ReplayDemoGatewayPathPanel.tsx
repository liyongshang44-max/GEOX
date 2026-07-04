// apps/web/src/features/operator/replayDemo/ReplayDemoGatewayPathPanel.tsx
// Purpose: render H61 gateway path replay rows.
// Boundary: gateway path rows are snapshot metadata and not live device counts.

import React from "react";
import { type ReplayDemoViewModel } from "./replayDemoViewModel";

type ReplayDemoGatewayPathPanelProps = {
  vm: ReplayDemoViewModel;
};

export default function ReplayDemoGatewayPathPanel({ vm }: ReplayDemoGatewayPathPanelProps): React.ReactElement {
  return (
    <section className="operatorReplayDemo__panel" aria-label="Gateway Path Replay">
      <div className="operatorReplayDemo__panelHeader"><p className="operatorReplayDemo__eyebrow">Gateway Path Replay</p><h2>Gateway Path Replay</h2></div>
      <p>{vm.gatewayPath.lead}</p>
      <div className="operatorReplayDemo__table">
        <div className="operatorReplayDemo__tableHeader"><span>Label</span><span>Value</span><span>Metadata</span></div>
        {vm.gatewayPath.rows.map((row) => <div className="operatorReplayDemo__tableRow" key={row.label}><span>{row.label}</span><span>{row.value}</span><span>{row.metadataStatus || "metadata_only"}</span></div>)}
      </div>
    </section>
  );
}
