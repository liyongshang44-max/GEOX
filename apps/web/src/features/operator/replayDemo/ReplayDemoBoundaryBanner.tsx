// apps/web/src/features/operator/replayDemo/ReplayDemoBoundaryBanner.tsx
// Purpose: render first-screen H61 nonclaims and demo boundary labels.
// Boundary: this banner is static product copy only.

import React from "react";

const BOUNDARY_ITEMS = [
  "Static checked-in snapshot",
  "Static snapshot only",
  "No live device connection",
  "No production gateway claim",
  "No Runtime Health claim",
  "No field pilot claim",
  "No AO-ACT dispatch",
  "No facts write",
  "No recommendation",
  "No ROI write",
  "No Field Memory write",
  "No writes created",
];

export default function ReplayDemoBoundaryBanner(): React.ReactElement {
  return (
    <section className="operatorReplayDemo__boundaryBanner" aria-label="Replay demo boundary">
      {BOUNDARY_ITEMS.map((item) => <span className="operatorReplayDemo__boundaryItem" key={item}>{item}</span>)}
    </section>
  );
}
