// apps/web/src/features/operator/replayDemo/ReplayDemoBoundaryClaimsPanel.tsx
// Purpose: render H61 replay demo boundary claims as a dedicated panel.
// Boundary: values describe demo scope only.

import React from "react";
import { type ReplayDemoViewModel } from "./replayDemoViewModel";

type ReplayDemoBoundaryClaimsPanelProps = {
  vm: ReplayDemoViewModel;
};

export default function ReplayDemoBoundaryClaimsPanel({ vm }: ReplayDemoBoundaryClaimsPanelProps): React.ReactElement {
  return (
    <section className="operatorReplayDemo__panel operatorReplayDemo__boundaryClaims" aria-label="Nonclaims">
      <div className="operatorReplayDemo__panelHeader"><p className="operatorReplayDemo__eyebrow">Nonclaims</p><h2>Nonclaims</h2></div>
      <div className="operatorReplayDemo__table">
        <div className="operatorReplayDemo__tableHeader"><span>Claim</span><span>Value</span><span>Meaning</span></div>
        {vm.nonclaims.map((row) => <div className="operatorReplayDemo__tableRow" key={row.label}><span>{row.label}</span><span>{row.value ? "true" : "false"}</span><span>{row.displayText}</span></div>)}
      </div>
    </section>
  );
}
