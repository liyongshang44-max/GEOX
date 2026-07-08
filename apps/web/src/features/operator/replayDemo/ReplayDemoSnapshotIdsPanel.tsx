// apps/web/src/features/operator/replayDemo/ReplayDemoSnapshotIdsPanel.tsx
// Purpose: render H61 checked-in snapshot identifiers as a dedicated bilingual panel.
// Boundary: snapshot identifiers remain locale-neutral technical data.

import React from "react";
import { useLocale } from "../../../lib/locale";
import { REPLAY_DEMO_COPY, replayText } from "./replayDemoLocaleCopy";

type ReplayDemoSnapshotIdsPanelProps = {
  items: string[];
};

export default function ReplayDemoSnapshotIdsPanel({ items }: ReplayDemoSnapshotIdsPanelProps): React.ReactElement {
  const { locale } = useLocale();
  const title = replayText(locale, REPLAY_DEMO_COPY.panels.snapshotIdsTitle);
  return (
    <section className="operatorReplayDemo__panel operatorReplayDemo__refs" aria-label={replayText(locale, REPLAY_DEMO_COPY.panels.snapshotIdsAria)}>
      <div className="operatorReplayDemo__panelHeader"><p className="operatorReplayDemo__eyebrow">{title}</p><h2>{title}</h2></div>
      <ul className="operatorReplayDemo__refList" data-locale-neutral="true">
        {items.map((item) => <li key={item}>{item}</li>)}
      </ul>
    </section>
  );
}
