// apps/web/src/features/operator/replayDemo/ReplayDemoSnapshotIdsPanel.tsx
// Purpose: render H61 checked-in snapshot identifiers as a dedicated panel.

import React from "react";

type ReplayDemoSnapshotIdsPanelProps = {
  items: string[];
};

export default function ReplayDemoSnapshotIdsPanel({ items }: ReplayDemoSnapshotIdsPanelProps): React.ReactElement {
  return (
    <section className="operatorReplayDemo__panel operatorReplayDemo__refs" aria-label="Snapshot ids">
      <div className="operatorReplayDemo__panelHeader"><p className="operatorReplayDemo__eyebrow">Snapshot IDs</p><h2>Snapshot IDs</h2></div>
      <ul className="operatorReplayDemo__refList">
        {items.map((item) => <li key={item}>{item}</li>)}
      </ul>
    </section>
  );
}
